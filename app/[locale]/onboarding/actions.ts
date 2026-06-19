"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { displayNameSchema } from "@/lib/display-name";
import { sendWelcomeEmail } from "@/lib/notifications/welcome-email";

export async function setDisplayName(formData: FormData) {
  const parsed = displayNameSchema.safeParse({
    display_name: formData.get("display_name"),
  });
  if (!parsed.success) {
    throw new Error("Display name must be 2–32 characters.");
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { error } = await supabase
    .from("profiles")
    .update({ display_name: parsed.data.display_name })
    .eq("id", user.id);

  if (error) {
    throw new Error(error.message);
  }

  // Best-effort one-time welcome email. `sendWelcomeEmail` swallows and logs all
  // of its own errors (and is idempotent via profiles.welcome_email_sent_at), so
  // a send failure can never break or delay the onboarding redirect. Guarded
  // again here so even an unexpected throw leaves the redirect untouched — and
  // `redirect` (which throws NEXT_REDIRECT) stays outside any try/catch.
  try {
    await sendWelcomeEmail(user.id);
  } catch (err) {
    console.error("[onboarding] welcome email send threw:", err);
  }

  revalidatePath("/", "layout");
  redirect("/matches");
}
