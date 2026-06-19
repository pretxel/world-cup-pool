"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { DEFAULT_LOCALE, isLocale, localePath, type Locale } from "@/lib/i18n";
import { isSendableEmail } from "@/lib/notifications/result-emails";
import { sendGroupInviteEmails } from "@/lib/notifications/group-invite-email";

const nameSchema = z.string().trim().min(2).max(40);
const codeSchema = z.string().trim().min(1).max(16);
const idSchema = z.string().uuid();

// `error` carries a translation key (under the `groups` namespace) so the
// client can render a localized message. Undefined means success.
export type GroupActionState = { error?: string };

// Abuse caps for email invites. Conservative defaults; tune as needed.
const MAX_RECIPIENTS_PER_INVITE = 10;
const MAX_INVITES_PER_INVITER_PER_DAY = 50;
const MAX_INVITES_PER_GROUP_PER_DAY = 30;
const RATE_WINDOW_MS = 24 * 60 * 60 * 1000;

// State for the invite-by-email action. `error` (when set) is a translation key
// under the `groupInvite` namespace; on a (partial) send the counts are filled
// in. `invalid` lists the rejected raw entries for feedback.
export type InviteByEmailState = {
  error?: string;
  sent?: number;
  failed?: number;
  invalid?: string[];
};

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

// Parses the raw recipients field (comma/newline separated), trims + lowercases
// each entry, validates with isSendableEmail, and de-duplicates. Returns the
// clean send list plus the raw entries that failed validation, for feedback.
function parseRecipients(raw: string): { valid: string[]; invalid: string[] } {
  const entries = raw
    .split(/[\s,;]+/)
    .map((e) => e.trim())
    .filter((e) => e.length > 0);

  const seen = new Set<string>();
  const valid: string[] = [];
  const invalid: string[] = [];

  for (const entry of entries) {
    const normalized = entry.toLowerCase();
    if (!isSendableEmail(normalized)) {
      invalid.push(entry);
      continue;
    }
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    valid.push(normalized);
  }

  return { valid, invalid };
}

// Sends a direct group join link to one or more email recipients. Authorizes
// the caller as a member of the target group, validates/dedupes/caps the
// recipient list, enforces rolling-window rate limits via the service-role
// group_invite_log ledger, then dispatches best-effort. Never throws an email
// problem out to the form; surfaces counts and a localized error key instead.
export async function inviteToGroupByEmailAction(
  _prev: InviteByEmailState,
  formData: FormData,
): Promise<InviteByEmailState> {
  const locale = resolveLocale(formData);

  const parsedId = idSchema.safeParse(formData.get("group_id"));
  if (!parsedId.success) return { error: "errorGeneric" };
  const groupId = parsedId.data;

  const { valid, invalid } = parseRecipients(String(formData.get("recipients") ?? ""));

  if (valid.length === 0) {
    return { error: "errorNoRecipients", invalid };
  }
  if (valid.length > MAX_RECIPIENTS_PER_INVITE) {
    return { error: "errorTooMany", invalid };
  }

  const { supabase, user } = await requireUserClient();

  // Authorize: the caller must be a member of the target group. RLS already
  // scopes group_members to the caller's own rows, so a returned row proves
  // membership; absence means not-a-member (or no such group).
  const { data: membership, error: memberErr } = await supabase
    .from("group_members")
    .select("group_id")
    .eq("group_id", groupId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (memberErr || !membership) {
    return { error: "errorNotMember", invalid };
  }

  // Group name + join code for the email. Read under the caller's session.
  const { data: group, error: groupErr } = await supabase
    .from("groups")
    .select("name, join_code")
    .eq("id", groupId)
    .maybeSingle();
  if (groupErr || !group) {
    return { error: "errorNotMember", invalid };
  }

  // Inviter display name for the email body. Best-effort; null is fine.
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();

  // Rate limit on the service-role ledger (RLS-protected, so use the admin
  // client). Reject before sending if the inviter or group is over its window.
  const admin = createAdminSupabaseClient();
  const since = new Date(Date.now() - RATE_WINDOW_MS).toISOString();

  const { count: inviterCount } = await admin
    .from("group_invite_log")
    .select("*", { count: "exact", head: true })
    .eq("inviter_id", user.id)
    .gte("sent_at", since);
  if ((inviterCount ?? 0) + valid.length > MAX_INVITES_PER_INVITER_PER_DAY) {
    return { error: "errorRateLimited", invalid };
  }

  const { count: groupCount } = await admin
    .from("group_invite_log")
    .select("*", { count: "exact", head: true })
    .eq("inviter_id", user.id)
    .eq("group_id", groupId)
    .gte("sent_at", since);
  if ((groupCount ?? 0) + valid.length > MAX_INVITES_PER_GROUP_PER_DAY) {
    return { error: "errorRateLimited", invalid };
  }

  const result = await sendGroupInviteEmails({
    groupId,
    groupName: group.name,
    inviterId: user.id,
    inviterName: profile?.display_name ?? group.name,
    joinCode: group.join_code,
    locale,
    recipients: valid,
  });

  revalidatePath(`/groups/${groupId}`);

  return {
    sent: result.sent,
    failed: result.failed,
    invalid: invalid.length > 0 ? invalid : undefined,
  };
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
