import "server-only";
import { Resend } from "resend";
import { getTranslations } from "next-intl/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { DEFAULT_LOCALE, localePath, type Locale } from "@/lib/i18n";
import { isOptedIn } from "@/lib/email-prefs";
import { BASE_POINTS, STAGE_POINT_MULTIPLIER } from "@/lib/scoring";
import {
  getStageLabel,
  parseFormatConfig,
  type CompetitionFormat,
} from "@/lib/competition-schema";
import { checkEmailSenderConfig } from "./email-sender-config";
import { isSendableEmail, type DispatchSummary } from "./result-emails";
import {
  renderScoreRulesEmail,
  type ScoreRulesPhaseRow,
  type ScoreRulesStrings,
} from "./score-rules-template";

// Resend caps a single batch.send call at 100 messages.
const RESEND_BATCH_LIMIT = 100;
// Page size for the unpaginated profiles scan (mirrors playoff-score-emails).
const SUPABASE_PAGE_LIMIT = 1000;

// Phases shown in the announcement, ascending stakes — same order and source as
// components/scoring-explainer.tsx so the email matches the landing page.
const STAGE_ORDER = ["group", "r32", "r16", "qf", "sf", "final", "third"] as const;

const ZERO: DispatchSummary = { emailed: 0, failed: 0, skipped: 0 };

