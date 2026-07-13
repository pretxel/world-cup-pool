import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { dispatchRecapDigest } from "@/lib/notifications/recap-digest-emails";
import { getActiveBranding } from "@/lib/competition";
import { recordRun } from "@/lib/operations/record-run";
import { isOperationEnabled } from "@/lib/operations/settings";

// Emailing every active player can resolve many addresses + send several
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

  // Admin kill switch (operation_settings): a paused job's cron invocation is
  // a cheap no-op. Manual "Run now" bypasses this by design.
  if (!(await isOperationEnabled("recap_digest"))) return skipped("disabled");

  // Dispatch is fully isolated: a failure is logged and surfaced as a zero
  // summary rather than a 500, so a flaky run never trips Vercel's cron alerting
  // into retry-storming. recordRun captures every run; on a throw it records an
  // accurate status='error' row (and re-throws), which we catch here to keep the
  // unchanged 200/zero-summary response.
  let summary = { emailed: 0, failed: 0, skipped: 0 };
  try {
    const recorded = await recordRun("recap_digest", "cron", async () => {
      const { emailFromName } = await getActiveBranding();
      return await dispatchRecapDigest(emailFromName);
    });
    summary = recorded.summary;
  } catch (err) {
    console.error("[cron:recap-digest] dispatch failed:", err);
  }

  console.log(`[cron:recap-digest] summary:`, JSON.stringify(summary));
  return NextResponse.json(summary);
}
