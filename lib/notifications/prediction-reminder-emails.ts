import "server-only";
import { Resend } from "resend";
import { getTranslations } from "next-intl/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { DEFAULT_LOCALE, localePath } from "@/lib/i18n";
import { filterRecipientsAtLocalHour, isConfirmedMatch, isLocked } from "@/lib/match-utils";
import { isOptedIn } from "@/lib/email-prefs";
import { checkEmailSenderConfig } from "./email-sender-config";
import {
  dispatchPushTargets,
  ZERO_PUSH,
  type PushDispatchSummary,
  type PushTarget,
} from "./push-dispatch";
import { isWebPushConfigured } from "./web-push";
import {
  renderPredictionReminderEmail,
  type PredictionReminderEmailStrings,
  type PredictionReminderMatch,
} from "./prediction-reminder-template";

// Resend caps a single batch.send call at 100 messages.
const RESEND_BATCH_LIMIT = 100;

// Supabase/PostgREST returns a bounded page (default ~1000 rows) per request.
// For a feature that emails *every* eligible player, an unpaginated select would
// silently drop recipients past that cap — so the loaders below page with a
// stable order until a short page signals the end.
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
    console.warn(`[prediction-reminders] dispatch: ${check.message}`);
  }
  return check.shouldWarn;
}

// A player eligible to be reminded, with the bits needed to render + unsubscribe.
export interface PredictionRecipient {
  userId: string;
  displayName: string | null;
  unsubscribeToken: string;
  // Validated IANA zone from profiles.timezone, or null when unknown/invalid.
  // Drives local-7am bucketing; null is bucketed as UTC.
  timezone: string | null;
}

// A confirmed, still-open match scheduled for today.
export interface TodayMatch {
  id: string;
  home_team: string;
  away_team: string;
  kickoff_at: string;
}

// One player plus the matches they still need to predict today.
export interface PendingPlayer {
  recipient: PredictionRecipient;
  matches: TodayMatch[];
}

// Pure: for each opted-in player not already reminded today, the today-matches
// they have not yet predicted. Players with nothing pending are dropped, so the
// result is exactly the set to email. Exported for unit testing.
export function computePendingPredictionReminders(
  recipients: PredictionRecipient[],
  todayMatches: TodayMatch[],
  predictions: { user_id: string; match_id: string }[],
  remindedUserIds: string[],
): PendingPlayer[] {
  const reminded = new Set(remindedUserIds);
  const predictedByUser = new Map<string, Set<string>>();
  for (const p of predictions) {
    const set = predictedByUser.get(p.user_id) ?? new Set<string>();
    set.add(p.match_id);
    predictedByUser.set(p.user_id, set);
  }
  const out: PendingPlayer[] = [];
  for (const recipient of recipients) {
    if (reminded.has(recipient.userId)) continue;
    const predicted = predictedByUser.get(recipient.userId);
    const matches = predicted
      ? todayMatches.filter((m) => !predicted.has(m.id))
      : todayMatches;
    if (matches.length > 0) out.push({ recipient, matches });
  }
  return out;
}

// Minimal translator shape so this stays decoupled from next-intl internals.
type Translator = (key: string, values?: Record<string, unknown>) => string;

// Builds the resolved, value-bearing copy shared by every recipient's email. The
// per-recipient heading is the only name-dependent string. Exported for testing.
export function buildPredictionReminderStrings(
  t: Translator,
  opts: { displayName: string | null },
): PredictionReminderEmailStrings {
  return {
    subject: t("subject"),
    preheader: t("preheader"),
    eyebrow: t("eyebrow"),
    heading: opts.displayName ? t("heading", { name: opts.displayName }) : t("headingNoName"),
    intro: t("intro"),
    listLabel: t("listLabel"),
    vs: t("vs"),
    ctaLabel: t("ctaLabel"),
    footer: t("footer"),
    unsubscribeLabel: t("unsubscribeLabel"),
  };
}

type AdminClient = ReturnType<typeof createAdminSupabaseClient>;

