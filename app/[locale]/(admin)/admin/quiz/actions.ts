"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import type { QuizTranslations } from "@/lib/quiz";

// Non-English locales that can carry a quiz translation. English is canonical
// and lives in the base prompt/options columns.
const TRANSLATABLE_LOCALES = ["es", "fr"] as const;

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

const questionSchema = z
  .object({
    prompt: z.string().trim().min(1),
    options: z.array(z.string().trim().min(1)).min(2).max(4),
    correct_index: z.number().int().min(0).max(3),
    active_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
  })
  .refine((d) => d.correct_index < d.options.length, {
    message: "Correct option must be one of the filled options",
    path: ["correct_index"],
  });

function revalidateQuiz() {
  // Routes are locale-prefixed (localePrefix: "always"); bare paths wouldn't match.
  for (const l of ["en", "es", "fr"]) {
    revalidatePath(`/${l}/admin/quiz`);
    revalidatePath(`/${l}/quiz`);
  }
}

// Build the optional ES/FR translations from the form. `filledSlots` are the
// raw 0..3 option indices that survived the English blank-filter, so a
// translation's options stay positionally aligned with the English options
// (and thus with correct_index). A locale block is included only when its
// prompt is non-blank; if included, every aligned option must be non-blank and
// match the English option count — otherwise the submit is rejected so a
// half-translated question can never be stored.
function buildTranslations(
  formData: FormData,
  filledSlots: number[],
): QuizTranslations {
  const translations: QuizTranslations = {};
  for (const locale of TRANSLATABLE_LOCALES) {
    const prompt = ((formData.get(`${locale}_prompt`) as string) ?? "").trim();
    const rawOptions = filledSlots.map((i) =>
      ((formData.get(`${locale}_option_${i}`) as string) ?? "").trim(),
    );
    const anyContent = prompt !== "" || rawOptions.some(Boolean);
    if (!anyContent) continue; // fully blank block → no translation

    if (prompt === "" || rawOptions.some((o) => o === "")) {
      throw new Error(
        `Incomplete ${locale.toUpperCase()} translation: provide a prompt and every option, or leave the whole block blank`,
      );
    }
    translations[locale] = { prompt, options: rawOptions };
  }
  return translations;
}

export async function saveQuestion(formData: FormData) {
  await assertAdmin();

  // The dropdown's correct_index points at the ORIGINAL 4 slots. Compacting
  // blank options would shift it, so resolve correctness against the raw slots
  // first, then remap the index to the compacted list.
  const rawOptions = [0, 1, 2, 3].map((i) =>
    ((formData.get(`option_${i}`) as string) ?? "").trim(),
  );
  const correctRaw = Number(formData.get("correct_index"));
  if (
    !Number.isInteger(correctRaw) ||
    correctRaw < 0 ||
    correctRaw > 3 ||
    !rawOptions[correctRaw]
  ) {
    throw new Error("Correct option must be one of the filled options");
  }

  const filledSlots = [0, 1, 2, 3].filter((i) => rawOptions[i]);
  const options = filledSlots.map((i) => rawOptions[i]);
  // New index = how many filled slots precede the chosen one.
  const correct_index = rawOptions.slice(0, correctRaw).filter(Boolean).length;

  const parsed = questionSchema.parse({
    prompt: formData.get("prompt"),
    options,
    correct_index,
    active_on: formData.get("active_on"),
  });

  const translations = buildTranslations(formData, filledSlots);

  const admin = createAdminSupabaseClient();
  const { error } = await admin.from("quiz_questions").insert({
    prompt: parsed.prompt,
    options: parsed.options,
    correct_index: parsed.correct_index,
    active_on: parsed.active_on,
    translations,
  });
  if (error) throw new Error(error.message);

  revalidateQuiz();
}

export async function deleteQuestion(formData: FormData) {
  await assertAdmin();
  const id = z.string().uuid().parse(formData.get("id"));
  const admin = createAdminSupabaseClient();
  const { error } = await admin.from("quiz_questions").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidateQuiz();
}
