"use server";

import { z } from "zod";
import { revalidatePath, revalidateTag } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const STAGES = ["group", "r32", "r16", "qf", "sf", "third", "final"] as const;

const fixtureSchema = z.object({
  id: z.string().uuid().optional(),
  stage: z.enum(STAGES),
  group_code: z
    .string()
    .regex(/^[A-L]$/i)
    .transform((v) => v.toUpperCase())
    .nullable()
    .optional(),
  home_team: z.string().trim().min(1),
  away_team: z.string().trim().min(1),
  kickoff_at: z
    .string()
    .refine((s) => !Number.isNaN(Date.parse(s)), "Invalid timestamp")
    .transform((s) => new Date(s).toISOString()),
  venue: z.string().trim().optional().nullable(),
});

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

export async function saveFixture(formData: FormData) {
  await assertAdmin();
  const parsed = fixtureSchema.parse({
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

  const admin = createAdminSupabaseClient();
  if (parsed.id) {
    const { error } = await admin.from("matches").update(parsed).eq("id", parsed.id);
    if (error) throw new Error(error.message);
  } else {
    if (new Date(parsed.kickoff_at).getTime() <= Date.now()) {
      throw new Error("Kickoff must be in the future for new fixtures");
    }
    const { error } = await admin.from("matches").insert(parsed);
    if (error) throw new Error(error.message);
  }

  revalidatePath("/admin/matches");
  revalidatePath("/matches");
  revalidateTag("leaderboard", "max");
}

export async function setMatchResult(formData: FormData): Promise<void> {
  await assertAdmin();

  const homeRaw = formData.get("home_score");
  const awayRaw = formData.get("away_score");
  const parsed = resultSchema.parse({
    match_id: formData.get("match_id"),
    home_score: homeRaw === "" || homeRaw == null ? null : Number(homeRaw),
    away_score: awayRaw === "" || awayRaw == null ? null : Number(awayRaw),
    status: formData.get("status") ?? "final",
  });

  const admin = createAdminSupabaseClient();
  const { error } = await admin
    .from("matches")
    .update({
      home_score: parsed.home_score,
      away_score: parsed.away_score,
      status: parsed.status,
    })
    .eq("id", parsed.match_id);
  if (error) throw new Error(error.message);

  revalidatePath(`/matches/${parsed.match_id}`);
  revalidatePath("/matches");
  revalidatePath("/leaderboard");
  revalidateTag("leaderboard", "max");
}

export async function forceRecompute(formData: FormData) {
  await assertAdmin();
  const match_id = z.string().uuid().parse(formData.get("match_id"));
  const admin = createAdminSupabaseClient();
  const { error } = await admin.rpc("compute_match_scores", { p_match_id: match_id });
  if (error) throw new Error(error.message);
  revalidatePath("/leaderboard");
  revalidateTag("leaderboard", "max");
}

export async function deleteMatch(formData: FormData) {
  await assertAdmin();
  const id = z.string().uuid().parse(formData.get("id"));
  const admin = createAdminSupabaseClient();
  const { error } = await admin.from("matches").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/matches");
  revalidatePath("/matches");
  revalidateTag("leaderboard", "max");
}
