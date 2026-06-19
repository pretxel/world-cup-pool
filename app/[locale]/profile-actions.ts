"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { displayNameSchema } from "@/lib/display-name";
import {
  emailPrefsSchema,
  normalizeEmailPrefs,
  type EmailPrefs,
  type EmailPrefsInput,
} from "@/lib/email-prefs";

// Result the profile menu acts on. `error` is a code the client maps to a
// localized message ("invalid" → validation, "failed" → not signed in / DB).
export type UpdateDisplayNameResult =
  | { ok: true; displayName: string }
  | { ok: false; error: "invalid" | "failed" };

// In-place display-name update for the profile menu. Unlike onboarding's
// setDisplayName it does NOT redirect — it returns a result so the menu can
// stay open and show inline feedback. revalidatePath refreshes server-rendered
// names (leaderboard, picks, groups) on their next load.
export async function updateDisplayName(
  formData: FormData,
): Promise<UpdateDisplayNameResult> {
  const parsed = displayNameSchema.safeParse({
    display_name: formData.get("display_name"),
  });
  if (!parsed.success) return { ok: false, error: "invalid" };

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "failed" };

  const { error } = await supabase
    .from("profiles")
    .update({ display_name: parsed.data.display_name })
    .eq("id", user.id);

  if (error) return { ok: false, error: "failed" };

  revalidatePath("/", "layout");
  return { ok: true, displayName: parsed.data.display_name };
}

// Result the email-preference toggles act on. `error` mirrors updateDisplayName:
// "invalid" → bad payload, "failed" → not signed in / DB error.
export type UpdateEmailPrefsResult =
  | { ok: true; prefs: EmailPrefs }
  | { ok: false; error: "invalid" | "failed" };

// In-place per-type email-preference update for the profile menu. Like
// updateDisplayName it does NOT redirect — it returns the merged, normalized
// prefs so the menu can stay open and show inline feedback. The partial payload
// is merged onto the player's current prefs so flipping one toggle never
// disturbs the others. revalidatePath refreshes server-rendered surfaces (the
// nav passes email_prefs into the menu) on their next load.
export async function updateEmailPrefs(
  input: EmailPrefsInput,
): Promise<UpdateEmailPrefsResult> {
  const parsed = emailPrefsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "failed" };

  const { data: current, error: readErr } = await supabase
    .from("profiles")
    .select("email_prefs")
    .eq("id", user.id)
    .single();
  if (readErr) return { ok: false, error: "failed" };

  const merged = normalizeEmailPrefs({
    ...normalizeEmailPrefs(current?.email_prefs),
    ...parsed.data,
  });

  const { error } = await supabase
    .from("profiles")
    .update({ email_prefs: merged })
    .eq("id", user.id);
  if (error) return { ok: false, error: "failed" };

  revalidatePath("/", "layout");
  return { ok: true, prefs: merged };
}
