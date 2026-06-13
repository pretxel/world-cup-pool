import "server-only";
import { Resend } from "resend";
import { getTranslations } from "next-intl/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { DEFAULT_LOCALE, localePath } from "@/lib/i18n";
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
}

const ZERO: DispatchSummary = { emailed: 0, failed: 0, skipped: 0 };

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
export async function dispatchResultEmails(): Promise<DispatchSummary> {
  if (!env.resendApiKey) {
    console.log("[result-emails] RESEND_API_KEY unset — skipping dispatch");
    return { ...ZERO };
  }

  const admin = createAdminSupabaseClient();

  // Scored rows on matches that are currently final, with the match details.
  const { data: scoredData, error: scoredErr } = await admin
    .from("scores")
    .select(
      "user_id, match_id, points, hit_type, matches!inner(home_team, away_team, home_score, away_score, status)",
    )
    .eq("matches.status", "final");
  if (scoredErr) {
    throw new Error(`[result-emails] load scored finals: ${scoredErr.message}`);
  }

  const scored: ScoredFinalRow[] = (scoredData ?? []).map((r) => {
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

  const { data: ledgerData, error: ledgerErr } = await admin
    .from("result_email_log")
    .select("match_id, user_id");
  if (ledgerErr) {
    throw new Error(`[result-emails] load ledger: ${ledgerErr.message}`);
  }

  const pending = computePendingByUser(scored, ledgerData ?? []);
  if (pending.length === 0) return { ...ZERO };

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

  const resend = new Resend(env.resendApiKey);
  let skipped = 0;

  // Resolve email + render per recipient. Recipients without a resolvable email
  // are skipped (not failed — there's nothing to retry).
  const prepared: PreparedMessage[] = [];
  for (const p of pending) {
    const email = await resolveEmail(admin, p.userId);
    if (!email) {
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
      payload: { from: env.emailFrom, to: [email], subject, html, text },
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
