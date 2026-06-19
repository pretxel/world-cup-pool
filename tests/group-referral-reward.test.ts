import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// The group-referral reward is enforced entirely inside the join_group definer
// RPC + schema, so its guarantees are structural. With no live Postgres in the
// test env, we assert the migration encodes each load-bearing invariant from
// the spec: scoring isolation, the four guards (self-credit, inviter-must-be-
// member, first-join-only, once-per-pair), and idempotent membership capture.

const raw = readFileSync(
  fileURLToPath(
    new URL(
      "../supabase/migrations/20260619170000_group_referral_reward.sql",
      import.meta.url,
    ),
  ),
  "utf8",
);

// Strip `--` line comments so assertions target executable SQL, not the
// explanatory header (which legitimately names scores / compute_match_scores
// when describing the scoring-isolation rationale).
const sql = raw
  .split("\n")
  .map((line) => line.replace(/--.*$/, ""))
  .join("\n");

describe("group-referral-reward migration — scoring isolation", () => {
  it("never writes to public.scores", () => {
    expect(sql).not.toMatch(/insert\s+into\s+public\.scores/i);
    expect(sql).not.toMatch(/update\s+public\.scores/i);
  });

  it("does not touch the scoring function or leaderboard views/RPCs", () => {
    expect(sql).not.toMatch(/compute_match_scores/i);
    expect(sql).not.toMatch(/v_leaderboard_overall/i);
    // join_group is re-created, but leaderboard_for_group must be left alone.
    expect(sql).not.toMatch(/function\s+public\.leaderboard_for_group/i);
  });

  it("records the bonus in the dedicated group_referrals ledger instead", () => {
    expect(sql).toMatch(/create table public\.group_referrals/i);
    expect(sql).toMatch(/insert into public\.group_referrals/i);
    expect(sql).toMatch(/points int not null/i);
  });
});

describe("group-referral-reward migration — capture column", () => {
  it("adds a nullable invited_by_user_id FK to profiles with on delete set null", () => {
    expect(sql).toMatch(
      /add column invited_by_user_id uuid references public\.profiles\(id\) on delete set null/i,
    );
    // Nullable: no NOT NULL / no default on the new column.
    expect(sql).not.toMatch(/invited_by_user_id uuid[^;]*not null/i);
    expect(sql).toMatch(/group_members_invited_by_user_id_idx/i);
  });
});

describe("group-referral-reward migration — RPC guards", () => {
  it("re-creates join_group as a two-arg overload, dropping the single-arg one first", () => {
    expect(sql).toMatch(/drop function if exists public\.join_group\(text\)/i);
    expect(sql).toMatch(
      /create or replace function public\.join_group\([\s\S]*p_invited_by uuid default null/i,
    );
    expect(sql).toMatch(
      /grant execute on function public\.join_group\(text, uuid\) to authenticated/i,
    );
  });

  it("guards self-credit (inviter must differ from the joining user)", () => {
    expect(sql).toMatch(/p_invited_by\s*<>\s*v_uid/i);
  });

  it("guards inviter-must-be-an-existing-member of the same group", () => {
    expect(sql).toMatch(
      /exists\s*\([\s\S]*from public\.group_members[\s\S]*where group_id = v_group_id and user_id = p_invited_by/i,
    );
  });

  it("captures + awards only on a genuine first join (new membership row)", () => {
    // Membership insert is idempotent and the new-row detection gates the award.
    expect(sql).toMatch(/on conflict \(group_id, user_id\) do nothing/i);
    expect(sql).toMatch(/if v_inserted and v_inviter is not null then/i);
  });

  it("makes the award once-per-(group, invitee)", () => {
    expect(sql).toMatch(/unique \(group_id, invitee_id\)/i);
    expect(sql).toMatch(/on conflict \(group_id, invitee_id\) do nothing/i);
  });
});

describe("group-referral-reward migration — RLS", () => {
  it("enables RLS and a co-member select policy, with no client write policy", () => {
    expect(sql).toMatch(
      /alter table public\.group_referrals enable row level security/i,
    );
    expect(sql).toMatch(
      /create policy[\s\S]*on public\.group_referrals for select[\s\S]*is_group_member\(group_id\)/i,
    );
    expect(sql).not.toMatch(
      /create policy[\s\S]*on public\.group_referrals for (insert|update|delete)/i,
    );
  });
});
