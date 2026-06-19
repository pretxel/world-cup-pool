import "server-only";
import { Resend } from "resend";
import { getTranslations } from "next-intl/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { DEFAULT_LOCALE, localePath } from "@/lib/i18n";
import { isOptedIn } from "@/lib/email-prefs";
import { checkEmailSenderConfig } from "./email-sender-config";
import type { HitType } from "@/lib/db";
import {
  renderResultEmail,
  type EmailFinishedMatch,
  type ResultEmailData,
  type ResultEmailStrings,
} from "./result-email-template";

// Resend caps a single batch.send call at 100 messages.
const RESEND_BATCH_LIMIT = 100;

export interface DispatchSummary {
  emailed: number;
  failed: number;
  skipped: number;
  // Set when the production email-sender guard detected a misconfiguration
  // during this run (sandbox default sender and/or missing RESEND_API_KEY).
  // Optional so healthy runs (and `emailed`/`failed`/`skipped` semantics) are
  // unchanged; flows through recordRun into the operations record / cron logs.
  senderMisconfigured?: boolean;
}

const ZERO: DispatchSummary = { emailed: 0, failed: 0, skipped: 0 };

// Emits one clear warning when the production email sender is misconfigured and
// reports whether the run should carry the summary flag. Pure detection: never
// throws, never changes the resolved sender. Shared by both entry points.
function warnIfSenderMisconfigured(context: string): boolean {
  const check = checkEmailSenderConfig();
  if (check.shouldWarn) {
    console.warn(`[result-emails] ${context}: ${check.message}`);
  }
  return check.shouldWarn;
}

// A scored row for a match that is currently final, flattened with the match's
// teams + scoreline. The unit of "a player's standing changed".
export interface ScoredFinalRow {
  user_id: string;
  match_id: string;
  points: number;
  hit_type: HitType;
  home_team: string;
  away_team: string;
  home_score: number;
  away_score: number;
}

export interface PendingRecipient {
  userId: string;
  matchIds: string[];
  matches: EmailFinishedMatch[];
}

// Pure: a (match,user) is pending when it has a scored row on a final match and
// no ledger row. Groups every pending match under its user so a player affected
// by several matches gets one email. Exported for unit testing.
export function computePendingByUser(
  scored: ScoredFinalRow[],
  ledger: { match_id: string; user_id: string }[],
): PendingRecipient[] {
  const sent = new Set(ledger.map((r) => `${r.match_id}|${r.user_id}`));
  const byUser = new Map<string, PendingRecipient>();

  for (const r of scored) {
    if (sent.has(`${r.match_id}|${r.user_id}`)) continue;
    let rec = byUser.get(r.user_id);
    if (!rec) {
      rec = { userId: r.user_id, matchIds: [], matches: [] };
      byUser.set(r.user_id, rec);
    }
    rec.matchIds.push(r.match_id);
    rec.matches.push({
      homeTeam: r.home_team,
      awayTeam: r.away_team,
      homeScore: r.home_score,
      awayScore: r.away_score,
      points: r.points,
      hitType: r.hit_type,
    });
  }

  return [...byUser.values()];
}

// A player's stored result-email preference, keyed by user id. Used to drop
// recipients who have opted out of result emails — a type that had no opt-out at
// all before this change.
export interface ResultPrefRow {
  user_id: string;
  email_prefs: unknown;
}

// Pure: drops any pending recipient whose `result` preference is explicitly
// false. A user with no row, or no explicit preference, is treated as opted-in
// (per isOptedIn semantics) so default behavior is unchanged. Exported for
// unit testing.
export function filterResultOptIns(
  pending: PendingRecipient[],
  prefs: ResultPrefRow[],
): PendingRecipient[] {
  const optedOut = new Set(
    prefs.filter((p) => !isOptedIn(p.email_prefs, "result")).map((p) => p.user_id),
  );
  return pending.filter((p) => !optedOut.has(p.userId));
}

// Minimal translator shape so this stays decoupled from next-intl internals.
type Translator = (key: string, values?: Record<string, unknown>) => string;

