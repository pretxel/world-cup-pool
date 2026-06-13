import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { availableProviders, runSync } from "@/lib/result-sync/core";
import { dispatchResultEmails } from "@/lib/notifications/result-emails";

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

  // Email players whose standing changed on a match that just finalized.
  // Isolated: any failure is logged and never fails the sync — the sync's
  // score/match writes have already committed by here.
  let emailed = 0;
  try {
    const dispatch = await dispatchResultEmails();
    emailed = dispatch.emailed;
  } catch (err) {
    console.error("[cron:sync-matches] result-email dispatch failed:", err);
  }

  const response = { ...summary, emailed };
  console.log(`[cron:sync-matches] summary:`, JSON.stringify(response));
  return NextResponse.json(response);
}
