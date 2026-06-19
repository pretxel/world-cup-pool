import "server-only";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { GroupBoardRow, GroupMemberRole } from "@/lib/db";

export type GroupSummary = {
  id: string;
  name: string;
  joinCode: string;
  role: GroupMemberRole;
  isOwner: boolean;
  memberCount: number;
};

export type GroupMemberView = {
  userId: string;
  displayName: string | null;
  role: GroupMemberRole;
  joinedAt: string;
};

export type GroupDetail = {
  id: string;
  name: string;
  ownerId: string;
  joinCode: string;
  isOwner: boolean;
  currentUserId: string | null;
  members: GroupMemberView[];
};

// Groups the signed-in user belongs to, with member counts. Returns [] when
// signed out. RLS scopes every read to the caller's own groups.
export async function listMyGroups(): Promise<GroupSummary[]> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: memberships } = await supabase
    .from("group_members")
    .select("role, group_id, groups(id, name, join_code, owner_id)")
    .eq("user_id", user.id);

  const rows = memberships ?? [];
  const groupIds = rows.map((m) => m.group_id);
  if (groupIds.length === 0) return [];

  const { data: allMembers } = await supabase
    .from("group_members")
    .select("group_id")
    .in("group_id", groupIds);

  const counts = new Map<string, number>();
  for (const m of allMembers ?? []) {
    counts.set(m.group_id, (counts.get(m.group_id) ?? 0) + 1);
  }

  return rows
    .map((m) => {
      const group = m.groups;
      if (!group) return null;
      return {
        id: group.id,
        name: group.name,
        joinCode: group.join_code,
        role: m.role as GroupMemberRole,
        isOwner: group.owner_id === user.id,
        memberCount: counts.get(group.id) ?? 1,
      } satisfies GroupSummary;
    })
    .filter((g): g is GroupSummary => g !== null)
    .sort((a, b) => a.name.localeCompare(b.name));
}

// Full detail for one group, or null when the caller is not a member (RLS
// returns no group row in that case).
export async function getGroup(groupId: string): Promise<GroupDetail | null> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: group } = await supabase
    .from("groups")
    .select("id, name, owner_id, join_code")
    .eq("id", groupId)
    .maybeSingle();

  if (!group) return null;

  const { data: members } = await supabase
    .from("group_members")
    // Disambiguate the profiles embed: group_members now has two FKs to
    // profiles (user_id + invited_by_user_id), so hint the member relationship.
    .select("user_id, role, joined_at, profiles!group_members_user_id_fkey(display_name)")
    .eq("group_id", groupId)
    .order("joined_at", { ascending: true });

  return {
    id: group.id,
    name: group.name,
    ownerId: group.owner_id,
    joinCode: group.join_code,
    isOwner: group.owner_id === user?.id,
    currentUserId: user?.id ?? null,
    members: (members ?? []).map((m) => ({
      userId: m.user_id,
      displayName: m.profiles?.display_name ?? null,
      role: m.role as GroupMemberRole,
      joinedAt: m.joined_at,
    })),
  };
}

// The group's mini board. Returns [] for non-members (the SQL function guards
// on caller membership).
export async function getGroupBoard(
  groupId: string,
): Promise<{ rows: GroupBoardRow[]; error: string | null }> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("leaderboard_for_group", {
    p_group_id: groupId,
  });
  return { rows: (data ?? []) as GroupBoardRow[], error: error?.message ?? null };
}

// Name-only lookup by invite code, for the join-confirm screen.
export async function getGroupPreview(
  code: string,
): Promise<{ id: string; name: string } | null> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.rpc("group_preview", { p_code: code });
  const row = data?.[0];
  return row ? { id: row.id, name: row.name } : null;
}
