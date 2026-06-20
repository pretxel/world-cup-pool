import "server-only";
import { Resend } from "resend";
import { getTranslations } from "next-intl/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { DEFAULT_LOCALE, localePath } from "@/lib/i18n";
import { isOptedIn } from "@/lib/email-prefs";
import { checkEmailSenderConfig } from "./email-sender-config";
import { isSendableEmail, type DispatchSummary } from "./result-emails";
import {
  renderResultsDigest,
  type DigestMover,
  type DigestTopRow,
  type ResultsDigestData,
  type ResultsDigestStrings,
} from "./results-digest-template";

// Resend caps a single batch.send call at 100 messages.
const RESEND_BATCH_LIMIT = 100;
// How many of the day's biggest movers to feature.
const MOVERS_LIMIT = 5;
// How many leaderboard rows make up the shared top section.
const TOP_LIMIT = 5;

const ZERO: DispatchSummary = { emailed: 0, failed: 0, skipped: 0 };

// Emits one clear warning when the production email sender is misconfigured and
// reports whether the run should carry the summary flag. Pure detection: never
// throws, never changes the resolved sender.
function warnIfSenderMisconfigured(context: string): boolean {
  const check = checkEmailSenderConfig();
  if (check.shouldWarn) {
    console.warn(`[results-digest] ${context}: ${check.message}`);
  }
  return check.shouldWarn;
}

// Replace the display-name portion of a "Name <addr>" sender, keeping the
// verified-domain address from env intact.
function withFromName(emailFrom: string, name?: string): string {
  if (!name) return emailFrom;
  const m = emailFrom.match(/<([^>]+)>/);
  return m ? `${name} <${m[1]}>` : emailFrom;
}

// A standings row off v_leaderboard_overall, the source of the top 5, the
// recipient set, and today's rank snapshot.
export interface BoardRow {
  user_id: string;
  rank: number;
  total_points: number;
  display_name: string | null;
}

// Day-over-day delta = today's rank minus the most recent prior snapshot's rank.
// Negative means the player climbed. Returned per user; absent when no prior
// snapshot row exists for that user.
export type DeltaByUser = Map<string, number>;

// Pure: compute each user's day-over-day rank delta from the prior snapshot.
// A user with no prior snapshot row is omitted (no baseline). Exported for
// unit testing.
export function computeDeltas(
  board: BoardRow[],
  prior: { user_id: string; rank: number }[],
): DeltaByUser {
  const priorRank = new Map(prior.map((p) => [p.user_id, p.rank]));
  const deltas: DeltaByUser = new Map();
  for (const row of board) {
    const before = priorRank.get(row.user_id);
    if (before == null) continue;
    deltas.set(row.user_id, row.rank - before);
  }
  return deltas;
}

// Pure: the day's biggest movers — the players whose rank changed the most in
// either direction, sorted by magnitude (largest first), capped at `limit`.
// Movers with a zero delta are excluded. Exported for unit testing.
export function computeMovers(
  board: BoardRow[],
  deltas: DeltaByUser,
  limit: number = MOVERS_LIMIT,
): DigestMover[] {
  const movers: DigestMover[] = [];
  for (const row of board) {
    const delta = deltas.get(row.user_id);
    if (delta == null || delta === 0) continue;
    movers.push({ displayName: row.display_name, rank: row.rank, delta });
  }
  movers.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta) || a.rank - b.rank);
  return movers.slice(0, limit);
}

// A player's stored digest preference, keyed by user id. Used to drop recipients
// who opted out of the results digest.
export interface DigestPrefRow {
  user_id: string;
  email_prefs: unknown;
}

// Pure: from the active board, drop users already sent today and users opted out
// of results_digest; an absent/missing/malformed preference reads as opted-in.
// Exported for unit testing.
export function computePendingRecipients(
  board: BoardRow[],
  sentToday: { user_id: string }[],
  prefs: DigestPrefRow[],
): BoardRow[] {
  const sent = new Set(sentToday.map((r) => r.user_id));
  const optedOut = new Set(
    prefs.filter((p) => !isOptedIn(p.email_prefs, "results_digest")).map((p) => p.user_id),
  );
  return board.filter((row) => !sent.has(row.user_id) && !optedOut.has(row.user_id));
}

// Minimal translator shape so this stays decoupled from next-intl internals.
type Translator = (key: string, values?: Record<string, unknown>) => string;

