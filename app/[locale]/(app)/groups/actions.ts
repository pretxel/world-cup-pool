"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { DEFAULT_LOCALE, isLocale, localePath, type Locale } from "@/lib/i18n";

const nameSchema = z.string().trim().min(2).max(40);
const codeSchema = z.string().trim().min(1).max(16);
const idSchema = z.string().uuid();

// `error` carries a translation key (under the `groups` namespace) so the
// client can render a localized message. Undefined means success.
export type GroupActionState = { error?: string };

function resolveLocale(formData: FormData): Locale {
  const raw = String(formData.get("locale") ?? "");
  return isLocale(raw) ? raw : DEFAULT_LOCALE;
}

async function requireUserClient() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  return { supabase, user };
}

// --- Validated flows (useActionState) ---------------------------------------

export async function createGroupAction(
  _prev: GroupActionState,
  formData: FormData,
): Promise<GroupActionState> {
  const locale = resolveLocale(formData);
  const parsed = nameSchema.safeParse(formData.get("name"));
  if (!parsed.success) return { error: "errorInvalidName" };

  const { supabase } = await requireUserClient();
  const { data: groupId, error } = await supabase.rpc("create_group", {
    p_name: parsed.data,
  });
  if (error) return { error: "errorGeneric" };

  revalidatePath("/groups");
  redirect(localePath(locale, `/groups/${groupId}`));
}

export async function joinGroupAction(
  _prev: GroupActionState,
  formData: FormData,
): Promise<GroupActionState> {
  const locale = resolveLocale(formData);
  const parsed = codeSchema.safeParse(formData.get("code"));
  if (!parsed.success) return { error: "errorInvalidCode" };

  // Optional inviter from an invite link (`?ref=` threaded through a hidden
  // field). Drop it silently if malformed; the RPC defaults it to null. The
  // RPC enforces self-credit / already-member / once-per-pair guards.
  const invitedBy = idSchema.safeParse(formData.get("invited_by"));

  const { supabase } = await requireUserClient();
  const { data: groupId, error } = await supabase.rpc("join_group", {
    p_code: parsed.data,
    ...(invitedBy.success ? { p_invited_by: invitedBy.data } : {}),
  });
  if (error) {
    return {
      error: /invalid join code/i.test(error.message)
        ? "errorInvalidCode"
        : "errorGeneric",
    };
  }

  revalidatePath("/groups");
  redirect(localePath(locale, `/groups/${groupId}`));
}

// --- Owner / member management (plain form actions) -------------------------

export async function renameGroupAction(formData: FormData): Promise<void> {
  const groupId = idSchema.parse(formData.get("group_id"));
  const name = nameSchema.parse(formData.get("name"));
  const { supabase } = await requireUserClient();

  const { error } = await supabase
    .from("groups")
    .update({ name })
    .eq("id", groupId);
  if (error) throw new Error(error.message);

  revalidatePath("/groups");
  revalidatePath(`/groups/${groupId}`);
}

export async function leaveGroupAction(formData: FormData): Promise<void> {
  const locale = resolveLocale(formData);
  const groupId = idSchema.parse(formData.get("group_id"));
  const { supabase } = await requireUserClient();

  const { error } = await supabase.rpc("leave_group", { p_group_id: groupId });
  if (error) throw new Error(error.message);

  revalidatePath("/groups");
  redirect(localePath(locale, "/groups"));
}

export async function removeMemberAction(formData: FormData): Promise<void> {
  const groupId = idSchema.parse(formData.get("group_id"));
  const userId = idSchema.parse(formData.get("user_id"));
  const { supabase } = await requireUserClient();

  const { error } = await supabase.rpc("remove_group_member", {
    p_group_id: groupId,
    p_user_id: userId,
  });
  if (error) throw new Error(error.message);

  revalidatePath(`/groups/${groupId}`);
}

export async function deleteGroupAction(formData: FormData): Promise<void> {
  const locale = resolveLocale(formData);
  const groupId = idSchema.parse(formData.get("group_id"));
  const { supabase } = await requireUserClient();

  const { error } = await supabase.from("groups").delete().eq("id", groupId);
  if (error) throw new Error(error.message);

  revalidatePath("/groups");
  redirect(localePath(locale, "/groups"));
}
