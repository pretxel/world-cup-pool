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
  renderPlayoffScoreEmail,
  type PlayoffScoreMatch,
  type PlayoffScoreStrings,
} from "./playoff-score-template";

// Resend caps a single batch.send call at 100 messages.
const RESEND_BATCH_LIMIT = 100;
// Page size for the unpaginated profiles scan (mirrors comeback-emails).
const SUPABASE_PAGE_LIMIT = 1000;

const ZERO: DispatchSummary = { emailed: 0, failed: 0, skipped: 0 };

// Emits one clear warning when the production email sender is misconfigured and
// reports whether the run should carry the summary flag. Pure detection: never
// throws, never changes the resolved sender.
function warnIfSenderMisconfigured(context: string): boolean {
  const check = checkEmailSenderConfig();
  if (check.shouldWarn) {
    console.warn(`[playoff-score] ${context}: ${check.message}`);
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

// ---------------------------------------------------------------------------
// Pure helpers (exported for unit testing)
// ---------------------------------------------------------------------------

// True when the given instant falls on a Saturday in UTC. The cron is scheduled
// for Saturday, but the route re-checks this defensively. All of the product's
// crons key their windows off UTC, so "the competition reference day" is UTC.
export function isSaturdayUtc(now: Date = new Date()): boolean {
  return now.getUTCDay() === 6;
}

// The UTC calendar day the email is for (the day the cron fires), as
// "YYYY-MM-DD" to match the `date` column.
export function utcToday(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

// [startMs, endMs) epoch bounds for the UTC calendar day `date` ("YYYY-MM-DD").
// Epoch comparison (not string compare) so differing kickoff_at formats from the
// DB never trip a lexical mismatch.
export function utcDayWindow(date: string): { startMs: number; endMs: number } {
  const startMs = Date.parse(`${date}T00:00:00.000Z`);
  return { startMs, endMs: startMs + 24 * 60 * 60 * 1000 };
}

// One match row as loaded for selection.
export interface RawMatchRow {
  home_team: string;
  away_team: string;
  home_score: number | null;
  away_score: number | null;
  stage: string;
  status: string;
  kickoff_at: string;
}

// Pure: the day's finished knockout matches — `final` status, any stage other
// than `group`, kicked off within the UTC day window. Group-stage, non-final,
// and out-of-window rows are dropped. Exported for unit testing.
export function selectFinishedPlayoffMatches(
  rows: RawMatchRow[],
  window: { startMs: number; endMs: number },
): PlayoffScoreMatch[] {
  const out: PlayoffScoreMatch[] = [];
  for (const r of rows) {
    if (r.status !== "final") continue;
    if (r.stage === "group") continue;
    const ko = Date.parse(r.kickoff_at);
    if (Number.isNaN(ko) || ko < window.startMs || ko >= window.endMs) continue;
    out.push({
      home: r.home_team,
      away: r.away_team,
      homeScore: r.home_score,
      awayScore: r.away_score,
    });
  }
  return out;
}

// A player eligible to receive the email: a profile id + its stored prefs.
export interface RecipientProfile {
  user_id: string;
  email_prefs: unknown;
}

// Pure: from all profiles, drop users already sent today and users opted out of
// the results-digest family (this email shares that preference key — no new
// opt-out category). An absent/missing/malformed preference reads as opted-in.
// Exported for unit testing.
export function computePendingRecipients(
  profiles: RecipientProfile[],
  sentToday: { user_id: string }[],
): RecipientProfile[] {
  const sent = new Set(sentToday.map((r) => r.user_id));
  return profiles.filter(
    (p) => !sent.has(p.user_id) && isOptedIn(p.email_prefs, "results_digest"),
  );
}

// Minimal translator shape so this stays decoupled from next-intl internals.
type Translator = (key: string, values?: Record<string, unknown>) => string;

// Builds the resolved, value-bearing copy for the email.
export function buildPlayoffScoreStrings(t: Translator): PlayoffScoreStrings {
  return {
    subject: t("subject"),
    preheader: t("preheader"),
    eyebrow: t("eyebrow"),
    heading: t("heading"),
    intro: t("intro"),
    resultsLabel: t("resultsLabel"),
    scoreSeparator: t("scoreSeparator"),
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
      console.error(`[playoff-score] getUserById ${userId} failed:`, error.message);
      return null;
    }
    return data.user?.email ?? null;
  } catch (err) {
    console.error(`[playoff-score] getUserById ${userId} threw:`, err);
    return null;
  }
}

// The active competition's id, or null when none is active.
async function loadActiveCompetitionId(admin: AdminClient): Promise<string | null> {
  const { data, error } = await admin
    .from("competitions")
    .select("id")
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw new Error(`[playoff-score] load competition: ${error.message}`);
  return data?.id ?? null;
}

// Every match for the competition with `final` status — the candidate set the
// pure selector narrows to in-window knockout finals.
async function loadFinalMatches(admin: AdminClient, competitionId: string): Promise<RawMatchRow[]> {
  const { data, error } = await admin
    .from("matches")
    .select("home_team, away_team, home_score, away_score, stage, status, kickoff_at")
    .eq("competition_id", competitionId)
    .eq("status", "final");
  if (error) throw new Error(`[playoff-score] load matches: ${error.message}`);
  return (data ?? []) as RawMatchRow[];
}

// All profiles (id, email_prefs), paged so the recipient set is complete past
// the page cap. Opt-out is applied in the pure computation, not here.
async function loadProfiles(admin: AdminClient): Promise<RecipientProfile[]> {
  const out: RecipientProfile[] = [];
  for (let offset = 0; ; offset += SUPABASE_PAGE_LIMIT) {
    const { data, error } = await admin
      .from("profiles")
      .select("id, email_prefs")
      .order("id", { ascending: true })
      .range(offset, offset + SUPABASE_PAGE_LIMIT - 1);
    if (error) throw new Error(`[playoff-score] load profiles: ${error.message}`);
    const page = data ?? [];
    for (const p of page) {
      out.push({
        user_id: p.id as string,
        email_prefs: (p as { email_prefs: unknown }).email_prefs,
      });
    }
    if (page.length < SUPABASE_PAGE_LIMIT) break;
  }
  return out;
}

// Sends the weekly Saturday playoff-score email to every opted-in player who has
// not yet received today's email. The body is just the final scorelines of the
// day's finished knockout matches. Idempotent across runs via the
// playoff_score_email_log ledger. No-ops when RESEND_API_KEY is unset, when no
// competition is active, or when the day has no finished playoff matches.
// Per-batch failures are logged and counted, never aborting the rest; ledger
// rows are written only for batches Resend accepted, so failures retry next run.
export async function dispatchPlayoffScoreEmail(fromName?: string): Promise<DispatchSummary> {
  const senderMisconfigured = warnIfSenderMisconfigured("dispatch");
  const withFlag = (s: DispatchSummary): DispatchSummary =>
    senderMisconfigured ? { ...s, senderMisconfigured } : s;

  if (!env.resendApiKey) {
    console.log("[playoff-score] RESEND_API_KEY unset — skipping dispatch");
    return withFlag({ ...ZERO });
  }

  const admin = createAdminSupabaseClient();
  const digestDate = utcToday();
  const window = utcDayWindow(digestDate);

  const competitionId = await loadActiveCompetitionId(admin);
  if (!competitionId) {
    console.log("[playoff-score] no active competition — nothing to send");
    return withFlag({ ...ZERO });
  }

  const finals = await loadFinalMatches(admin, competitionId);
  const matches = selectFinishedPlayoffMatches(finals, window);
  if (matches.length === 0) {
    console.log("[playoff-score] no finished playoff matches today — nothing to send");
    return withFlag({ ...ZERO });
  }

  // Recipient universe = all opted-in players, minus those already sent today.
  const profiles = await loadProfiles(admin);
  const { data: sentRows, error: sentErr } = await admin
    .from("playoff_score_email_log")
    .select("user_id")
    .eq("digest_date", digestDate);
  if (sentErr) {
    throw new Error(`[playoff-score] load ledger: ${sentErr.message}`);
  }
  const pending = computePendingRecipients(profiles, sentRows ?? []);
  if (pending.length === 0) {
    console.log("[playoff-score] no pending recipients");
    return withFlag({ ...ZERO });
  }

  const t = (await getTranslations({
    locale: DEFAULT_LOCALE,
    namespace: "playoffScoreEmail",
  })) as Translator;
  const strings = buildPlayoffScoreStrings(t);
  const bracketUrl = `${env.siteUrl}${localePath(DEFAULT_LOCALE, "/bracket")}`;
  const { subject, html, text } = renderPlayoffScoreEmail({ matches, strings, bracketUrl });
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
        .from("playoff_score_email_log")
        .upsert(rows, { onConflict: "digest_date,user_id", ignoreDuplicates: true });
      if (insErr) {
        // The email went out; failing to log it risks a duplicate next run, but
        // never a lost send. Surface it loudly rather than silently retrying.
        console.error("[playoff-score] ledger write failed:", insErr.message);
      }
      emailed += chunk.length;
    } catch (err) {
      failed += chunk.length;
      console.error("[playoff-score] batch send failed:", err);
    }
  }

  console.log(`[playoff-score] emailed=${emailed} failed=${failed} skipped=${skipped}`);
  return withFlag({ emailed, failed, skipped });
}
