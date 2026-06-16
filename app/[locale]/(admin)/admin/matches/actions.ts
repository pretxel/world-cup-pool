"use server";

import { z } from "zod";
import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { runSync } from "@/lib/result-sync/core";
import { forceDispatchResultEmails } from "@/lib/notifications/result-emails";
import {
  generateMatchSummary,
  STYLE_PRESETS,
  type SummaryStyle,
} from "@/lib/matches/match-summary";
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

// Admin on-demand AI recap for one match. Validates admin + managed scope, then
// runs the shared generator (which itself requires `final` status and at least
// one match_event, and short-circuits when the OpenRouter key is unset). The
// outcome travels back per-match via query params after the redirect, mirroring
// resendResultEmails. The generator is idempotent, so a duplicate click reports
// "exists" rather than creating a second recap.
export async function summarizeMatch(formData: FormData): Promise<void> {
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

  const params = new URLSearchParams({ summaryMatchId: match_id });
  try {
    const result = await generateMatchSummary(admin, match_id);
    // "generated" on success, else the generator's skip reason (exists,
    // not-final, no-events, no-key, missing).
    params.set("summaryReason", result.generated ? "generated" : (result.reason ?? "error"));
  } catch (err) {
    // Never surface a server-error page for a recap failure — report inline.
    console.error("[admin:summarizeMatch] generation failed:", err);
    params.set("summaryReason", "error");
  }

  // A fresh recap surfaces on the public match page when the managed comp is active.
  revalidateAfterMutation(managed.is_active, `/matches/${match_id}`);
  redirect(localePath(locale, `/admin/matches?${params.toString()}`));
}

// --- Recap versioning (admin fixture detail page) ----------------------------

const STYLE_KEY_VALUES = ["neutral", "dramatic", "tactical", "concise", "custom"] as const;
const MAX_STYLE_INSTRUCTION = 500;

const regenerateSchema = z
  .object({
    match_id: z.string().uuid(),
    style_key: z.enum(STYLE_KEY_VALUES),
    style_instruction: z.string().trim().max(MAX_STYLE_INSTRUCTION).optional(),
  })
  .refine((v) => v.style_key !== "custom" || !!v.style_instruction, {
    message: "A custom style needs an instruction",
    path: ["style_instruction"],
  });

const versionActionSchema = z.object({
  summary_id: z.string().uuid(),
  match_id: z.string().uuid(),
});

// Map the posted style choice to the exact instruction injected + stored. Preset
// fragments come from STYLE_PRESETS; a `custom` style carries the admin's text.
function resolveStyle(
  styleKey: (typeof STYLE_KEY_VALUES)[number],
  instruction: string | undefined,
): SummaryStyle {
  if (styleKey === "custom") {
    return { key: "custom", instruction: (instruction ?? "").trim() };
  }
  const preset = STYLE_PRESETS[styleKey] ?? "";
  return { key: styleKey, instruction: preset.length > 0 ? preset : null };
}

function localeFrom(formData: FormData) {
  const raw = formData.get("locale");
  return typeof raw === "string" && isLocale(raw) ? raw : DEFAULT_LOCALE;
}

// Admin styled regeneration from the fixture detail page. Always inserts a new
// NON-active draft version (the public view is unchanged until the admin
// activates it). Outcome travels back via query params after the redirect.
export async function regenerateMatchSummary(formData: FormData): Promise<void> {
  await assertAdmin();
  const managed = await getManagedCompetition();
  if (!managed) throw new Error("No competition to manage");
  const locale = localeFrom(formData);

  const parsed = regenerateSchema.parse({
    match_id: formData.get("match_id"),
    style_key: formData.get("style_key"),
    style_instruction: (formData.get("style_instruction") as string) || undefined,
  });

  const admin = createAdminSupabaseClient();
  await assertMatchInManaged(admin, parsed.match_id, managed.id);

  const style = resolveStyle(parsed.style_key, parsed.style_instruction);

  const params = new URLSearchParams({ regenMatchId: parsed.match_id });
  try {
    const result = await generateMatchSummary(admin, parsed.match_id, {
      mode: "regenerate",
      style,
    });
    // "generated" on success, else the generator's skip reason
    // (not-final, no-events, no-key, missing).
    params.set("regenResult", result.generated ? "generated" : (result.reason ?? "error"));
  } catch (err) {
    console.error("[admin:regenerateMatchSummary] generation failed:", err);
    params.set("regenResult", "error");
  }

  // A draft does not change the public view; revalidate the admin surfaces.
  revalidateAfterMutation(managed.is_active);
  redirect(localePath(locale, `/admin/matches/${parsed.match_id}?${params.toString()}`));
}