// Emits one clear warning when the production email sender is misconfigured and
// reports whether the run should carry the summary flag. Pure detection: never
// throws, never changes the resolved sender.
function warnIfSenderMisconfigured(context: string): boolean {
  const check = checkEmailSenderConfig();
  if (check.shouldWarn) {
    console.warn(`[score-rules] ${context}: ${check.message}`);
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

// The per-phase points table derived from the shared scoring constants
// (BASE_POINTS × STAGE_POINT_MULTIPLIER), with localized stage labels from the
// active competition format. A null format (cold DB) falls back to stage keys.
export function buildScoreRulesPhases(
  format: CompetitionFormat | null,
  locale: Locale,
): ScoreRulesPhaseRow[] {
  return STAGE_ORDER.map((stage) => {
    const multiplier = STAGE_POINT_MULTIPLIER[stage] ?? 1;
    return {
      stageLabel: format ? getStageLabel(format, stage, locale) : stage,
      multiplier,
      exact: BASE_POINTS.exact * multiplier,
      winnerGd: BASE_POINTS.winner_gd * multiplier,
      winner: BASE_POINTS.winner * multiplier,
    };
  });
}

// A player eligible to receive the email: a profile id + its stored prefs.
export interface RecipientProfile {
  user_id: string;
  email_prefs: unknown;
}

// Pure: from all profiles, drop users already sent the announcement and users
// opted out of the results-digest family (this email shares that preference key
// — no new opt-out category). An absent/missing/malformed preference reads as
// opted-in. Exported for unit testing.
export function computePendingRecipients(
  profiles: RecipientProfile[],
  alreadySent: { user_id: string }[],
): RecipientProfile[] {
  const sent = new Set(alreadySent.map((r) => r.user_id));
  return profiles.filter(
    (p) => !sent.has(p.user_id) && isOptedIn(p.email_prefs, "results_digest"),
  );
}

// Minimal translator shape so this stays decoupled from next-intl internals.
type Translator = (key: string, values?: Record<string, unknown>) => string;

// Builds the resolved, value-bearing copy for the email.
export function buildScoreRulesStrings(t: Translator): ScoreRulesStrings {
  return {
    subject: t("subject"),
    preheader: t("preheader"),
    eyebrow: t("eyebrow"),
    heading: t("heading"),
    intro: t("intro"),
    tableLabel: t("tableLabel"),
    phaseHeader: t("phaseHeader"),
    multHeader: t("multHeader"),
    exactHeader: t("exactHeader"),
    winnerGdHeader: t("winnerGdHeader"),
    winnerHeader: t("winnerHeader"),
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
  rows: { user_id: string }[];
}

// Player emails live only in auth.users — reachable via the service-role admin
// client. Returns null (→ skip) on any error or missing address.
async function resolveEmail(admin: AdminClient, userId: string): Promise<string | null> {
  try {
    const { data, error } = await admin.auth.admin.getUserById(userId);
    if (error) {
      console.error(`[score-rules] getUserById ${userId} failed:`, error.message);
      return null;
    }
    return data.user?.email ?? null;
  } catch (err) {
    console.error(`[score-rules] getUserById ${userId} threw:`, err);
    return null;
  }
}

// The active competition's parsed format, or null when none is active.
async function loadActiveFormat(admin: AdminClient): Promise<CompetitionFormat | null> {
  const { data, error } = await admin
    .from("competitions")
    .select("format_config")
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw new Error(`[score-rules] load competition: ${error.message}`);
  if (!data) return null;
  try {
    return parseFormatConfig((data as { format_config: unknown }).format_config);
  } catch (err) {
    console.error("[score-rules] format parse failed — using stage keys:", err);
    return null;
  }
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
    if (error) throw new Error(`[score-rules] load profiles: ${error.message}`);
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

// Sends the one-off scoring-rules announcement to every opted-in player who has
// not yet received it. The body is the per-phase points table derived from the
// shared scoring constants. Idempotent across runs via the score_rules_email_log
// ledger (keyed by user — send-once). No-ops when RESEND_API_KEY is unset or
// when there are no pending recipients. Per-batch failures are logged and
// counted, never aborting the rest; ledger rows are written only for batches
// Resend accepted, so failures retry next run.
export async function dispatchScoreRulesEmail(fromName?: string): Promise<DispatchSummary> {
  const senderMisconfigured = warnIfSenderMisconfigured("dispatch");
  const withFlag = (s: DispatchSummary): DispatchSummary =>
    senderMisconfigured ? { ...s, senderMisconfigured } : s;

  if (!env.resendApiKey) {
    console.log("[score-rules] RESEND_API_KEY unset — skipping dispatch");
    return withFlag({ ...ZERO });
  }

  const admin = createAdminSupabaseClient();

  // Recipient universe = all opted-in players, minus those already sent.
  const profiles = await loadProfiles(admin);
  const { data: sentRows, error: sentErr } = await admin
    .from("score_rules_email_log")
    .select("user_id");
  if (sentErr) {
    throw new Error(`[score-rules] load ledger: ${sentErr.message}`);
  }
  const pending = computePendingRecipients(profiles, sentRows ?? []);
  if (pending.length === 0) {
    console.log("[score-rules] no pending recipients");
    return withFlag({ ...ZERO });
  }

  const format = await loadActiveFormat(admin);
  const phases = buildScoreRulesPhases(format, DEFAULT_LOCALE);

  const t = (await getTranslations({
    locale: DEFAULT_LOCALE,
    namespace: "scoreRulesEmail",
  })) as Translator;
  const strings = buildScoreRulesStrings(t);
  const ctaUrl = `${env.siteUrl}${localePath(DEFAULT_LOCALE, "/")}#stage-scoring`;
  const { subject, html, text } = renderScoreRulesEmail({ phases, strings, ctaUrl });
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
      rows: [{ user_id: r.user_id }],
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
        .from("score_rules_email_log")
        .upsert(rows, { onConflict: "user_id", ignoreDuplicates: true });
      if (insErr) {
        // The email went out; failing to log it risks a duplicate next run, but
        // never a lost send. Surface it loudly rather than silently retrying.
        console.error("[score-rules] ledger write failed:", insErr.message);
      }
      emailed += chunk.length;
    } catch (err) {
      failed += chunk.length;
      console.error("[score-rules] batch send failed:", err);
    }
  }

  console.log(`[score-rules] emailed=${emailed} failed=${failed} skipped=${skipped}`);
  return withFlag({ emailed, failed, skipped });
}