// Builds the resolved, value-bearing copy for one recipient's email.
export function buildResultEmailStrings(
  t: Translator,
  opts: { displayName: string | null; earnedPoints: number },
): ResultEmailStrings {
  return {
    subject: t("subject", { points: opts.earnedPoints }),
    preheader: t("preheader"),
    eyebrow: t("eyebrow"),
    heading: opts.displayName ? t("heading", { name: opts.displayName }) : t("headingNoName"),
    intro: t("intro"),
    resultsLabel: t("resultsLabel"),
    standingLabel: t("standingLabel"),
    rankLabel: t("rankLabel"),
    playerLabel: t("playerLabel"),
    pointsLabel: t("pointsLabel"),
    exactLabel: t("exactLabel"),
    winnerGdLabel: t("winnerGdLabel"),
    youLabel: t("youLabel"),
    ptsSuffix: t("ptsSuffix"),
    outcomes: {
      exact: t("outcomes.exact"),
      winner_gd: t("outcomes.winner_gd"),
      winner: t("outcomes.winner"),
      miss: t("outcomes.miss"),
    },
    ctaLabel: t("ctaLabel"),
    footer: t("footer"),
  };
}

type AdminClient = ReturnType<typeof createAdminSupabaseClient>;

// One prepared message + the ledger rows to write iff Resend accepts it.
interface PreparedMessage {
  payload: {
    from: string;
    to: string[];
    subject: string;
    html: string;
    text: string;
  };
  rows: { match_id: string; user_id: string }[];
}

// Sends result-standing emails to every player whose standing changed on a
// match that is now final and not yet emailed. Idempotent across runs via the
// result_email_log ledger. No-ops when RESEND_API_KEY is unset. Per-recipient
// failures are logged and counted, never aborting the rest; ledger rows are
// written only for messages Resend accepted, so failures retry next run.
// Replace the display-name portion of a "Name <addr>" sender, keeping the
// verified-domain address from env intact.
function withFromName(emailFrom: string, name?: string): string {
  if (!name) return emailFrom;
  const m = emailFrom.match(/<([^>]+)>/);
  return m ? `${name} <${m[1]}>` : emailFrom;
}

// RFC 2606 / RFC 6761 reserved domains plus obviously-undeliverable ones. Resend
// rejects these synchronously ("use our testing email address instead of domains
// like example.com") and a single bad address fails the whole all-or-nothing
// batch — so drop them before send. There's nothing to retry, so callers count
// these as skipped, exactly like a missing address.
const UNDELIVERABLE_DOMAINS = new Set([
  "example.com",
  "example.org",
  "example.net",
]);
const UNDELIVERABLE_TLDS = new Set(["test", "example", "invalid", "localhost"]);

export function isSendableEmail(email: string): boolean {
  const at = email.indexOf("@");
  // Need exactly one @ with a local part and a domain on either side.
  if (at <= 0 || at === email.length - 1) return false;
  if (email.indexOf("@", at + 1) !== -1) return false;
  const domain = email.slice(at + 1).toLowerCase();
  if (!domain.includes(".") || domain.includes("..")) return false;
  if (UNDELIVERABLE_DOMAINS.has(domain)) return false;
  const tld = domain.slice(domain.lastIndexOf(".") + 1);
  if (UNDELIVERABLE_TLDS.has(tld)) return false;
  return true;
}

// Loads scored rows on matches that are currently final, flattened with the
// match details. When `matchId` is given the query is filtered to that one
// match at the data layer, so the force path can never widen beyond it.
async function loadScoredFinals(
  admin: AdminClient,
  matchId?: string,
): Promise<ScoredFinalRow[]> {
  let query = admin
    .from("scores")
    .select(
      "user_id, match_id, points, hit_type, matches!inner(home_team, away_team, home_score, away_score, status)",
    )
    .eq("matches.status", "final");
  if (matchId) query = query.eq("match_id", matchId);

  const { data, error } = await query;
  if (error) {
    throw new Error(`[result-emails] load scored finals: ${error.message}`);
  }

  return (data ?? []).map((r) => {
    const m = (r as { matches: Record<string, unknown> }).matches;
    return {
      user_id: r.user_id as string,
      match_id: r.match_id as string,
      points: r.points as number,
      hit_type: r.hit_type as HitType,
      home_team: m.home_team as string,
      away_team: m.away_team as string,
      home_score: (m.home_score as number | null) ?? 0,
      away_score: (m.away_score as number | null) ?? 0,
    };
  });
}

