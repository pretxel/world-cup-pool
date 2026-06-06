"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isConfirmedMatch } from "@/lib/match-utils";

const schema = z.object({
  matchId: z.string().uuid(),
  homeGoals: z.number().int().min(0).max(20),
  awayGoals: z.number().int().min(0).max(20),
});

export type SubmitResult = { ok: true } | { ok: false; error: string };

export async function submitPrediction(input: unknown): Promise<SubmitResult> {
  const t = await getTranslations("predictionForm");
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: t("errorInvalidScores") };
  }
  const { matchId, homeGoals, awayGoals } = parsed.data;

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: t("errorNotSignedIn") };
  }

  const { data: match, error: matchError } = await supabase
    .from("matches")
    .select("status, kickoff_at, home_team, away_team")
    .eq("id", matchId)
    .maybeSingle();

  if (matchError) {
    return { ok: false, error: matchError.message };
  }
  if (!match) {
    return { ok: false, error: t("errorMatchNotFound") };
  }

  // Teams must be confirmed before a pick can be written — defends the hidden
  // form against a stale client or a direct POST for a placeholder matchup.
  if (!isConfirmedMatch(match)) {
    return { ok: false, error: t("errorNotConfirmed") };
  }

  if (match.status === "final") {
    return { ok: false, error: t("lockedFinal") };
  }
  if (match.status === "cancelled") {
    return { ok: false, error: t("lockedCancelled") };
  }
  if (match.status === "live") {
    return { ok: false, error: t("lockedLive") };
  }
  if (new Date(match.kickoff_at).getTime() <= Date.now()) {
    return { ok: false, error: t("lockedKickoff") };
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
      return { ok: false, error: t("lockedKickoff") };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath(`/en/matches/${matchId}`);
  revalidatePath(`/es/matches/${matchId}`);
  revalidatePath(`/fr/matches/${matchId}`);
  revalidatePath("/en/my-picks");
  revalidatePath("/es/my-picks");
  revalidatePath("/fr/my-picks");
  return { ok: true };
}
