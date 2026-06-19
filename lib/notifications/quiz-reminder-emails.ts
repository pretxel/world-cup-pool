import "server-only";
import { Resend } from "resend";
import { getTranslations } from "next-intl/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { DEFAULT_LOCALE, localePath } from "@/lib/i18n";
import { computeStreak } from "@/lib/quiz";
import { filterRecipientsAtLocalHour } from "@/lib/match-utils";
import { isOptedIn } from "@/lib/email-prefs";
import { checkEmailSenderConfig } from "./email-sender-config";
import { renderQuizReminderEmail, type QuizReminderEmailStrings } from "./quiz-reminder-template";

// Resend caps a single batch.send call at 100 messages.
const RESEND_BATCH_LIMIT = 100;

// Supabase/PostgREST returns a bounded page (default ~1000 rows) per request.
// For a feature that emails *every* eligible user, an unpaginated select would
// silently drop recipients past that cap — so the recipient loaders below page
// with a stable order until a short page signals the end.
const SUPABASE_PAGE_LIMIT = 1000;

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
    console.warn(`[quiz-reminders] dispatch: ${check.message}`);
  }
  return check.shouldWarn;
}

// A user eligible to be reminded, with the bits needed to render + unsubscribe.
export interface ReminderRecipient {
  userId: string;
  displayName: string | null;
  unsubscribeToken: string;
  // Validated IANA zone from profiles.timezone, or null when unknown/invalid.
  // Drives local-7am bucketing; null is bucketed as UTC.
  timezone: string | null;
}

// Pure: a user is pending when they have NOT answered today's question and have
// NOT already been sent today's reminder. Opt-out is excluded upstream at the
// query layer. Exported for unit testing.
export function computePendingReminders(
  profiles: ReminderRecipient[],
  answeredUserIds: string[],
  sentUserIds: string[],
): ReminderRecipient[] {
  const skip = new Set<string>([...answeredUserIds, ...sentUserIds]);
  return profiles.filter((p) => !skip.has(p.userId));
}

// Minimal translator shape so this stays decoupled from next-intl internals.
type Translator = (key: string, values?: Record<string, unknown>) => string;

// Builds the resolved, value-bearing copy for one recipient's email. A streak of
// 0/undefined yields a null `streakLine`, so the renderer omits the clause.
export function buildQuizReminderStrings(
  t: Translator,
  opts: { displayName: string | null; streak?: number },
): QuizReminderEmailStrings {
  return {
    subject: t("subject"),
    preheader: t("preheader"),
    eyebrow: t("eyebrow"),
    heading: opts.displayName ? t("heading", { name: opts.displayName }) : t("headingNoName"),
    intro: t("intro"),
    streakLine: opts.streak && opts.streak > 0 ? t("streakLine", { days: opts.streak }) : null,
    ctaLabel: t("ctaLabel"),
    footer: t("footer"),
    unsubscribeLabel: t("unsubscribeLabel"),
  };
}

type AdminClient = ReturnType<typeof createAdminSupabaseClient>;