// Reads the result-email preference for the given affected user ids so opted-out
// players can be dropped before send. Returns one row per user that has a
// profile; absent users (treated as opted-in) simply don't appear.
async function loadResultPrefs(
  admin: AdminClient,
  userIds: string[],
): Promise<ResultPrefRow[]> {
  if (userIds.length === 0) return [];
  const { data, error } = await admin
    .from("profiles")
    .select("id, email_prefs")
    .in("id", userIds);
  if (error) {
    throw new Error(`[result-emails] load prefs: ${error.message}`);
  }
  return (data ?? []).map((r) => ({
    user_id: r.id as string,
    email_prefs: (r as { email_prefs: unknown }).email_prefs,
  }));
}

// Shared send tail: resolve email → render → batch-send → stamp ledger for a
// set of already-computed pending recipients. Both the cron path (ledger
// respected) and the admin force path (ledger ignored) funnel through here, so
// env-gating, batching, the dedupe stamp, and the summary shape live in one
// place. Per-recipient failures are logged and counted, never aborting the
// rest; ledger rows are written only for batches Resend accepted.
async function dispatchPending(
  admin: AdminClient,
  pending: PendingRecipient[],
  fromName?: string,
): Promise<DispatchSummary> {
  if (pending.length === 0) return { ...ZERO };

  const fromAddress = withFromName(env.emailFrom, fromName);

  // Standings + display names for affected users, one query off the board view.
  const userIds = pending.map((p) => p.userId);
  const { data: boardData, error: boardErr } = await admin
    .from("v_leaderboard_overall")
    .select("user_id, rank, total_points, exact_hits, winner_gd_hits, display_name")
    .in("user_id", userIds);
  if (boardErr) {
    throw new Error(`[result-emails] load standings: ${boardErr.message}`);
  }
  const board = new Map((boardData ?? []).map((b) => [b.user_id as string, b]));

  const t = (await getTranslations({
    locale: DEFAULT_LOCALE,
    namespace: "email",
  })) as Translator;
  const leaderboardUrl = `${env.siteUrl}${localePath(DEFAULT_LOCALE, "/leaderboard")}`;

  // Both entry points gate on env.resendApiKey before calling this tail.
  const resend = new Resend(env.resendApiKey!);
  let skipped = 0;

  // Resolve email + render per recipient. Recipients without a resolvable email
  // are skipped (not failed — there's nothing to retry).
  const prepared: PreparedMessage[] = [];
  for (const p of pending) {
    const email = await resolveEmail(admin, p.userId);
    // Skip missing or undeliverable (reserved-domain) addresses — both have
    // nothing to retry, and a reserved domain would fail the whole batch.
    if (!email || !isSendableEmail(email)) {
      skipped++;
      continue;
    }
    const b = board.get(p.userId);
    const data: ResultEmailData = {
      displayName: (b?.display_name as string | null) ?? null,
      standing: {
        rank: (b?.rank as number | null) ?? null,
        totalPoints: (b?.total_points as number | null) ?? 0,
        exactHits: (b?.exact_hits as number | null) ?? 0,
        winnerGdHits: (b?.winner_gd_hits as number | null) ?? 0,
      },
      matches: p.matches,
      strings: buildResultEmailStrings(t, {
        displayName: (b?.display_name as string | null) ?? null,
        earnedPoints: p.matches.reduce((sum, m) => sum + m.points, 0),
      }),
      leaderboardUrl,
    };
    const { subject, html, text } = renderResultEmail(data);
    prepared.push({
      payload: { from: fromAddress, to: [email], subject, html, text },
      rows: p.matchIds.map((match_id) => ({ match_id, user_id: p.userId })),
    });
  }

  let emailed = 0;
  let failed = 0;

  // Send in batches of ≤100. A batch is all-or-nothing: on success we record
  // the ledger rows for that batch; on error those recipients stay pending.
  for (let i = 0; i < prepared.length; i += RESEND_BATCH_LIMIT) {
    const chunk = prepared.slice(i, i + RESEND_BATCH_LIMIT);
    try {
      const { error } = await resend.batch.send(chunk.map((c) => c.payload));
      if (error) throw new Error(error.message ?? "resend batch error");

      const rows = chunk.flatMap((c) => c.rows);
      const { error: insErr } = await admin
        .from("result_email_log")
        .upsert(rows, { onConflict: "match_id,user_id", ignoreDuplicates: true });
      if (insErr) {
        // The email went out; failing to log it risks a duplicate next run, but
        // never a lost send. Surface it loudly rather than silently retrying.
        console.error("[result-emails] ledger write failed:", insErr.message);
      }
      emailed += chunk.length;
    } catch (err) {
      failed += chunk.length;
      console.error("[result-emails] batch send failed:", err);
    }
  }

  console.log(`[result-emails] emailed=${emailed} failed=${failed} skipped=${skipped}`);
  return { emailed, failed, skipped };
}

