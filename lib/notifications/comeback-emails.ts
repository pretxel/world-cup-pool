import "server-only";
import { Resend } from "resend";
import { getTranslations } from "next-intl/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { DEFAULT_LOCALE, localePath } from "@/lib/i18n";
import { isConfirmedMatch, isLocked } from "@/lib/match-utils";
import { isOptedIn } from "@/lib/email-prefs";
import { checkEmailSenderConfig } from "./email-sender-config";
import { isSendableEmail } from "./result-emails";
import {
  renderComebackEmail,
  type ComebackEmailMatch,
  type ComebackEmailStrings,
} from "./comeback-email-template";

// Resend caps a single batch.send call at 100 messages.
const RESEND_BATCH_LIMIT = 100;

// Supabase/PostgREST returns a bounded page (default ~1000 rows) per request.
// For a feature that emails *every* eligible player, an unpaginated select would
// silently drop recipients past that cap — so the loaders below page with a
// stable order until a short page signals the end.
const SUPABASE_PAGE_LIMIT = 1000;

// A player is "inactive" when their most recent pick is older than this many
// days; they are nudged at most once per cooldown window even if they stay
// inactive. Named so they can be tuned without a schema change.
export const INACTIVITY_DAYS = 5;
export const COOLDOWN_DAYS = 14;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

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
// throws, never changes the resolved sender.
function warnIfSenderMisconfigured(): boolean {
  const check = checkEmailSenderConfig();
  if (check.shouldWarn) {
    console.warn(`[comeback-emails] dispatch: ${check.message}`);
  }
  return check.shouldWarn;
}

// A profile considered for the comeback nudge, with the bits needed to render +
// unsubscribe + apply the opt-out.
export interface ComebackProfile {
  userId: string;
  displayName: string | null;
  unsubscribeToken: string;
  emailPrefs: unknown;
}

// A confirmed, still-pickable upcoming match.
export interface PickableMatch {
  id: string;
  home_team: string;
  away_team: string;
  kickoff_at: string;
}

// One inactive-and-actionable recipient: the profile, how many days since their
// last pick, and the next pickable matches to show them.
export interface ComebackRecipient {
  profile: ComebackProfile;
  daysSinceLastPick: number;
  matches: PickableMatch[];
}

// Pure: the recipient set is players who (a) have at least one prediction whose
// most-recent submitted_at is older than INACTIVITY_DAYS, (b) are not opted out
// of the `comeback` preference, (c) have no comeback_email_log row newer than
// COOLDOWN_DAYS, and (d) only when at least one pickable upcoming match exists.
// Players with zero predictions are excluded (welcome/onboarding territory).
// Exported for unit testing, mirroring computePendingPredictionReminders.
export function computePendingComebackEmails(
  profiles: ComebackProfile[],
  lastPickByUser: { user_id: string; last_submitted_at: string }[],
  pickableMatches: PickableMatch[],
  cooldownByUser: { user_id: string; sent_at: string }[],
  now: Date = new Date(),
): ComebackRecipient[] {
  // No actionable match anywhere → nobody gets a dead-end nudge.
  if (pickableMatches.length === 0) return [];

  const inactiveBefore = now.getTime() - INACTIVITY_DAYS * MS_PER_DAY;
  const cooldownAfter = now.getTime() - COOLDOWN_DAYS * MS_PER_DAY;

  const lastPick = new Map(lastPickByUser.map((r) => [r.user_id, r.last_submitted_at]));
  // Newest cooldown stamp per user.
  const newestCooldown = new Map<string, number>();
  for (const r of cooldownByUser) {
    const t = new Date(r.sent_at).getTime();
    const prev = newestCooldown.get(r.user_id);
    if (prev === undefined || t > prev) newestCooldown.set(r.user_id, t);
  }

  const out: ComebackRecipient[] = [];
  for (const profile of profiles) {
    const last = lastPick.get(profile.userId);
    // Zero predictions → never played, excluded.
    if (!last) continue;
    const lastMs = new Date(last).getTime();
    // Predicted within the threshold → recently active, suppressed.
    if (lastMs > inactiveBefore) continue;
    // Opted out of comeback emails.
    if (!isOptedIn(profile.emailPrefs, "comeback")) continue;
    // Within cooldown → already nudged recently.
    const cooled = newestCooldown.get(profile.userId);
    if (cooled !== undefined && cooled > cooldownAfter) continue;

    const daysSinceLastPick = Math.floor((now.getTime() - lastMs) / MS_PER_DAY);
    out.push({ profile, daysSinceLastPick, matches: pickableMatches });
  }
  return out;
}

