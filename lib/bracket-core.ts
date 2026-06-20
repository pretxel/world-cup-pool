// Pure, DB-free knockout-bracket resolver. Turns the seeded knockout fixtures
// (whose participants are placeholders like "Winner Group C", "2nd Group F",
// "3rd Group A/B/C/D/F", "Winner Match 73") into a projected bracket using the
// real group standings and recorded knockout results. No Supabase, fully
// unit-testable — the server loader in lib/bracket.ts just feeds it rows.

import {
  buildGroupTables,
  compareTeamRows,
  type GroupTableMatch,
  type GroupTeamRow,
} from "@/lib/group-standings";
import {
  allocateBestThirds,
  THIRD_SLOT_CANDIDATES,
  type ThirdSlotWinner,
} from "@/lib/bracket-third-allocation";

export type KnockoutStage = "r32" | "r16" | "qf" | "sf" | "third" | "final";

// A fixture as the bracket needs it — same shape as a group match plus the
// stage. group_code is null for knockout rows.
export type BracketMatchInput = GroupTableMatch & { stage: string };

// Stage ordering and the FIFA match-number base for each stage. Numbering is by
// (stage order, kickoff, id): group 1–72, r32 73–88, r16 89–96, qf 97–100,
// sf 101–102, third 103, final 104.
const STAGE_ORDER: Record<string, number> = {
  group: 1,
  r32: 2,
  r16: 3,
  qf: 4,
  sf: 5,
  third: 6,
  final: 7,
};
const STAGE_BASE: Record<string, number> = {
  group: 0,
  r32: 72,
  r16: 88,
  qf: 96,
  sf: 100,
  third: 102,
  final: 103,
};
const KNOCKOUT_ORDER: KnockoutStage[] = ["r32", "r16", "qf", "sf", "third", "final"];

// ---------------------------------------------------------------------------
// Slot parsing
// ---------------------------------------------------------------------------

export type ParsedSlot =
  | { kind: "winner-group"; group: string }
  | { kind: "runner-group"; group: string }
  | { kind: "third"; candidates: string[] }
  | { kind: "winner-match"; matchNumber: number }
  | { kind: "loser-match"; matchNumber: number }
  | { kind: "literal"; text: string };

export function parseKnockoutSlot(text: string): ParsedSlot {
  let m = /^Winner Group ([A-L])$/.exec(text);
  if (m) return { kind: "winner-group", group: m[1] };
  m = /^2nd Group ([A-L])$/.exec(text);
  if (m) return { kind: "runner-group", group: m[1] };
  m = /^3rd Group ([A-L](?:\/[A-L])+)$/.exec(text);
  if (m) return { kind: "third", candidates: m[1].split("/") };
  m = /^Winner Match (\d+)$/.exec(text);
  if (m) return { kind: "winner-match", matchNumber: Number(m[1]) };
  m = /^Loser Match (\d+)$/.exec(text);
  if (m) return { kind: "loser-match", matchNumber: Number(m[1]) };
  return { kind: "literal", text };
}

// ---------------------------------------------------------------------------
// Match numbering
// ---------------------------------------------------------------------------

// id -> FIFA match number, and number -> fixture. Sorts each stage by kickoff
// then id for a stable sequence within the stage's fixed range.
export function assignMatchNumbers(matches: BracketMatchInput[]): {
  numberById: Map<string, number>;
  matchByNumber: Map<number, BracketMatchInput>;
} {
  const numberById = new Map<string, number>();
  const matchByNumber = new Map<number, BracketMatchInput>();

  const byStage = new Map<string, BracketMatchInput[]>();
  for (const m of matches) {
    const arr = byStage.get(m.stage) ?? [];
    arr.push(m);
    byStage.set(m.stage, arr);
  }

  for (const [stage, arr] of byStage) {
    const base = STAGE_BASE[stage];
    if (base == null) continue; // unknown stage — not numbered
    arr.sort(
      (a, b) =>
        a.kickoff_at.localeCompare(b.kickoff_at) || a.id.localeCompare(b.id),
    );
    arr.forEach((m, i) => {
      const n = base + i + 1;
      numberById.set(m.id, n);
      matchByNumber.set(n, m);
    });
  }

  return { numberById, matchByNumber };
}