// Cron path: emails every player whose standing changed on a now-final match
// not yet emailed. Idempotent across runs via the result_email_log ledger.
export async function dispatchResultEmails(
  fromName?: string,
): Promise<DispatchSummary> {
  const senderMisconfigured = warnIfSenderMisconfigured("dispatch");
  if (!env.resendApiKey) {
    console.log("[result-emails] RESEND_API_KEY unset — skipping dispatch");
    return { ...ZERO, ...(senderMisconfigured ? { senderMisconfigured } : {}) };
  }

  const admin = createAdminSupabaseClient();
  const scored = await loadScoredFinals(admin);

  const { data: ledgerData, error: ledgerErr } = await admin
    .from("result_email_log")
    .select("match_id, user_id");
  if (ledgerErr) {
    throw new Error(`[result-emails] load ledger: ${ledgerErr.message}`);
  }

  const pending = computePendingByUser(scored, ledgerData ?? []);
  // Drop players who opted out of result emails (no opt-out existed before this
  // change); absent/opted-in players are unaffected.
  const prefs = await loadResultPrefs(
    admin,
    pending.map((p) => p.userId),
  );
  const filtered = filterResultOptIns(pending, prefs);
  const summary = await dispatchPending(admin, filtered, fromName);
  return { ...summary, ...(senderMisconfigured ? { senderMisconfigured } : {}) };
}

// Admin force path: re-emails every scored player of ONE final match,
// intentionally ignoring the dedupe ledger (ledger treated as empty) so an
// admin can repair a bad or missing send. Scoped to `matchId` at the query
// layer; re-stamps the ledger after a successful send so the cron stays
// at-most-once afterward. Shares all env-gating/batching/summary behavior with
// the cron path.
export async function forceDispatchResultEmails(
  matchId: string,
  fromName?: string,
): Promise<DispatchSummary> {
  const senderMisconfigured = warnIfSenderMisconfigured("force dispatch");
  if (!env.resendApiKey) {
    console.log("[result-emails] RESEND_API_KEY unset — skipping force dispatch");
    return { ...ZERO, ...(senderMisconfigured ? { senderMisconfigured } : {}) };
  }

  const admin = createAdminSupabaseClient();
  const scored = await loadScoredFinals(admin, matchId);
  // Empty ledger → every scored recipient of this match is pending.
  const pending = computePendingByUser(scored, []);
  // Honor the result opt-out even on the admin re-send path.
  const prefs = await loadResultPrefs(
    admin,
    pending.map((p) => p.userId),
  );
  const filtered = filterResultOptIns(pending, prefs);
  const summary = await dispatchPending(admin, filtered, fromName);
  return { ...summary, ...(senderMisconfigured ? { senderMisconfigured } : {}) };
}

// Player emails live only in auth.users — reachable via the service-role admin
// client. Returns null (→ skip) on any error or missing address.
async function resolveEmail(admin: AdminClient, userId: string): Promise<string | null> {
  try {
    const { data, error } = await admin.auth.admin.getUserById(userId);
    if (error) {
      console.error(`[result-emails] getUserById ${userId} failed:`, error.message);
      return null;
    }
    return data.user?.email ?? null;
  } catch (err) {
    console.error(`[result-emails] getUserById ${userId} threw:`, err);
    return null;
  }
}
