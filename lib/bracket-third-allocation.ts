// Best-third allocation for the World Cup 2026 Round of 32.
//
// Top 2 of all 12 groups (24) plus the 8 best third-placed teams advance. FIFA
// fixes, by published table, which group's third-placed team fills each R32
// "third" slot given WHICH 8 of the 12 groups have a qualifying third. Each of
// the 8 such slots faces a specific group winner; we key a slot by that winner
// letter. Candidate groups below are transcribed from the seeded fixtures and
// double-checked against them.

import { THIRD_PLACE_ALLOCATION } from "@/lib/bracket-third-allocation.generated";

export const THIRD_SLOT_WINNERS = ["A", "B", "D", "E", "G", "I", "K", "L"] as const;
export type ThirdSlotWinner = (typeof THIRD_SLOT_WINNERS)[number];

// winner the slot faces -> the five candidate groups whose 3rd can fill it.
export const THIRD_SLOT_CANDIDATES: Record<ThirdSlotWinner, string[]> = {
  A: ["C", "E", "F", "H", "I"],
  B: ["E", "F", "G", "I", "J"],
  D: ["B", "E", "F", "I", "J"],
  E: ["A", "B", "C", "D", "F"],
  G: ["A", "E", "H", "I", "J"],
  I: ["C", "D", "F", "G", "H"],
  K: ["D", "E", "I", "J", "L"],
  L: ["E", "H", "I", "J", "K"],
};

// Decoded allocation: { winnerLetter: groupWhose3rdPlaysThatSlot }.
export type ThirdAllocation = Record<ThirdSlotWinner, string>;

// Sorted, joined key for a set of qualifying group letters.
export function comboKey(groups: string[]): string {
  return [...groups].sort().join("");
}

// Slot->group allocation for the 8 qualifying groups, or null when the official
// table has no entry (so the caller keeps the candidate placeholder). The
// generated table stores each row as an 8-letter string in THIRD_SLOT_WINNERS
// order; decode it positionally.
export function allocateBestThirds(
  qualifyingGroups: string[],
): ThirdAllocation | null {
  if (qualifyingGroups.length !== 8) return null;
  const encoded = THIRD_PLACE_ALLOCATION[comboKey(qualifyingGroups)];
  if (!encoded || encoded.length !== THIRD_SLOT_WINNERS.length) return null;
  const out = {} as ThirdAllocation;
  THIRD_SLOT_WINNERS.forEach((winner, i) => {
    out[winner] = encoded[i];
  });
  return out;
}
