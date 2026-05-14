"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const schema = z.object({
  display_name: z.string().trim().min(2).max(32),
});

export async function setDisplayName(formData: FormData) {
  const parsed = schema.safeParse({ display_name: formData.get("display_name") });
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

  revalidatePath("/", "layout");
  redirect("/matches");
}