// Minimal translator shape so this stays decoupled from next-intl internals.
type Translator = (key: string, values?: Record<string, unknown>) => string;

// Builds the resolved, value-bearing copy for one recipient's email. The
// name-, days-, and rank-dependent strings are interpolated here; the renderer
// stays pure. Exported for testing.
export function buildComebackEmailStrings(
  t: Translator,
  opts: {
    displayName: string | null;
    daysSinceLastPick: number;
    rank: number | null;
    totalPoints: number;
  },
): ComebackEmailStrings {
  return {
    subject: t("subject"),
    preheader: t("preheader"),
    eyebrow: t("eyebrow"),
    heading: opts.displayName ? t("heading", { name: opts.displayName }) : t("headingNoName"),
    intro: t("intro"),
    daysInactiveLabel: t("daysInactiveLabel", { days: opts.daysSinceLastPick }),
    rankLabel: opts.rank === null ? t("unrankedLabel") : t("rankLabel", { rank: opts.rank }),
    unrankedLabel: t("unrankedLabel"),
    pointsLabel: t("pointsLabel", { points: opts.totalPoints }),
    matchesLabel: t("matchesLabel"),
    vs: t("vs"),
    ctaLabel: t("ctaLabel"),
    footer: t("footer"),
    unsubscribeLabel: t("unsubscribeLabel"),
  };
}

type AdminClient = ReturnType<typeof createAdminSupabaseClient>;

// "12:00 UTC" — kickoff time formatted at a single reference zone. There is no
// per-recipient timezone in a cron, so the zone is shown explicitly.
export function formatKickoffLabel(iso: string): string {
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));
  return `${time} UTC`;
}

// Player emails live only in auth.users — reachable via the service-role admin
// client. Returns null (→ skip) on any error or missing address.
async function resolveEmail(admin: AdminClient, userId: string): Promise<string | null> {
  try {
    const { data, error } = await admin.auth.admin.getUserById(userId);
    if (error) {
      console.error(`[comeback-emails] getUserById ${userId} failed:`, error.message);
      return null;
    }
    return data.user?.email ?? null;
  } catch (err) {
    console.error(`[comeback-emails] getUserById ${userId} threw:`, err);
    return null;
  }
}

// Replace the display-name portion of a "Name <addr>" sender, keeping the
// verified-domain address from env intact.
function withFromName(emailFrom: string, name?: string): string {
  if (!name) return emailFrom;
  const m = emailFrom.match(/<([^>]+)>/);
  return m ? `${name} <${m[1]}>` : emailFrom;
}

// All profiles (id, display_name, unsubscribe_token, email_prefs), paged so the
// candidate set is complete past the page cap. The comeback opt-out is applied
// in the pure computation, not here, to keep the loader simple.
async function loadProfiles(admin: AdminClient): Promise<ComebackProfile[]> {
  const out: ComebackProfile[] = [];
  for (let offset = 0; ; offset += SUPABASE_PAGE_LIMIT) {
    const { data, error } = await admin
      .from("profiles")
      .select("id, display_name, unsubscribe_token, email_prefs")
      .order("id", { ascending: true })
      .range(offset, offset + SUPABASE_PAGE_LIMIT - 1);
    if (error) throw new Error(`[comeback-emails] load profiles: ${error.message}`);
    const page = data ?? [];
    for (const p of page) {
      out.push({
        userId: p.id as string,
        displayName: (p.display_name as string | null) ?? null,
        unsubscribeToken: p.unsubscribe_token as string,
        emailPrefs: (p as { email_prefs: unknown }).email_prefs,
      });
    }
    if (page.length < SUPABASE_PAGE_LIMIT) break;
  }
  return out;
}

// Each user's most-recent prediction instant, derived by paging every
// (user_id, submitted_at) and keeping the max per user. Paged so a churned
// player late in the table is never missed.
async function loadLastPickByUser(
  admin: AdminClient,
): Promise<{ user_id: string; last_submitted_at: string }[]> {
  const latest = new Map<string, string>();
  for (let offset = 0; ; offset += SUPABASE_PAGE_LIMIT) {
    const { data, error } = await admin
      .from("predictions")
      .select("user_id, submitted_at")
      .order("id", { ascending: true })
      .range(offset, offset + SUPABASE_PAGE_LIMIT - 1);
    if (error) throw new Error(`[comeback-emails] load predictions: ${error.message}`);
    const page = data ?? [];
    for (const r of page) {
      const userId = r.user_id as string;
      const submittedAt = r.submitted_at as string;
      const prev = latest.get(userId);
      if (prev === undefined || submittedAt > prev) latest.set(userId, submittedAt);
    }
    if (page.length < SUPABASE_PAGE_LIMIT) break;
  }
  return [...latest.entries()].map(([user_id, last_submitted_at]) => ({
    user_id,
    last_submitted_at,
  }));
}

