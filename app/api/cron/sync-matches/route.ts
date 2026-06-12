import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { availableProviders, runSync } from "@/lib/result-sync/core";

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

  // A missing FOOTBALL_DATA_TOKEN only skips the primary provider; the run
  // proceeds on whatever sources remain. Nothing available → degrade cleanly.
  if (availableProviders().length === 0) return skipped("missing-env");

  const summary = await runSync();

  console.log(`[cron:sync-matches] summary:`, JSON.stringify(summary));
  return NextResponse.json(summary);
}