// Builds the resolved, value-bearing copy for one recipient's digest.
export function buildResultsDigestStrings(
  t: Translator,
  opts: { displayName: string | null },
): ResultsDigestStrings {
  return {
    subject: t("subject"),
    preheader: t("preheader"),
    eyebrow: t("eyebrow"),
    heading: opts.displayName ? t("heading", { name: opts.displayName }) : t("headingNoName"),
    intro: t("intro"),
    top5Label: t("top5Label"),
    rankLabel: t("rankLabel"),
    playerLabel: t("playerLabel"),
    pointsLabel: t("pointsLabel"),
    yourRankLabel: t("yourRankLabel"),
    yourPointsLabel: t("yourPointsLabel"),
    deltaUpLabel: t("deltaUpLabel"),
    deltaDownLabel: t("deltaDownLabel"),
    deltaFlatLabel: t("deltaFlatLabel"),
    moversLabel: t("moversLabel"),
    climbedLabel: t("climbedLabel"),
    droppedLabel: t("droppedLabel"),
    youLabel: t("youLabel"),
    ctaLabel: t("ctaLabel"),
    footer: t("footer"),
  };
}

type AdminClient = ReturnType<typeof createAdminSupabaseClient>;

// One prepared message + the ledger rows to write iff Resend accepts it.
interface PreparedMessage {
  payload: {
    from: string;
    replyTo: string;
    to: string[];
    subject: string;
    html: string;
    text: string;
  };
  rows: { digest_date: string; user_id: string }[];
}

// Player emails live only in auth.users — reachable via the service-role admin
// client. Returns null (→ skip) on any error or missing address.
async function resolveEmail(admin: AdminClient, userId: string): Promise<string | null> {
  try {
    const { data, error } = await admin.auth.admin.getUserById(userId);
    if (error) {
      console.error(`[results-digest] getUserById ${userId} failed:`, error.message);
      return null;
    }
    return data.user?.email ?? null;
  } catch (err) {
    console.error(`[results-digest] getUserById ${userId} threw:`, err);
    return null;
  }
}

// The UTC calendar day the digest is for (the day the cron fires). Kept as a
// "YYYY-MM-DD" string to match the `date` column.
function utcToday(): string {
  return new Date().toISOString().slice(0, 10);
}

// Loads the full overall standings, ordered by rank, dropping rows with a null
// user_id or rank (the view nullifies them defensively).
async function loadBoard(admin: AdminClient): Promise<BoardRow[]> {
  const { data, error } = await admin
    .from("v_leaderboard_overall")
    .select("user_id, rank, total_points, display_name")
    .order("rank", { ascending: true });
  if (error) {
    throw new Error(`[results-digest] load standings: ${error.message}`);
  }
  const rows: BoardRow[] = [];
  for (const r of data ?? []) {
    if (r.user_id == null || r.rank == null) continue;
    rows.push({
      user_id: r.user_id,
      rank: r.rank,
      total_points: r.total_points ?? 0,
      display_name: r.display_name ?? null,
    });
  }
  return rows;
}