// Confirmed, still-pickable upcoming matches (`isConfirmedMatch && !isLocked`),
// kickoff-ASC. Locked/live/final/cancelled/placeholder fixtures are dropped here
// so the pending computation only ever sees actionable matches. Bounded to the
// future window so we don't page the whole fixture history.
async function loadPickableMatches(admin: AdminClient): Promise<PickableMatch[]> {
  const out: PickableMatch[] = [];
  const nowIso = new Date().toISOString();
  for (let offset = 0; ; offset += SUPABASE_PAGE_LIMIT) {
    const { data, error } = await admin
      .from("matches")
      .select("id, home_team, away_team, kickoff_at, status")
      .gte("kickoff_at", nowIso)
      .order("kickoff_at", { ascending: true })
      .range(offset, offset + SUPABASE_PAGE_LIMIT - 1);
    if (error) throw new Error(`[comeback-emails] load matches: ${error.message}`);
    const page = data ?? [];
    for (const m of page) {
      const match = {
        id: m.id as string,
        home_team: m.home_team as string,
        away_team: m.away_team as string,
        kickoff_at: m.kickoff_at as string,
        status: m.status as string,
      };
      if (isConfirmedMatch(match) && !isLocked(match)) {
        out.push({
          id: match.id,
          home_team: match.home_team,
          away_team: match.away_team,
          kickoff_at: match.kickoff_at,
        });
      }
    }
    if (page.length < SUPABASE_PAGE_LIMIT) break;
  }
  return out;
}

// Every comeback cooldown stamp (user_id, sent_at), paged. The pure computation
// reduces these to the newest-per-user and applies the cooldown window.
async function loadCooldownLog(
  admin: AdminClient,
): Promise<{ user_id: string; sent_at: string }[]> {
  const out: { user_id: string; sent_at: string }[] = [];
  for (let offset = 0; ; offset += SUPABASE_PAGE_LIMIT) {
    const { data, error } = await admin
      .from("comeback_email_log")
      .select("user_id, sent_at")
      .order("user_id", { ascending: true })
      .range(offset, offset + SUPABASE_PAGE_LIMIT - 1);
    if (error) throw new Error(`[comeback-emails] load ledger: ${error.message}`);
    const page = data ?? [];
    for (const r of page) {
      out.push({ user_id: r.user_id as string, sent_at: r.sent_at as string });
    }
    if (page.length < SUPABASE_PAGE_LIMIT) break;
  }
  return out;
}

// Standings (rank, total_points) for the recipient ids, in one query off the
// leaderboard view. A recipient absent from the view renders as "unranked".
async function loadStandings(
  admin: AdminClient,
  userIds: string[],
): Promise<Map<string, { rank: number | null; totalPoints: number }>> {
  const board = new Map<string, { rank: number | null; totalPoints: number }>();
  if (userIds.length === 0) return board;
  const { data, error } = await admin
    .from("v_leaderboard_overall")
    .select("user_id, rank, total_points")
    .in("user_id", userIds);
  if (error) throw new Error(`[comeback-emails] load standings: ${error.message}`);
  for (const b of data ?? []) {
    board.set(b.user_id as string, {
      rank: (b.rank as number | null) ?? null,
      totalPoints: (b.total_points as number | null) ?? 0,
    });
  }
  return board;
}

interface PreparedMessage {
  payload: {
    from: string;
    replyTo: string;
    to: string[];
    subject: string;
    html: string;
    text: string;
    headers: Record<string, string>;
  };
  row: { user_id: string };
}

