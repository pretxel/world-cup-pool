import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { availableProviders, runSync } from "@/lib/result-sync/core";
import { syncLiveEvents } from "@/lib/result-sync/events";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import {
  dispatchResultEmails,
  dispatchStandingChangedPush,
} from "@/lib/notifications/result-emails";
import { captureRankSnapshot } from "@/lib/notifications/rank-snapshot";
import { getActiveBranding } from "@/lib/competition";
import { recordRun } from "@/lib/operations/record-run";
import { isOperationEnabled } from "@/lib/operations/settings";
import { generatePendingSummaries } from "@/lib/matches/match-summary";
import { generatePendingImagePrompts } from "@/lib/matches/match-image-prompt";
import { requestPendingRenders } from "@/lib/matches/match-image-render";

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
  if (!(await isOperationEnabled("sync_matches"))) return skipped("disabled");

  // A missing FOOTBALL_DATA_TOKEN only skips the primary provider; the run
  // proceeds on whatever sources remain. Nothing available → degrade cleanly.
  if (availableProviders().length === 0) return skipped("missing-env");

  // Record one operation_runs row for this execution. A thrown runSync is
  // recorded (status='error') and RE-THROWN, so the route still 500s exactly as
  // before. The recorded summary is the same object returned to the caller.
  const { summary: response } = await recordRun("sync_matches", "cron", async () => {
    // Snapshot every ranked player's current overall rank BEFORE runSync()
    // recomputes scores — this MUST run first, since after the recompute
    // v_leaderboard_overall reflects the new standing and the previous-rank
    // baseline (used to render "you moved up N to #X") would be lost. Isolated:
    // a failure is logged and never aborts the sync.
    try {
      await captureRankSnapshot(createAdminSupabaseClient());
    } catch (err) {
      console.error("[cron:sync-matches] rank snapshot failed:", err);
    }

    const summary = await runSync();

    // Ingest ESPN play-by-play for any match the sync left live. Isolated:
    // event ingestion is additive to the score/status writes, which have
    // already committed by here, and any failure is logged, never thrown.
    let events = 0;
    try {
      events = await syncLiveEvents(createAdminSupabaseClient());
    } catch (err) {
      console.error("[cron:sync-matches] event ingestion failed:", err);
    }

    // Email players whose standing changed on a match that just finalized.
    // Isolated: any failure is logged and never fails the sync — the sync's
    // score/match writes have already committed by here.
    let emailed = 0;
    try {
      const { emailFromName } = await getActiveBranding();
      const dispatch = await dispatchResultEmails(emailFromName);
      emailed = dispatch.emailed;
    } catch (err) {
      console.error("[cron:sync-matches] result-email dispatch failed:", err);
    }

    // Standing-changed Web Push rides the SAME finalize moment, reusing the
    // already-snapshotted rank delta. Isolated: any failure is logged and never
    // aborts the sync or the result-email send. No-ops when VAPID is unset.
    let pushed = 0;
    try {
      const push = await dispatchStandingChangedPush();
      pushed = push.pushed;
    } catch (err) {
      console.error("[cron:sync-matches] standing-changed push failed:", err);
    }

    // Generate AI recaps for matches that just went final. Isolated like the
    // steps above: score/match writes have already committed, and any failure
    // is logged, never thrown. No-ops when OPENROUTER_API_KEY is unset.
    let summaries = 0;
    try {
      const pass = await generatePendingSummaries(createAdminSupabaseClient());
      summaries = pass.generated;
    } catch (err) {
      console.error("[cron:sync-matches] summary generation failed:", err);
    }

    // Derive the comic image PROMPT for any active summary that has content but
    // no image_prompt yet. Runs AFTER the summary pass so it picks up summaries
    // created earlier in this same run. Isolated + no-ops without OpenRouter.
    let imagePrompts = 0;
    try {
      const pass = await generatePendingImagePrompts(createAdminSupabaseClient());
      imagePrompts = pass.generated;
    } catch (err) {
      console.error("[cron:sync-matches] image prompt generation failed:", err);
    }

    // Request the Leonardo RENDER for any active summary that now has a prompt
    // but no render row. Runs AFTER the prompt pass so it picks up prompts just
    // written. The render finalizes async via /api/callback-image. Isolated +
    // no-ops without LEONARDO_API_KEY.
    let renders = 0;
    try {
      const pass = await requestPendingRenders(createAdminSupabaseClient());
      renders = pass.requested;
    } catch (err) {
      console.error("[cron:sync-matches] image render request failed:", err);
    }

    return { ...summary, events, emailed, pushed, summaries, imagePrompts, renders };
  });

  console.log(`[cron:sync-matches] summary:`, JSON.stringify(response));
  return NextResponse.json(response);
}
