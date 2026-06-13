"use server";

import { z } from "zod";
import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { competitionSchema } from "@/lib/competition-schema";
import { MANAGED_COMPETITION_COOKIE } from "@/lib/admin/managed-competition";
import { isLocale, localePath, DEFAULT_LOCALE } from "@/lib/i18n";

const WC_SEED_SLUG = "world-cup-2026";

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

function formLocale(formData: FormData) {
  const raw = formData.get("locale");
  return typeof raw === "string" && isLocale(raw) ? raw : DEFAULT_LOCALE;
}

// datetime-local submits a zone-less "YYYY-MM-DDTHH:mm"; treat it as UTC so the
// stored ISO round-trips losslessly (same convention as the fixture form).
function toIsoUtc(value: string): string {
  const hasZone = /([zZ])|([+-]\d{2}:?\d{2})$/.test(value);
  return new Date(hasZone ? value : `${value}Z`).toISOString();
}

function str(formData: FormData, name: string): string | undefined {
  const v = formData.get(name);
  return typeof v === "string" && v.trim() !== "" ? v.trim() : undefined;
}

function jsonField(formData: FormData, name: string): unknown {
  const raw = formData.get(name);
  if (typeof raw !== "string" || raw.trim() === "") return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`Invalid ${name}: not valid JSON`);
  }
}

function parseCompetitionForm(formData: FormData) {
  const startRaw = str(formData, "tournament_start_at");
  const endRaw = str(formData, "tournament_end_at");
  return competitionSchema.parse({
    slug: str(formData, "slug"),
    kind: str(formData, "kind") ?? "custom",
    name: str(formData, "name"),
    short_name: str(formData, "short_name"),
    season: str(formData, "season") ?? null,
    tournament_start_at: startRaw ? toIsoUtc(startRaw) : undefined,
    tournament_end_at: endRaw ? toIsoUtc(endRaw) : null,
    opening_home: str(formData, "opening_home") ?? null,
    opening_away: str(formData, "opening_away") ?? null,
    opening_venue: str(formData, "opening_venue") ?? null,
    format_config: jsonField(formData, "format_config"),
    providers: jsonField(formData, "providers") ?? {},
    branding: jsonField(formData, "branding") ?? {},
  });
}

// Turn a Postgres error into a readable message (slug clash, trigger rejection).
function dbError(error: { code?: string; message: string }): Error {
  if (error.code === "23505") return new Error("That slug is already in use");
  return new Error(error.message);
}

export async function createCompetition(formData: FormData): Promise<void> {
  await assertAdmin();
  const locale = formLocale(formData);
  const input = parseCompetitionForm(formData);

  const admin = createAdminSupabaseClient();
  // is_active is forced false (the guard trigger also enforces this); going
  // live is a separate, confirmed step via setActiveCompetition.
  const { data, error } = await admin
    .from("competitions")
    .insert({ ...input, is_active: false })
    .select("id")
    .single();
  if (error) throw dbError(error);

  revalidatePath("/admin/competitions");
  redirect(localePath(locale, `/admin/competitions/${data.id}?created=1`));
}

export async function updateCompetition(formData: FormData): Promise<void> {
  await assertAdmin();
  const locale = formLocale(formData);
  const id = z.string().uuid().parse(formData.get("id"));
  const input = parseCompetitionForm(formData);

  const admin = createAdminSupabaseClient();
  // Never touch is_active here.
  const { error } = await admin
    .from("competitions")
    .update(input)
    .eq("id", id);
  if (error) throw dbError(error);

  revalidatePath(localePath(locale, `/admin/competitions/${id}`));
  revalidatePath("/admin/competitions");
}

export async function setActiveCompetition(formData: FormData): Promise<void> {
  await assertAdmin();
  const id = z.string().uuid().parse(formData.get("id"));

  const admin = createAdminSupabaseClient();
  const { error } = await admin.rpc("set_active_competition", { p_id: id });
  if (error) throw new Error(error.message);

  // The active competition drives every public surface + branding, so blow away
  // the public caches and the leaderboard tag.
  revalidateTag("leaderboard", "max");
  revalidatePath("/", "layout");
  revalidatePath("/matches");
  revalidatePath("/admin/competitions");
}

export async function deleteCompetition(formData: FormData): Promise<void> {
  await assertAdmin();
  const id = z.string().uuid().parse(formData.get("id"));

  const admin = createAdminSupabaseClient();
  const { data: comp } = await admin
    .from("competitions")
    .select("slug, is_active")
    .eq("id", id)
    .maybeSingle();
  if (!comp) throw new Error("Competition not found");
  if (comp.is_active) {
    throw new Error("Switch the active competition away before deleting this one");
  }
  if (comp.slug === WC_SEED_SLUG) {
    throw new Error("The World Cup 2026 seed competition cannot be deleted");
  }

  const [{ count: matchCount }, { count: groupCount }] = await Promise.all([
    admin
      .from("matches")
      .select("id", { count: "exact", head: true })
      .eq("competition_id", id),
    admin
      .from("groups")
      .select("id", { count: "exact", head: true })
      .eq("competition_id", id),
  ]);
  if ((matchCount ?? 0) > 0 || (groupCount ?? 0) > 0) {
    throw new Error(
      `Competition has ${matchCount ?? 0} fixtures and ${groupCount ?? 0} groups; cannot delete`,
    );
  }

  const { error } = await admin.from("competitions").delete().eq("id", id);
  if (error) throw dbError(error);

  revalidatePath("/admin/competitions");
}

// Non-destructive: switches the admin's editing context only. Never touches the
// public is_active flag.
export async function setManagedCompetition(formData: FormData): Promise<void> {
  await assertAdmin();
  const id = z.string().uuid().parse(formData.get("id"));

  const admin = createAdminSupabaseClient();
  const { data } = await admin
    .from("competitions")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (!data) throw new Error("Competition not found");

  const cookieStore = await cookies();
  cookieStore.set(MANAGED_COMPETITION_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });

  revalidatePath("/admin", "layout");
}