// ---------------------------------------------------------------------------
// Group context (ranks + completeness)
// ---------------------------------------------------------------------------

type GroupContext = {
  rowsByCode: Map<string, GroupTeamRow[]>;
  hasResults: Set<string>; // group codes with ≥1 final result
  complete: Set<string>; // group codes where every match is final
  allGroupsComplete: boolean;
};

function buildGroupContext(groupMatches: BracketMatchInput[]): GroupContext {
  const rowsByCode = new Map<string, GroupTeamRow[]>();
  for (const g of buildGroupTables(groupMatches)) {
    rowsByCode.set(g.groupCode, g.rows);
  }

  const total = new Map<string, number>();
  const finals = new Map<string, number>();
  for (const m of groupMatches) {
    if (!m.group_code) continue;
    total.set(m.group_code, (total.get(m.group_code) ?? 0) + 1);
    if (m.status === "final" && m.home_score != null && m.away_score != null) {
      finals.set(m.group_code, (finals.get(m.group_code) ?? 0) + 1);
    }
  }

  const hasResults = new Set<string>();
  const complete = new Set<string>();
  for (const [code, n] of total) {
    const f = finals.get(code) ?? 0;
    if (f > 0) hasResults.add(code);
    if (f === n) complete.add(code);
  }
  const allGroupsComplete =
    rowsByCode.size > 0 && [...total.keys()].every((c) => complete.has(c));

  return { rowsByCode, hasResults, complete, allGroupsComplete };
}

// ---------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------

export type SlotStatus = "confirmed" | "provisional" | "placeholder";

export type ResolvedParticipant = {
  team: string | null; // resolved team, or null when unresolved
  label: string; // team name when resolved, else the original placeholder
  status: SlotStatus;
};

function groupParticipant(
  group: string,
  rank: number,
  ctx: GroupContext,
  original: string,
): ResolvedParticipant {
  const rows = ctx.rowsByCode.get(group);
  if (!rows || !ctx.hasResults.has(group) || !rows[rank - 1]) {
    return { team: null, label: original, status: "placeholder" };
  }
  const team = rows[rank - 1].team;
  return {
    team,
    label: team,
    status: ctx.complete.has(group) ? "confirmed" : "provisional",
  };
}

// The 8 qualifying group letters from the current standings: rank every group's
// current third-placed row by the standard tie-break and take the top 8 groups.
// Computed once every group has at least one result (so each group's current
// third is real), returning a `provisional` flag — true until all groups
// complete, when the set and order are final. Returns null (→ placeholder)
// before every group has a result.
function qualifyingThirdGroups(
  ctx: GroupContext,
): { groups: string[]; provisional: boolean } | null {
  const thirds: { code: string; row: GroupTeamRow }[] = [];
  for (const [code, rows] of ctx.rowsByCode) {
    if (ctx.hasResults.has(code) && rows[2]) {
      thirds.push({ code, row: rows[2] });
    }
  }
  // Require every group to have a results-backed third, and at least 8, so the
  // ranking is over each group's real current third rather than a partial set.
  if (thirds.length !== ctx.rowsByCode.size || thirds.length < 8) return null;
  thirds.sort((a, b) => compareTeamRows(a.row, b.row));
  return {
    groups: thirds.slice(0, 8).map((t) => t.code),
    provisional: !ctx.allGroupsComplete,
  };
}

export type BracketSlotMatch = {
  id: string;
  number: number | null;
  stage: KnockoutStage;
  home: ResolvedParticipant;
  away: ResolvedParticipant;
  homeScore: number | null;
  awayScore: number | null;
  status: string;
  kickoffAt: string;
};

export type BracketRound = {
  stage: KnockoutStage;
  matches: BracketSlotMatch[];
};

export type Bracket = {
  rounds: BracketRound[];
  hasKnockout: boolean;
};

