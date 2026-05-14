"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const schema = z.object({
  matchId: z.string().uuid(),
  homeGoals: z.number().int().min(0).max(20),
  awayGoals: z.number().int().min(0).max(20),
});

export type SubmitResult = { ok: true } | { ok: false; error: string };

export async function submitPrediction(input: unknown): Promise<SubmitResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Scores must be whole numbers between 0 and 20." };
  }
  const { matchId, homeGoals, awayGoals } = parsed.data;

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "You need to be signed in to submit a prediction." };
  }

  const { data: match, error: matchError } = await supabase
    .from("matches")
    .select("status, kickoff_at")
    .eq("id", matchId)
    .maybeSingle();

  if (matchError) {
    return { ok: false, error: matchError.message };
  }
  if (!match) {
    return { ok: false, error: "Match not found." };
  }

  if (match.status === "final") {
    return { ok: false, error: "Predictions are locked — match is final." };
  }
  if (match.status === "cancelled") {
    return { ok: false, error: "Predictions are locked — match was cancelled." };
  }
  if (match.status === "live") {
    return { ok: false, error: "Predictions are locked — match is live." };
  }
  if (new Date(match.kickoff_at).getTime() <= Date.now()) {
    return { ok: false, error: "Predictions are locked — kickoff has passed." };
  }

  const { error } = await supabase.from("predictions").upsert(
    {
      user_id: user.id,
      match_id: matchId,
      home_goals: homeGoals,
      away_goals: awayGoals,
      submitted_at: new Date().toISOString(),
    },
    { onConflict: "user_id,match_id" },
  );

  if (error) {
    if (error.code === "42501" || /row-level security/i.test(error.message)) {
      return { ok: false, error: "Predictions are locked — kickoff has passed." };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath(`/matches/${matchId}`);
  revalidatePath("/my-picks");
  return { ok: true };
}