// UTC YYYY-MM-DD — the day key used for the ledger and the "today" window.
function todayUtcDate(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

// [startInclusive, endExclusive) ISO bounds for the UTC calendar day `date`.
function utcDayWindow(date: string): { start: string; end: string } {
  const start = new Date(`${date}T00:00:00.000Z`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start: start.toISOString(), end: end.toISOString() };
}

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
      console.error(`[prediction-reminders] getUserById ${userId} failed:`, error.message);
      return null;
    }
    return data.user?.email ?? null;
  } catch (err) {
    console.error(`[prediction-reminders] getUserById ${userId} threw:`, err);
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

// Opted-in players, paged so the recipient set is complete past the page cap.
// Reads the single email_prefs jsonb source of truth and keeps anyone whose
// `prediction_reminder` preference is not explicitly false (absent/unknown is
// treated as opted-in).
async function loadOptedInProfiles(admin: AdminClient): Promise<PredictionRecipient[]> {
  const out: PredictionRecipient[] = [];
  for (let offset = 0; ; offset += SUPABASE_PAGE_LIMIT) {
    const { data, error } = await admin
      .from("profiles")
      .select("id, display_name, unsubscribe_token, email_prefs, timezone")
      .order("id", { ascending: true })
      .range(offset, offset + SUPABASE_PAGE_LIMIT - 1);
    if (error) throw new Error(`[prediction-reminders] load profiles: ${error.message}`);
    const page = data ?? [];
    for (const p of page) {
      if (!isOptedIn(p.email_prefs, "prediction_reminder")) continue;
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

// Confirmed, still-open matches scheduled for today (UTC day window). Locked,
// live, final, cancelled, and placeholder fixtures are dropped here so the
// pending computation only ever sees actionable matches.
async function loadTodayOpenMatches(
  admin: AdminClient,
  window: { start: string; end: string },
): Promise<TodayMatch[]> {
  const out: TodayMatch[] = [];
  for (let offset = 0; ; offset += SUPABASE_PAGE_LIMIT) {
    const { data, error } = await admin
      .from("matches")
      .select("id, home_team, away_team, kickoff_at, status")
      .gte("kickoff_at", window.start)
      .lt("kickoff_at", window.end)
      .order("kickoff_at", { ascending: true })
      .range(offset, offset + SUPABASE_PAGE_LIMIT - 1);
    if (error) throw new Error(`[prediction-reminders] load matches: ${error.message}`);
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

// All (user_id, match_id) predictions for the given matches, paged so the
// "already predicted" exclusion is never truncated.
async function loadPredictionsForMatches(
  admin: AdminClient,
  matchIds: string[],
): Promise<{ user_id: string; match_id: string }[]> {
  const out: { user_id: string; match_id: string }[] = [];
  if (matchIds.length === 0) return out;
  for (let offset = 0; ; offset += SUPABASE_PAGE_LIMIT) {
    const { data, error } = await admin
      .from("predictions")
      .select("user_id, match_id")
      .in("match_id", matchIds)
      .order("id", { ascending: true })
      .range(offset, offset + SUPABASE_PAGE_LIMIT - 1);
    if (error) throw new Error(`[prediction-reminders] load predictions: ${error.message}`);
    const page = data ?? [];
    for (const r of page) {
      out.push({ user_id: r.user_id as string, match_id: r.match_id as string });
    }
    if (page.length < SUPABASE_PAGE_LIMIT) break;
  }
  return out;
}

// User ids already reminded today, paged so the idempotency exclusion is never
// truncated either.
async function loadRemindedUserIds(admin: AdminClient, date: string): Promise<string[]> {
  const out: string[] = [];
  for (let offset = 0; ; offset += SUPABASE_PAGE_LIMIT) {
    const { data, error } = await admin
      .from("prediction_reminder_log")
      .select("user_id")
      .eq("reminder_date", date)
      .order("user_id", { ascending: true })
      .range(offset, offset + SUPABASE_PAGE_LIMIT - 1);
    if (error) throw new Error(`[prediction-reminders] load ledger: ${error.message}`);
    const page = data ?? [];
    for (const r of page) out.push(r.user_id as string);
    if (page.length < SUPABASE_PAGE_LIMIT) break;
  }
  return out;
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
  row: { user_id: string; reminder_date: string };
}

// Cron path: emails every opted-in player the confirmed, still-open matches
// scheduled for today that they have not yet predicted. Idempotent per player
// per UTC day via the prediction_reminder_log ledger. No-ops when RESEND_API_KEY
// is unset, or when no matches are scheduled for today. Per-recipient failures
// are logged and counted, never aborting the rest; ledger rows are written only
// for messages Resend accepted, so failures retry on a later run the same day.
export async function dispatchPredictionReminders(fromName?: string): Promise<DispatchSummary> {
  const senderMisconfigured = warnIfSenderMisconfigured();
  const flag = senderMisconfigured ? { senderMisconfigured } : {};
  if (!env.resendApiKey) {
    console.log("[prediction-reminders] RESEND_API_KEY unset — skipping dispatch");
    return { ...ZERO, ...flag };
  }

  const admin = createAdminSupabaseClient();

  const today = todayUtcDate();
  const window = utcDayWindow(today);

  // Today's actionable matches. None → nothing to remind about.
  const todayMatches = await loadTodayOpenMatches(admin, window);
  if (todayMatches.length === 0) {
    console.log(`[prediction-reminders] no open matches for ${today} — nothing to send`);
    return { ...ZERO, ...flag };
  }
  const matchIds = todayMatches.map((m) => m.id);

  // Opted-in players, predictions for today's matches, and players already
  // reminded today — each loaded in full (paginated), then combined into the
  // pending set. Concurrent: independent reads.
  const [profiles, predictions, remindedUserIds] = await Promise.all([
    loadOptedInProfiles(admin),
    loadPredictionsForMatches(admin, matchIds),
    loadRemindedUserIds(admin, today),
  ]);
  // Local-7am bucketing: on this hourly run, keep only the recipients for whom
  // it is currently ~7am in their own timezone (UTC fallback when unknown), so
  // the reminder lands when they are awake instead of one fixed UTC instant.
  const bucketed = filterRecipientsAtLocalHour(profiles);
  const pending = computePendingPredictionReminders(
    bucketed,
    todayMatches,
    predictions,
    remindedUserIds,
  );
  if (pending.length === 0) {
    console.log(`[prediction-reminders] emailed=0 failed=0 skipped=0 (no pending)`);
    return { ...ZERO, ...flag };
  }

  const t = (await getTranslations({
    locale: DEFAULT_LOCALE,
    namespace: "predictionEmail",
  })) as Translator;
  const predictionsUrl = `${env.siteUrl}${localePath(DEFAULT_LOCALE, "/matches?picks=needed")}`;
  const fromAddress = withFromName(env.emailFrom, fromName);
  const resend = new Resend(env.resendApiKey);

  let skipped = 0;
  const prepared: PreparedMessage[] = [];
  for (const { recipient, matches } of pending) {
    const email = await resolveEmail(admin, recipient.userId);
    if (!email) {
      skipped++;
      continue;
    }
    const unsubscribeUrl = `${env.siteUrl}/api/prediction-reminders/unsubscribe?token=${recipient.unsubscribeToken}`;
    const strings = buildPredictionReminderStrings(t, { displayName: recipient.displayName });
    const rows: PredictionReminderMatch[] = matches.map((m) => ({
      home: m.home_team,
      away: m.away_team,
      kickoffLabel: formatKickoffLabel(m.kickoff_at),
    }));
    const { subject, html, text } = renderPredictionReminderEmail({
      strings,
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
      row: { user_id: recipient.userId, reminder_date: today },
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
      const { error: insErr } = await admin
        .from("prediction_reminder_log")
        .upsert(rows, { onConflict: "user_id,reminder_date", ignoreDuplicates: true });
      if (insErr) {
        // The email went out; failing to log it risks a duplicate next run, but
        // never a lost send. Surface it loudly rather than silently retrying.
        console.error("[prediction-reminders] ledger write failed:", insErr.message);
      }
      emailed += chunk.length;
    } catch (err) {
      failed += chunk.length;
      console.error("[prediction-reminders] batch send failed:", err);
    }
  }

  console.log(`[prediction-reminders] emailed=${emailed} failed=${failed} skipped=${skipped}`);
  return { emailed, failed, skipped, ...flag };
}

// User ids already PUSHED today, from the sibling push ledger (independent of
// the email ledger so a player can be emailed-but-not-pushed and vice-versa).
async function loadPushedUserIds(admin: AdminClient, date: string): Promise<string[]> {
  const out: string[] = [];
  for (let offset = 0; ; offset += SUPABASE_PAGE_LIMIT) {
    const { data, error } = await admin
      .from("prediction_reminder_push_log")
      .select("user_id")
      .eq("reminder_date", date)
      .order("user_id", { ascending: true })
      .range(offset, offset + SUPABASE_PAGE_LIMIT - 1);
    if (error) throw new Error(`[prediction-reminders] load push ledger: ${error.message}`);
    const page = data ?? [];
    for (const r of page) out.push(r.user_id as string);
    if (page.length < SUPABASE_PAGE_LIMIT) break;
  }
  return out;
}

// Cron path (phase 2): sends a "matches need your pick today" Web Push to each
// pending, push-opted-in player who has a subscription, reusing the SAME
// pending set as the email path (computePendingPredictionReminders +
// filterRecipientsAtLocalHour) — the audience is not re-derived. Idempotent per
// player per UTC day via prediction_reminder_push_log (written only after a
// successful send). No-ops when VAPID is unset. Isolated by the caller: a
// failure here never affects the email send or the run summary.
export async function dispatchMatchNeededPush(): Promise<PushDispatchSummary> {
  if (!isWebPushConfigured()) {
    console.log("[prediction-reminders] VAPID unset — skipping push");
    return { ...ZERO_PUSH };
  }

  const admin = createAdminSupabaseClient();
  const today = todayUtcDate();
  const window = utcDayWindow(today);

  const todayMatches = await loadTodayOpenMatches(admin, window);
  if (todayMatches.length === 0) {
    return { ...ZERO_PUSH };
  }
  const matchIds = todayMatches.map((m) => m.id);

  const [profiles, predictions, pushedUserIds] = await Promise.all([
    loadOptedInProfiles(admin),
    loadPredictionsForMatches(admin, matchIds),
    loadPushedUserIds(admin, today),
  ]);
  // Same local-7am bucketing + pending computation as the email path; the push
  // ledger (pushedUserIds) is the only difference, so push and email dedupe
  // independently.
  const bucketed = filterRecipientsAtLocalHour(profiles);
  const pending = computePendingPredictionReminders(
    bucketed,
    todayMatches,
    predictions,
    pushedUserIds,
  );
  if (pending.length === 0) {
    return { ...ZERO_PUSH };
  }

  const t = (await getTranslations({
    locale: DEFAULT_LOCALE,
    namespace: "pushNotifications",
  })) as Translator;
  const url = `${env.siteUrl}${localePath(DEFAULT_LOCALE, "/matches?picks=needed")}`;

  const targets: PushTarget[] = pending.map(({ recipient, matches }) => ({
    userId: recipient.userId,
    payload: {
      title: t("matchNeeded.title"),
      body: t("matchNeeded.body", { count: matches.length }),
      url,
      tag: `match-needed-${today}`,
    },
  }));

  const summary = await dispatchPushTargets(admin, targets, async (userId) => {
    const { error } = await admin
      .from("prediction_reminder_push_log")
      .upsert(
        { user_id: userId, reminder_date: today },
        { onConflict: "user_id,reminder_date", ignoreDuplicates: true },
      );
    if (error) {
      console.error("[prediction-reminders] push ledger write failed:", error.message);
    }
  });

  console.log(
    `[prediction-reminders] push pushed=${summary.pushed} failed=${summary.failed} pruned=${summary.pruned} skipped=${summary.skipped}`,
  );
  return summary;
}