// Cron path: emails every inactive-but-actionable, opted-in, off-cooldown player
// their days-since-last-pick, current rank, and the next pickable matches.
// At-most-once-per-cooldown via the comeback_email_log ledger. No-ops when
// RESEND_API_KEY is unset, or when no pickable matches exist. Per-recipient
// failures are logged and counted, never aborting the rest; ledger rows are
// written only for batches Resend accepted, so failures retry on a later run.
export async function dispatchComebackEmails(fromName?: string): Promise<DispatchSummary> {
  const senderMisconfigured = warnIfSenderMisconfigured();
  const flag = senderMisconfigured ? { senderMisconfigured } : {};
  if (!env.resendApiKey) {
    console.log("[comeback-emails] RESEND_API_KEY unset — skipping dispatch");
    return { ...ZERO, ...flag };
  }

  const admin = createAdminSupabaseClient();

  // Actionable matches first: none → nobody gets a dead-end nudge.
  const pickableMatches = await loadPickableMatches(admin);
  if (pickableMatches.length === 0) {
    console.log("[comeback-emails] no pickable upcoming matches — nothing to send");
    return { ...ZERO, ...flag };
  }

  // Profiles, each user's last pick, and the cooldown ledger — each loaded in
  // full (paginated), then combined into the pending set. Concurrent: reads.
  const [profiles, lastPickByUser, cooldownByUser] = await Promise.all([
    loadProfiles(admin),
    loadLastPickByUser(admin),
    loadCooldownLog(admin),
  ]);

  const pending = computePendingComebackEmails(
    profiles,
    lastPickByUser,
    pickableMatches,
    cooldownByUser,
  );
  if (pending.length === 0) {
    console.log("[comeback-emails] emailed=0 failed=0 skipped=0 (no pending)");
    return { ...ZERO, ...flag };
  }

  const standings = await loadStandings(
    admin,
    pending.map((p) => p.profile.userId),
  );

  const t = (await getTranslations({
    locale: DEFAULT_LOCALE,
    namespace: "comebackEmail",
  })) as Translator;
  const predictionsUrl = `${env.siteUrl}${localePath(DEFAULT_LOCALE, "/matches?picks=needed")}`;
  const fromAddress = withFromName(env.emailFrom, fromName);
  const resend = new Resend(env.resendApiKey);

  let skipped = 0;
  const prepared: PreparedMessage[] = [];
  for (const recipient of pending) {
    const { profile } = recipient;
    const email = await resolveEmail(admin, profile.userId);
    // Skip missing or undeliverable (reserved-domain) addresses — both have
    // nothing to retry, and a reserved domain would fail the whole batch.
    if (!email || !isSendableEmail(email)) {
      skipped++;
      continue;
    }
    const standing = standings.get(profile.userId) ?? null;
    const rank = standing?.rank ?? null;
    const totalPoints = standing?.totalPoints ?? 0;
    const unsubscribeUrl = `${env.siteUrl}/api/comeback-emails/unsubscribe?token=${profile.unsubscribeToken}`;
    const strings = buildComebackEmailStrings(t, {
      displayName: profile.displayName,
      daysSinceLastPick: recipient.daysSinceLastPick,
      rank,
      totalPoints,
    });
    const rows: ComebackEmailMatch[] = recipient.matches.map((m) => ({
      home: m.home_team,
      away: m.away_team,
      kickoffLabel: formatKickoffLabel(m.kickoff_at),
    }));
    const { subject, html, text } = renderComebackEmail({
      strings,
      rank,
      totalPoints,
      matches: rows,
      predictionsUrl,
      unsubscribeUrl,
    });
    prepared.push({
      payload: {
        from: fromAddress,
        replyTo: env.emailReplyTo,
        to: [email],
        subject,
        html,
        text,
        headers: {
          "List-Unsubscribe": `<${unsubscribeUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      },
      row: { user_id: profile.userId },
    });
  }

  let emailed = 0;
  let failed = 0;

  // Send in batches of ≤100. A batch is all-or-nothing: on success we record the
  // ledger rows for that batch; on error those recipients stay pending.
  for (let i = 0; i < prepared.length; i += RESEND_BATCH_LIMIT) {
    const chunk = prepared.slice(i, i + RESEND_BATCH_LIMIT);
    try {
      const { error } = await resend.batch.send(chunk.map((c) => c.payload));
      if (error) throw new Error(error.message ?? "resend batch error");

      const rows = chunk.map((c) => c.row);
      const { error: insErr } = await admin.from("comeback_email_log").insert(rows);
      if (insErr) {
        // The email went out; failing to log it risks a duplicate next run, but
        // never a lost send. Surface it loudly rather than silently retrying.
        console.error("[comeback-emails] ledger write failed:", insErr.message);
      }
      emailed += chunk.length;
    } catch (err) {
      failed += chunk.length;
      console.error("[comeback-emails] batch send failed:", err);
    }
  }

  console.log(`[comeback-emails] emailed=${emailed} failed=${failed} skipped=${skipped}`);
  return { emailed, failed, skipped, ...flag };
}
