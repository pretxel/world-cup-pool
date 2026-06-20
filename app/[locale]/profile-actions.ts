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
import { z } from "zod";

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

// The browser PushSubscription, narrowed to the fields the store needs. The
// client serializes `pushManager.subscribe(...).toJSON()` and sends these.
// Module-local: a "use server" file may export ONLY async functions (and
// types), so this schema must not be exported.
const pushSubscriptionSchema = z.object({
  endpoint: z.string().url(),
  p256dh: z.string().min(1),
  auth: z.string().min(1),
  userAgent: z.string().max(512).optional(),
});

type PushSubscriptionInput = z.infer<typeof pushSubscriptionSchema>;

export type PushSubscriptionResult =
  | { ok: true }
  | { ok: false; error: "invalid" | "failed" };

// Persists the caller's own Web Push subscription under RLS. Upserts on the
// unique `endpoint` so re-subscribing the same browser updates rather than
// duplicates. Co-located with updateEmailPrefs because the push toggle lives in
// the same account-menu prefs panel.
export async function savePushSubscription(
  input: PushSubscriptionInput,
): Promise<PushSubscriptionResult> {
  const parsed = pushSubscriptionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "failed" };

  // RLS allows insert only where user_id = auth.uid(); the unique endpoint
  // makes this idempotent for a re-subscribing browser.
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: user.id,
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.p256dh,
      auth: parsed.data.auth,
      user_agent: parsed.data.userAgent ?? null,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: "endpoint" },
  );
  if (error) return { ok: false, error: "failed" };

  return { ok: true };
}

// Removes the caller's stored subscription for a given endpoint (RLS scopes the
// delete to their own rows). Called when the player turns the push toggle off
// or revokes permission.
export async function removePushSubscription(
  endpoint: string,
): Promise<PushSubscriptionResult> {
  const parsed = z.string().url().safeParse(endpoint);
  if (!parsed.success) return { ok: false, error: "invalid" };

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "failed" };

  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", parsed.data)
    .eq("user_id", user.id);
  if (error) return { ok: false, error: "failed" };

  return { ok: true };
}