// UTC YYYY-MM-DD — the key the quiz uses for "today's" active question.
function todayUtcDate(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

// Player emails live only in auth.users — reachable via the service-role admin
// client. Returns null (→ skip) on any error or missing address.
async function resolveEmail(admin: AdminClient, userId: string): Promise<string | null> {
  try {
    const { data, error } = await admin.auth.admin.getUserById(userId);
    if (error) {
      console.error(`[quiz-reminders] getUserById ${userId} failed:`, error.message);
      return null;
    }
    return data.user?.email ?? null;
  } catch (err) {
    console.error(`[quiz-reminders] getUserById ${userId} threw:`, err);
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

// Best-effort per-user current streak. One grouped query over the eligible set;
// any failure degrades to an empty map (emails still send, just without the
// streak hook). Never throws.
async function loadStreaks(admin: AdminClient, userIds: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (userIds.length === 0) return out;
  try {
    const { data, error } = await admin
      .from("quiz_answers")
      .select("user_id, answered_at")
      .in("user_id", userIds);
    if (error || !data) return out;
    const byUser = new Map<string, string[]>();
    for (const row of data) {
      const uid = row.user_id as string;
      const arr = byUser.get(uid) ?? [];
      arr.push(row.answered_at as string);
      byUser.set(uid, arr);
    }
    for (const [uid, stamps] of byUser) out.set(uid, computeStreak(stamps));
    return out;
  } catch (err) {
    console.error("[quiz-reminders] streak load failed:", err);
    return out;
  }
}

// Opted-in users, paged so the recipient set is complete past the page cap.
// Reads the single email_prefs jsonb source of truth and keeps anyone whose
// `quiz_reminder` preference is not explicitly false (absent/unknown is treated
// as opted-in).
async function loadOptedInProfiles(admin: AdminClient): Promise<ReminderRecipient[]> {
  const out: ReminderRecipient[] = [];
  for (let offset = 0; ; offset += SUPABASE_PAGE_LIMIT) {
    const { data, error } = await admin
      .from("profiles")
      .select("id, display_name, unsubscribe_token, email_prefs, timezone")
      .order("id", { ascending: true })
      .range(offset, offset + SUPABASE_PAGE_LIMIT - 1);
    if (error) throw new Error(`[quiz-reminders] load profiles: ${error.message}`);
    const page = data ?? [];
    for (const p of page) {
      if (!isOptedIn(p.email_prefs, "quiz_reminder")) continue;
      out.push({
        userId: p.id as string,
        displayName: (p.display_name as string | null) ?? null,
        unsubscribeToken: p.unsubscribe_token as string,
        timezone: (p.timezone as string | null) ?? null,
      });
    }
    if (page.length < SUPABASE_PAGE_LIMIT) break;
  }
  return out;
}

// All user_ids tied to today's question in `table` (quiz_answers /
// quiz_reminder_log), paged so the "already answered" and "already reminded"
// exclusion sets are never truncated either.
async function loadQuestionUserIds(
  admin: AdminClient,
  table: "quiz_answers" | "quiz_reminder_log",
  questionId: string,
): Promise<string[]> {
  const out: string[] = [];
  for (let offset = 0; ; offset += SUPABASE_PAGE_LIMIT) {
    const { data, error } = await admin
      .from(table)
      .select("user_id")
      .eq("question_id", questionId)
      .order("user_id", { ascending: true })
      .range(offset, offset + SUPABASE_PAGE_LIMIT - 1);
    if (error) throw new Error(`[quiz-reminders] load ${table}: ${error.message}`);
    const page = data ?? [];
    for (const r of page) out.push(r.user_id as string);
    if (page.length < SUPABASE_PAGE_LIMIT) break;
  }
  return out;
}

interface PreparedMessage {
  payload: {
    from: string;
    to: string[];
    subject: string;
    html: string;
    text: string;
    headers: Record<string, string>;
  };
  row: { user_id: string; question_id: string };
}

// Cron path: emails every opted-in user who has not answered today's active quiz
// question and has not already been reminded. Idempotent across runs via the
// quiz_reminder_log ledger. No-ops when RESEND_API_KEY is unset, or when there
// is no active question for the current UTC day. Per-recipient failures are
// logged and counted, never aborting the rest; ledger rows are written only for
// messages Resend accepted, so failures retry next run.
//
// `opts.force` (admin re-send path) bypasses the at-most-once ledger exclusion:
// it re-emails opted-in, still-unanswered users even if they were already
// reminded today. Every other rule still holds — opt-out and answered-today
// filters, the no-active-question / no-API-key no-ops, batching, fault
// isolation, and the ledger upsert (which stays idempotent so the cron never
// double-sends afterward).
export async function dispatchQuizReminders(
  fromName?: string,
  opts?: { force?: boolean },
): Promise<DispatchSummary> {
  const force = opts?.force ?? false;
  const senderMisconfigured = warnIfSenderMisconfigured();
  const flag = senderMisconfigured ? { senderMisconfigured } : {};
  if (!env.resendApiKey) {
    console.log("[quiz-reminders] RESEND_API_KEY unset — skipping dispatch");
    return { ...ZERO, ...flag };
  }

  const admin = createAdminSupabaseClient();

  // Today's active question. None → nothing to remind about.
  const today = todayUtcDate();
  const { data: question, error: qErr } = await admin
    .from("quiz_questions")
    .select("id")
    .eq("active_on", today)
    .maybeSingle();
  if (qErr) {
    throw new Error(`[quiz-reminders] load active question: ${qErr.message}`);
  }
  if (!question) {
    console.log(`[quiz-reminders] no active question for ${today} — nothing to send`);
    return { ...ZERO, ...flag };
  }
  const questionId = question.id as string;

  // Opted-in users, the users who already answered, and the users already
  // reminded — each loaded in full (paginated), then combined into the pending
  // set. Concurrent: independent reads. On the force path the "already reminded"
  // set is empty so the ledger no longer excludes anyone.
  const [profiles, answeredUserIds, sentUserIds] = await Promise.all([
    loadOptedInProfiles(admin),
    loadQuestionUserIds(admin, "quiz_answers", questionId),
    force
      ? Promise.resolve<string[]>([])
      : loadQuestionUserIds(admin, "quiz_reminder_log", questionId),
  ]);
  // Local-7am bucketing: on this hourly run, keep only the recipients for whom
  // it is currently ~7am in their own timezone (UTC fallback when unknown), so
  // the reminder lands when they are awake instead of one fixed UTC instant.
  // Applied before the answered/reminded exclusions; the force re-send path
  // still buckets, since it too should only fire at the user's local 7am.
  const bucketed = filterRecipientsAtLocalHour(profiles);
  const pending = computePendingReminders(bucketed, answeredUserIds, sentUserIds);
  if (pending.length === 0) {
    console.log(`[quiz-reminders] emailed=0 failed=0 skipped=0 (no pending)`);
    return { ...ZERO, ...flag };
  }

  const streaks = await loadStreaks(
    admin,
    pending.map((p) => p.userId),
  );

  const t = (await getTranslations({
    locale: DEFAULT_LOCALE,
    namespace: "quizEmail",
  })) as Translator;
  const quizUrl = `${env.siteUrl}${localePath(DEFAULT_LOCALE, "/quiz")}`;
  const fromAddress = withFromName(env.emailFrom, fromName);
  const resend = new Resend(env.resendApiKey);

  let skipped = 0;
  const prepared: PreparedMessage[] = [];
  for (const p of pending) {
    const email = await resolveEmail(admin, p.userId);
    if (!email) {
      skipped++;
      continue;
    }
    const unsubscribeUrl = `${env.siteUrl}/api/quiz-reminders/unsubscribe?token=${p.unsubscribeToken}`;
    const strings = buildQuizReminderStrings(t, {
      displayName: p.displayName,
      streak: streaks.get(p.userId),
    });
    const { subject, html, text } = renderQuizReminderEmail({
      strings,
      quizUrl,
      unsubscribeUrl,
    });
    prepared.push({
      payload: {
        from: fromAddress,
        to: [email],
        subject,
        html,
        text,
        headers: {
          "List-Unsubscribe": `<${unsubscribeUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      },
      row: { user_id: p.userId, question_id: questionId },
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

      const rows = chunk.map((c) => c.row);
      const { error: insErr } = await admin
        .from("quiz_reminder_log")
        .upsert(rows, { onConflict: "user_id,question_id", ignoreDuplicates: true });
      if (insErr) {
        // The email went out; failing to log it risks a duplicate next run, but
        // never a lost send. Surface it loudly rather than silently retrying.
        console.error("[quiz-reminders] ledger write failed:", insErr.message);
      }
      emailed += chunk.length;
    } catch (err) {
      failed += chunk.length;
      console.error("[quiz-reminders] batch send failed:", err);
    }
  }

  console.log(`[quiz-reminders] emailed=${emailed} failed=${failed} skipped=${skipped}`);
  return { emailed, failed, skipped, ...flag };
}
