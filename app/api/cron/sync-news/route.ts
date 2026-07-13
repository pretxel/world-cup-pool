import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { runNewsSync } from "@/lib/news-sync";
import { recordRun } from "@/lib/operations/record-run";
import { isOperationEnabled } from "@/lib/operations/settings";

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
  // 1. Auth: require Bearer ${CRON_SECRET}. In non-prod with no secret, allow.
  const auth = request.headers.get("authorization");
  const isProd = process.env.NODE_ENV === "production";
  if (env.cronSecret) {
    if (auth !== `Bearer ${env.cronSecret}`) return unauthorized();
  } else if (isProd) {
    return skipped("missing-env");
  }

  // Admin kill switch (operation_settings): a paused job's cron invocation is
  // a cheap no-op. Manual "Run now" bypasses this by design.
  if (!(await isOperationEnabled("sync_news"))) return skipped("disabled");

  // 2. Token gate. Skip (not error) when the upstream token is absent.
  if (!env.newsApiToken) return skipped("missing-env");

  // 3. Sync + record. A thrown step (upstream fetch / existing-news load) is
  //    recorded (status='error') and RE-THROWN, so the route still 500s as
  //    before. The recorded summary is what we return.
  const { summary } = await recordRun("sync_news", "cron", runNewsSync);

  console.log(`[cron:sync-news] summary:`, JSON.stringify(summary));
  return NextResponse.json(summary);
}