// Sends the once-daily results digest to every active opted-in player who has
// not yet received today's digest. Idempotent across runs via the
// results_digest_log ledger. No-ops when RESEND_API_KEY is unset. Per-batch
// failures are logged and counted, never aborting the rest; ledger rows are
// written only for batches Resend accepted, so failures retry next run that day.
export async function dispatchResultsDigest(fromName?: string): Promise<DispatchSummary> {
  const senderMisconfigured = warnIfSenderMisconfigured("dispatch");
  if (!env.resendApiKey) {
    console.log("[results-digest] RESEND_API_KEY unset — skipping dispatch");
    return { ...ZERO, ...(senderMisconfigured ? { senderMisconfigured } : {}) };
  }

  const admin = createAdminSupabaseClient();
  const digestDate = utcToday();

  // Active players (in the view = at least one scored prediction; admins already
  // excluded). This is both the top-5 source and the recipient universe.
  const board = await loadBoard(admin);
  if (board.length === 0) {
    console.log("[results-digest] no active players — nothing to send");
    return { ...ZERO, ...(senderMisconfigured ? { senderMisconfigured } : {}) };
  }

  // Upsert today's snapshot so tomorrow has a baseline, then load the most
  // recent PRIOR snapshot (any date before today) to compute deltas + movers.
  const { error: snapErr } = await admin
    .from("leaderboard_rank_daily")
    .upsert(
      board.map((b) => ({ snapshot_date: digestDate, user_id: b.user_id, rank: b.rank })),
      { onConflict: "snapshot_date,user_id" },
    );
  if (snapErr) {
    // The snapshot is best-effort for tomorrow's baseline; a failure must not
    // abort today's send. Log loudly and continue.
    console.error("[results-digest] snapshot upsert failed:", snapErr.message);
  }

  const { data: priorRows, error: priorErr } = await admin
    .from("leaderboard_rank_daily")
    .select("user_id, rank, snapshot_date")
    .lt("snapshot_date", digestDate)
    .order("snapshot_date", { ascending: false });
  if (priorErr) {
    throw new Error(`[results-digest] load prior snapshot: ${priorErr.message}`);
  }
  // Most recent prior date only — rows are ordered desc, so the first date seen
  // is the baseline; keep one rank per user from that date.
  const baselineDate = priorRows && priorRows.length > 0 ? priorRows[0].snapshot_date : null;
  const prior =
    baselineDate != null
      ? (priorRows ?? [])
          .filter((r) => r.snapshot_date === baselineDate)
          .map((r) => ({ user_id: r.user_id, rank: r.rank }))
      : [];

  const hasBaseline = prior.length > 0;
  const deltas = computeDeltas(board, prior);
  const movers: DigestMover[] | null = hasBaseline ? computeMovers(board, deltas) : null;

  const top5: DigestTopRow[] = board.slice(0, TOP_LIMIT).map((b) => ({
    rank: b.rank,
    displayName: b.display_name,
    totalPoints: b.total_points,
  }));

  // Drop already-sent + opted-out recipients.
  const { data: sentRows, error: sentErr } = await admin
    .from("results_digest_log")
    .select("user_id")
    .eq("digest_date", digestDate);
  if (sentErr) {
    throw new Error(`[results-digest] load ledger: ${sentErr.message}`);
  }
  const { data: prefRows, error: prefErr } = await admin
    .from("profiles")
    .select("id, email_prefs")
    .in(
      "id",
      board.map((b) => b.user_id),
    );
  if (prefErr) {
    throw new Error(`[results-digest] load prefs: ${prefErr.message}`);
  }
  const prefs: DigestPrefRow[] = (prefRows ?? []).map((r) => ({
    user_id: r.id,
    email_prefs: (r as { email_prefs: unknown }).email_prefs,
  }));
  const pending = computePendingRecipients(board, sentRows ?? [], prefs);
  if (pending.length === 0) {
    console.log("[results-digest] no pending recipients");
    return { ...ZERO, ...(senderMisconfigured ? { senderMisconfigured } : {}) };
  }

  const t = (await getTranslations({
    locale: DEFAULT_LOCALE,
    namespace: "resultsDigest",
  })) as Translator;
  const leaderboardUrl = `${env.siteUrl}${localePath(DEFAULT_LOCALE, "/leaderboard")}`;
  const fromAddress = withFromName(env.emailFrom, fromName);
  const resend = new Resend(env.resendApiKey);

  let skipped = 0;
  const prepared: PreparedMessage[] = [];
  for (const r of pending) {
    const email = await resolveEmail(admin, r.user_id);
    if (!email || !isSendableEmail(email)) {
      skipped++;
      continue;
    }
    const data: ResultsDigestData = {
      displayName: r.display_name,
      top5,
      personal: {
        rank: r.rank,
        totalPoints: r.total_points,
        delta: hasBaseline ? (deltas.get(r.user_id) ?? null) : null,
      },
      movers,
      strings: buildResultsDigestStrings(t, { displayName: r.display_name }),
      leaderboardUrl,
    };
    const { subject, html, text } = renderResultsDigest(data);
    prepared.push({
      payload: { from: fromAddress, replyTo: env.emailReplyTo, to: [email], subject, html, text },
      rows: [{ digest_date: digestDate, user_id: r.user_id }],
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

      const rows = chunk.flatMap((c) => c.rows);
      const { error: insErr } = await admin
        .from("results_digest_log")
        .upsert(rows, { onConflict: "digest_date,user_id", ignoreDuplicates: true });
      if (insErr) {
        // The email went out; failing to log it risks a duplicate next run, but
        // never a lost send. Surface it loudly rather than silently retrying.
        console.error("[results-digest] ledger write failed:", insErr.message);
      }
      emailed += chunk.length;
    } catch (err) {
      failed += chunk.length;
      console.error("[results-digest] batch send failed:", err);
    }
  }

  console.log(`[results-digest] emailed=${emailed} failed=${failed} skipped=${skipped}`);
  return { emailed, failed, skipped, ...(senderMisconfigured ? { senderMisconfigured } : {}) };
}
