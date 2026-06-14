import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { dispatchPredictionReminders } from "@/lib/notifications/prediction-reminder-emails";
import { getActiveBranding } from "@/lib/competition";
import { recordRun } from "@/lib/operations/record-run";

// Emailing every eligible player can resolve many addresses + send several
// batches; give the function room beyond the default request budget.
export const maxDuration = 60;

function unauthorized() {
  return new NextResponse("unauthorized", { status: 401 });
}

function skipped(reason: string) {
  return new NextResponse(null, {
    status: 204,
    headers: { "x-skipped": reason },
  });
}

export async function GET(request: NextRequest) {
  // Auth: require Bearer ${CRON_SECRET}. In non-prod with no secret set, allow.
  const auth = request.headers.get("authorization");
  const isProd = process.env.NODE_ENV === "production";
  if (env.cronSecret) {
    if (auth !== `Bearer ${env.cronSecret}`) return unauthorized();
  } else if (isProd) {
    return skipped("missing-env");
  }

  // Dispatch is fully isolated: a failure is logged and surfaced as a zero
  // summary rather than a 500, so a flaky run never trips Vercel's cron alerting
  // into ret‑storming. recordRun captures every run; on a throw it records an
  // accurate status='error' row (and re-throws), which we catch here to keep the
  // unchanged 200/zero-summary response.
  let summary = { emailed: 0, failed: 0, skipped: 0 };
  try {
    const recorded = await recordRun("prediction_reminders", "cron", async () => {
      const { emailFromName } = await getActiveBranding();
      return await dispatchPredictionReminders(emailFromName);
    });
    summary = recorded.summary;
  } catch (err) {
    console.error("[cron:prediction-reminders] dispatch failed:", err);
  }

  console.log(`[cron:prediction-reminders] summary:`, JSON.stringify(summary));
  return NextResponse.json(summary);
}