// Publish a chosen recap version: make it the single active version for its
// match. Deactivate-all-then-activate-one so a crash between the two updates
// leaves the match with no active version (recap hidden), never two.
export async function setActiveSummaryVersion(formData: FormData): Promise<void> {
  await assertAdmin();
  const managed = await getManagedCompetition();
  if (!managed) throw new Error("No competition to manage");
  const locale = localeFrom(formData);

  const parsed = versionActionSchema.parse({
    summary_id: formData.get("summary_id"),
    match_id: formData.get("match_id"),
  });

  const admin = createAdminSupabaseClient();
  await assertMatchInManaged(admin, parsed.match_id, managed.id);

  const params = new URLSearchParams({ activateSummaryId: parsed.summary_id });
  try {
    // Don't trust the posted summary_id — confirm it belongs to this match.
    const { data: version } = await admin
      .from("match_summaries")
      .select("id, match_id")
      .eq("id", parsed.summary_id)
      .maybeSingle();
    if (!version || version.match_id !== parsed.match_id) {
      params.set("activateResult", "error");
    } else {
      const { error: deErr } = await admin
        .from("match_summaries")
        .update({ is_active: false })
        .eq("match_id", parsed.match_id);
      if (deErr) throw new Error(deErr.message);
      const { error: actErr } = await admin
        .from("match_summaries")
        .update({ is_active: true })
        .eq("id", parsed.summary_id);
      if (actErr) throw new Error(actErr.message);
      params.set("activateResult", "activated");
    }
  } catch (err) {
    console.error("[admin:setActiveSummaryVersion] failed:", err);
    params.set("activateResult", "error");
  }

  // The newly active version surfaces publicly when the managed comp is active.
  revalidateAfterMutation(managed.is_active, `/matches/${parsed.match_id}`);
  redirect(localePath(locale, `/admin/matches/${parsed.match_id}?${params.toString()}`));
}

// Delete a non-active draft version. Refuses to delete the active version so a
// match never silently loses its published recap.
export async function deleteSummaryVersion(formData: FormData): Promise<void> {
  await assertAdmin();
  const managed = await getManagedCompetition();
  if (!managed) throw new Error("No competition to manage");
  const locale = localeFrom(formData);

  const parsed = versionActionSchema.parse({
    summary_id: formData.get("summary_id"),
    match_id: formData.get("match_id"),
  });

  const admin = createAdminSupabaseClient();
  await assertMatchInManaged(admin, parsed.match_id, managed.id);

  const params = new URLSearchParams({ deleteSummaryId: parsed.summary_id });
  try {
    const { data: version } = await admin
      .from("match_summaries")
      .select("id, match_id, is_active")
      .eq("id", parsed.summary_id)
      .maybeSingle();
    if (!version || version.match_id !== parsed.match_id) {
      params.set("deleteResult", "error");
    } else if (version.is_active) {
      params.set("deleteResult", "active-blocked");
    } else {
      const { error } = await admin
        .from("match_summaries")
        .delete()
        .eq("id", parsed.summary_id);
      if (error) throw new Error(error.message);
      params.set("deleteResult", "deleted");
    }
  } catch (err) {
    console.error("[admin:deleteSummaryVersion] failed:", err);
    params.set("deleteResult", "error");
  }

  revalidateAfterMutation(managed.is_active);
  redirect(localePath(locale, `/admin/matches/${parsed.match_id}?${params.toString()}`));
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
