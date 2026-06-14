"use server";

import { z } from "zod";
import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { runSync } from "@/lib/result-sync/core";
import { forceDispatchResultEmails } from "@/lib/notifications/result-emails";
import {
  getManagedCompetition,
  assertMatchInManaged,
} from "@/lib/admin/managed-competition";
import { isLocale, localePath, DEFAULT_LOCALE } from "@/lib/i18n";

const resultSchema = z.object({
  match_id: z.string().uuid(),
  home_score: z
    .union([z.number().int().min(0).max(30), z.null()])
    .or(z.literal("").transform(() => null)),
  away_score: z
    .union([z.number().int().min(0).max(30), z.null()])
    .or(z.literal("").transform(() => null)),
  status: z.enum(["scheduled", "live", "final", "cancelled"]),
});

const kickoffField = z
  .string()
  .refine((s) => !Number.isNaN(Date.parse(s)), "Invalid timestamp")
  // The admin kickoff field is labelled "UTC ISO" and the app renders kickoff
  // in UTC throughout. A `datetime-local` input submits a zone-less
  // "YYYY-MM-DDTHH:mm"; parse it as UTC so the edit form's UTC-wall-clock
  // prefill round-trips losslessly on any server.
  .transform((s) => {
    const hasZone = /([zZ])|([+-]\d{2}:?\d{2})$/.test(s);
    return new Date(hasZone ? s : `${s}Z`).toISOString();
  });

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

// Public surfaces show the ACTIVE competition, so only revalidate them when the
// managed competition is the active one. The admin list is always revalidated.
function revalidateAfterMutation(managedIsActive: boolean, matchPath?: string) {
  revalidatePath("/admin/matches");
  if (!managedIsActive) return;
  if (matchPath) revalidatePath(matchPath);
  revalidatePath("/matches");
  revalidatePath("/my-picks");
  revalidatePath("/leaderboard");
  revalidateTag("leaderboard", "max");
}

export async function saveFixture(formData: FormData) {
  await assertAdmin();
  const managed = await getManagedCompetition();
  if (!managed) throw new Error("No competition to manage");

  const stageKeys = managed.format.stages.map((s) => s.key);
  const base = z.object({
    id: z.string().uuid().optional(),
    stage: z.string().refine((s) => stageKeys.includes(s), {
      message: "Stage is not valid for this competition",
    }),
    group_code: z
      .string()
      .trim()
      .optional()
      .nullable()
      .transform((v) => (v ? v.toUpperCase() : null)),
    home_team: z.string().trim().min(1),
    away_team: z.string().trim().min(1),
    kickoff_at: kickoffField,
    venue: z.string().trim().optional().nullable(),
  });

  const parsed = base.parse({
    id: (formData.get("id") as string) || undefined,
    stage: formData.get("stage"),
    group_code: (formData.get("group_code") as string) || null,
    home_team: formData.get("home_team"),
    away_team: formData.get("away_team"),
    kickoff_at: formData.get("kickoff_at"),
    venue: (formData.get("venue") as string) || null,
  });
  if (parsed.home_team === parsed.away_team) {
    throw new Error("Home and away teams must differ");
  }

  // Never trust a posted competition_id — the managed context is the authority.
  const postedComp = formData.get("competition_id");
  if (typeof postedComp === "string" && postedComp && postedComp !== managed.id) {
    throw new Error("Competition mismatch");
  }

  // Apply the format's group rule: require a matching code for group stages,
  // force NULL otherwise.
  const stageDef = managed.format.stages.find((s) => s.key === parsed.stage)!;
  let groupCode = parsed.group_code;
  if (stageDef.hasGroupCode && managed.format.groups.enabled) {
    const pattern = new RegExp(managed.format.groups.pattern, "i");
    if (!groupCode || !pattern.test(groupCode)) {
      throw new Error("Group code is invalid for this stage");
    }
  } else {
    groupCode = null;
  }

  const row = {
    stage: parsed.stage,
    group_code: groupCode,
    home_team: parsed.home_team,
    away_team: parsed.away_team,
    kickoff_at: parsed.kickoff_at,
    venue: parsed.venue ?? null,
    competition_id: managed.id,
  };

  const admin = createAdminSupabaseClient();
  if (parsed.id) {
    await assertMatchInManaged(admin, parsed.id, managed.id);
    const { error } = await admin.from("matches").update(row).eq("id", parsed.id);
    if (error) throw new Error(error.message);
  } else {
    if (new Date(parsed.kickoff_at).getTime() <= Date.now()) {
      throw new Error("Kickoff must be in the future for new fixtures");
    }
    const { error } = await admin.from("matches").insert(row);
    if (error) throw new Error(error.message);
  }

  revalidateAfterMutation(managed.is_active);
}

