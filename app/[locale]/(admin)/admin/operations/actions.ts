"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { runSync } from "@/lib/result-sync/core";
import { dispatchResultEmails } from "@/lib/notifications/result-emails";
import { dispatchPredictionReminders } from "@/lib/notifications/prediction-reminder-emails";
import { dispatchQuizReminders } from "@/lib/notifications/quiz-reminder-emails";
import { dispatchResultsDigest } from "@/lib/notifications/results-digest-emails";
import { runNewsSync } from "@/lib/news-sync";
import { getActiveBranding } from "@/lib/competition";
import { recordRun, type OperationKind } from "@/lib/operations/record-run";
import { isLocale, localePath, DEFAULT_LOCALE } from "@/lib/i18n";

async function assertAdmin() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();
  if (!profile?.is_admin) throw new Error("Admin only");
}

function formLocale(formData: FormData) {
  const raw = formData.get("locale");
  return typeof raw === "string" && isLocale(raw) ? raw : DEFAULT_LOCALE;
}

// The four jobs' "Run now" bodies. Each reuses the SAME underlying library the
// daily cron calls, so a manual run can't drift from the scheduled one. The
// jobs' own idempotency ledgers (result_email_log / *_reminder_log) keep manual
// runs from double-sending; sync writes guard on status.
// Return type is `object` (not OperationSummary) so named interfaces like
// DispatchSummary/NewsSyncSummary — which lack an implicit index signature —
// still satisfy it; recordRun inspects the summary structurally.
const JOB: Record<OperationKind, () => Promise<object>> = {
  sync_matches: async () => {
    const summary = await runSync();
    let emailed = 0;
    try {
      const { emailFromName } = await getActiveBranding();
      emailed = (await dispatchResultEmails(emailFromName)).emailed;
    } catch (err) {
      console.error("[ops:sync_matches] result-email dispatch failed:", err);
    }
    return { ...summary, emailed };
  },
  sync_news: async () => runNewsSync(),
  prediction_reminders: async () => {
    const { emailFromName } = await getActiveBranding();
    return dispatchPredictionReminders(emailFromName);
  },
  quiz_reminders: async () => {
    const { emailFromName } = await getActiveBranding();
    return dispatchQuizReminders(emailFromName);
  },
  results_digest: async () => {
    const { emailFromName } = await getActiveBranding();
    return dispatchResultsDigest(emailFromName);
  },
};

// Shared trigger: assert admin, run the job under recordRun(kind, 'manual'), and
// redirect back to the overview with the outcome in query params (the page is
// server-rendered, same pattern as the matches page's syncNow). A job throw is
// caught here — it has already been recorded as status='error' inside recordRun
// — so a manual run never 500s the admin UI.
async function trigger(kind: OperationKind, formData: FormData): Promise<void> {
  await assertAdmin();
  const locale = formLocale(formData);

  let status: string;
  let summary: object | null = null;
  let error: string | null = null;
  try {
    const recorded = await recordRun(kind, "manual", JOB[kind]);
    status = recorded.status;
    summary = recorded.summary;
  } catch (err) {
    status = "error";
    error = err instanceof Error ? err.message : String(err);
  }

  revalidatePath("/admin/operations");

  const params = new URLSearchParams({
    view: "overview",
    ranKind: kind,
    ranStatus: status,
  });
  if (summary) params.set("ranSummary", JSON.stringify(summary));
  if (error) params.set("ranError", error.slice(0, 300));
  redirect(localePath(locale, `/admin/operations?${params.toString()}`));
}

export async function runSyncMatches(formData: FormData) {
  await trigger("sync_matches", formData);
}
export async function runSyncNews(formData: FormData) {
  await trigger("sync_news", formData);
}
export async function runPredictionReminders(formData: FormData) {
  await trigger("prediction_reminders", formData);
}
export async function runQuizReminders(formData: FormData) {
  await trigger("quiz_reminders", formData);
}
export async function runResultsDigest(formData: FormData) {
  await trigger("results_digest", formData);
}