export function buildBracket(matches: BracketMatchInput[]): Bracket {
  const groupMatches = matches.filter((m) => m.stage === "group");
  const knockout = matches.filter((m) => m.stage !== "group");
  if (knockout.length === 0) return { rounds: [], hasKnockout: false };

  const ctx = buildGroupContext(groupMatches);
  const { numberById, matchByNumber } = assignMatchNumbers(matches);
  const { thirdAlloc, thirdsProvisional } = (() => {
    const q = qualifyingThirdGroups(ctx);
    return {
      thirdAlloc: q ? allocateBestThirds(q.groups) : null,
      thirdsProvisional: q ? q.provisional : false,
    };
  })();

  // Winner/loser of a numbered, decisively-final fixture (resolving the
  // referenced fixture's own slots first, so a chain of results carries
  // through). Returns null when undecided or unresolved.
  const outcome = (
    n: number,
    want: "winner" | "loser",
  ): ResolvedParticipant | null => {
    const fx = matchByNumber.get(n);
    if (!fx) return null;
    if (
      fx.status !== "final" ||
      fx.home_score == null ||
      fx.away_score == null ||
      fx.home_score === fx.away_score
    ) {
      return null;
    }
    const homeWon = fx.home_score > fx.away_score;
    const side = (want === "winner") === homeWon ? "home" : "away";
    const part = side === "home" ? resolveSide(fx, "home") : resolveSide(fx, "away");
    return part.team
      ? { team: part.team, label: part.team, status: "confirmed" }
      : null;
  };

  // Resolve one side of a fixture into a participant.
  function resolveSide(
    fx: BracketMatchInput,
    side: "home" | "away",
  ): ResolvedParticipant {
    const original = side === "home" ? fx.home_team : fx.away_team;
    const sibling = side === "home" ? fx.away_team : fx.home_team;
    const slot = parseKnockoutSlot(original);

    switch (slot.kind) {
      case "literal":
        return { team: slot.text, label: slot.text, status: "confirmed" };
      case "winner-group":
        return groupParticipant(slot.group, 1, ctx, original);
      case "runner-group":
        return groupParticipant(slot.group, 2, ctx, original);
      case "third": {
        // The slot faces a group winner (the sibling); key the allocation by
        // that winner's letter.
        const sib = parseKnockoutSlot(sibling);
        if (
          thirdAlloc &&
          sib.kind === "winner-group" &&
          (THIRD_SLOT_CANDIDATES as Record<string, string[]>)[sib.group]
        ) {
          const group = thirdAlloc[sib.group as ThirdSlotWinner];
          const p = groupParticipant(group, 3, ctx, original);
          // The whole best-third set can reshuffle as any group's standings
          // change, so the status follows the set-level flag (provisional until
          // all groups complete, then confirmed) — broader than one group's
          // own completeness.
          return p.team
            ? { ...p, status: thirdsProvisional ? "provisional" : "confirmed" }
            : p;
        }
        return { team: null, label: original, status: "placeholder" };
      }
      case "winner-match":
        return outcome(slot.matchNumber, "winner") ?? {
          team: null,
          label: original,
          status: "placeholder",
        };
      case "loser-match":
        return outcome(slot.matchNumber, "loser") ?? {
          team: null,
          label: original,
          status: "placeholder",
        };
    }
  }

  const rounds: BracketRound[] = [];
  for (const stage of KNOCKOUT_ORDER) {
    const fixtures = knockout
      .filter((m) => m.stage === stage)
      .sort(
        (a, b) =>
          (numberById.get(a.id) ?? 0) - (numberById.get(b.id) ?? 0) ||
          a.kickoff_at.localeCompare(b.kickoff_at),
      );
    if (fixtures.length === 0) continue;
    rounds.push({
      stage,
      matches: fixtures.map((fx) => ({
        id: fx.id,
        number: numberById.get(fx.id) ?? null,
        stage,
        home: resolveSide(fx, "home"),
        away: resolveSide(fx, "away"),
        homeScore: fx.home_score,
        awayScore: fx.away_score,
        status: fx.status,
        kickoffAt: fx.kickoff_at,
      })),
    });
  }

  return { rounds, hasKnockout: true };
}

export { STAGE_ORDER, STAGE_BASE, KNOCKOUT_ORDER };