export async function setMatchResult(formData: FormData): Promise<void> {
  await assertAdmin();
  const managed = await getManagedCompetition();
  if (!managed) throw new Error("No competition to manage");

  const homeRaw = formData.get("home_score");
  const awayRaw = formData.get("away_score");
  const parsed = resultSchema.parse({
    match_id: formData.get("match_id"),
    home_score: homeRaw === "" || homeRaw == null ? null : Number(homeRaw),
    away_score: awayRaw === "" || awayRaw == null ? null : Number(awayRaw),
    status: formData.get("status") ?? "final",
  });

  const admin = createAdminSupabaseClient();
  await assertMatchInManaged(admin, parsed.match_id, managed.id);
  const { error } = await admin
    .from("matches")
    .update({
      home_score: parsed.home_score,
      away_score: parsed.away_score,
      status: parsed.status,
    })
    .eq("id", parsed.match_id);
  if (error) throw new Error(error.message);

  // Always recompute. The DB trigger short-circuits when no column actually
  // changed, so call the RPC explicitly to guarantee scores reflect state.
  const { error: rpcError } = await admin.rpc("compute_match_scores", {
    p_match_id: parsed.match_id,
  });
  if (rpcError) throw new Error(rpcError.message);

  revalidateAfterMutation(managed.is_active, `/matches/${parsed.match_id}`);
}

export async function forceRecompute(formData: FormData) {
  await assertAdmin();
  const managed = await getManagedCompetition();
  if (!managed) throw new Error("No competition to manage");
  const match_id = z.string().uuid().parse(formData.get("match_id"));

  const admin = createAdminSupabaseClient();
  await assertMatchInManaged(admin, match_id, managed.id);
  const { error } = await admin.rpc("compute_match_scores", { p_match_id: match_id });
  if (error) throw new Error(error.message);

  revalidateAfterMutation(managed.is_active);
}

// Human-triggered fallback for the daily cron: run the shared sync core on
// demand, scoped to the MANAGED competition so an admin can sync a non-active
// draft. The summary travels back through query params after the redirect.
export async function syncNow(formData: FormData): Promise<void> {
  await assertAdmin();
  const managed = await getManagedCompetition();
  if (!managed) throw new Error("No competition to manage");

  const rawLocale = formData.get("locale");
  const locale =
    typeof rawLocale === "string" && isLocale(rawLocale)
      ? rawLocale
      : DEFAULT_LOCALE;

  const summary = await runSync({ competitionId: managed.id });

  revalidateAfterMutation(managed.is_active);

  const params = new URLSearchParams({
    syncSource: summary.source,
    syncFetched: String(summary.fetched),
    syncMatched: String(summary.matched),
    syncFinal: String(summary.final),
    syncStale: String(summary.stale),
    syncStaleResolved: String(summary.staleResolved),
    syncErrors: String(summary.errors),
  });
  redirect(localePath(locale, `/admin/matches?${params.toString()}`));
}

// Admin force-resend of result emails for one final match. Re-emails the
// match's scored players regardless of the dedupe ledger (force path). Like
// syncNow, the dispatch summary travels back through query params after the
// redirect since the page is server-rendered.
export async function resendResultEmails(formData: FormData): Promise<void> {
  await assertAdmin();
  const managed = await getManagedCompetition();
  if (!managed) throw new Error("No competition to manage");
  const match_id = z.string().uuid().parse(formData.get("match_id"));

  const rawLocale = formData.get("locale");
  const locale =
    typeof rawLocale === "string" && isLocale(rawLocale)
      ? rawLocale
      : DEFAULT_LOCALE;

  const admin = createAdminSupabaseClient();
  await assertMatchInManaged(admin, match_id, managed.id);

  // Recipients only exist for final matches; re-check server-side even though
  // the UI only offers the control for finals.
  const { data: match, error } = await admin
    .from("matches")
    .select("status")
    .eq("id", match_id)
    .single();
  if (error) throw new Error(error.message);

  const params = new URLSearchParams({ resendMatchId: match_id });
  if (match?.status !== "final") {
    params.set("resendError", "notFinal");
    redirect(localePath(locale, `/admin/matches?${params.toString()}`));
  }

  const summary = await forceDispatchResultEmails(match_id);

  revalidateAfterMutation(managed.is_active);

  params.set("resendEmailed", String(summary.emailed));
  params.set("resendFailed", String(summary.failed));
  params.set("resendSkipped", String(summary.skipped));
  redirect(localePath(locale, `/admin/matches?${params.toString()}`));
}

export async function deleteMatch(formData: FormData) {
  await assertAdmin();
  const managed = await getManagedCompetition();
  if (!managed) throw new Error("No competition to manage");
  const id = z.string().uuid().parse(formData.get("id"));

  const admin = createAdminSupabaseClient();
  await assertMatchInManaged(admin, id, managed.id);
  const { error } = await admin.from("matches").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidateAfterMutation(managed.is_active);
}
