## Context

`/matches` renders only confirmed fixtures: `list = matches.filter(isConfirmedMatch)` (`app/[locale]/(public)/matches/page.tsx`), where `isConfirmedMatch` (`lib/match-utils.ts`) requires both team names to resolve to a real country via `flagSlug`. Knockout fixtures seeded with placeholders ("Winner Group A") are therefore hidden until an admin/auto-fill sets real teams (`knockout-team-autofill`, `admin-fixture-editing`). The detail page already renders a "teams not confirmed yet" read-only state for unconfirmed matches, and `submitPrediction` rejects unconfirmed targets (`match-availability`).

Each competition's stages live in `competitions.format_config` (JSONB), validated by `stageSchema` (`lib/competition-schema.ts`) and a DB `validate_format_config` trigger. A `StageConfig` has `key`, `kind` (`group|knockout|league`), `order`, `labels`, `icon?`, `hasGroupCode`. The admin matches surface (`/admin/matches`) is scoped to the *managed* competition and already hosts fixture controls and the new "Confirm knockout teams" action.

The chosen behavior (from clarification): reveal is **per round**, fixtures become **visible but not pickable**, and picking still depends solely on team confirmation.

## Goals / Non-Goals

**Goals:**
- Admin can reveal/hide each knockout round for the managed competition.
- A revealed round's fixtures show on `/matches` as a read-only schedule, even with placeholders.
- Zero change to pick eligibility — confirmed teams remain the pick gate.
- No new table; reuse the competition format.

**Non-Goals:**
- No pick-open date, no auto-reveal, no change to `/bracket` (which already shows all rounds).
- No making placeholder fixtures pickable.

## Decisions

### Decision: Store the reveal flag per stage in `format_config`
Add `revealed: z.boolean().default(false)` to `stageSchema`. Reveal is per-competition, per-round config — the format is its natural home, and it is already admin-editable and competition-scoped. Add a helper `revealedKnockoutStageKeys(format): Set<string>` (knockout stages with `revealed === true`).

*Alternative considered:* a `revealed_stages` table or a per-match column. Rejected — a table duplicates the stage list already in the format; a per-match column contradicts `match-availability`'s "no per-match flag" and would need bulk writes per round.

### Decision: Public gate becomes `confirmed OR revealed knockout round`
In the matches page, load the active competition format, compute `revealed = revealedKnockoutStageKeys(format)`, and gate:

```
const visible = matches.filter(m => isConfirmedMatch(m) || revealed.has(m.stage))
```

Confirmed fixtures always show (group + confirmed knockout). Revealed adds unconfirmed knockout rows for enabled rounds only. Stats, team filter, and day grouping then operate on `visible` as before. Team-filter/“involves team” must tolerate placeholder names (they simply won't match a real-country filter — acceptable).

### Decision: Per-row "pickable/confirmed" flag drives read-only rendering
Compute `isConfirmedMatch(m)` per row and pass it to the list row component. For an unconfirmed (revealed) row: render the placeholder participant text without a flag (no `flagSlug` crash), suppress the "Pick"/closing-soon CTA, and show a small "teams TBD" affordance instead. Confirmed rows are unchanged. The detail page and `submitPrediction` already handle unconfirmed correctly — no change there.

### Decision: Admin toggle flips the format flag, scoped to the managed competition
A `toggleKnockoutRoundReveal(formData)` server action: `assertAdmin`, resolve the managed competition, parse its `format_config`, set `revealed` on the target stage (by `key`), write the updated `format_config` back via the service-role client, and `revalidatePath("/matches")` + `/admin/matches`. The admin page lists the managed competition's knockout stages with a toggle each (and ignores group/league stages). Reuse `parseFormatConfig` for a round-trip-safe edit so the DB trigger still validates.

*Alternative considered:* edit via the full competition format editor. Rejected — too heavy for a one-field toggle the owner will flip repeatedly during the tournament.

## Risks / Trade-offs

- **Placeholder rows breaking the list UI (flag lookup, Pick CTA, filters)** → gate all team-real assumptions on the per-row `isConfirmedMatch` flag; render a dedicated read-only variant. Covered by the row changes + tests.
- **Confusing users with unpickable rows** → the "teams TBD" affordance and absence of a Pick CTA communicate read-only; the detail page already explains "teams not confirmed yet."
- **Format edit validation** → round-trip through `parseFormatConfig`/`stageSchema` (with the new optional field) so the write stays valid for the `validate_format_config` trigger; `revealed` defaults false so existing formats are unaffected.
- **Stat/filter skew from placeholders** → stats compute over the visible set intentionally (revealed rounds are part of the schedule); placeholders never match a country team-filter, which is acceptable.

## Migration Plan

Additive. Deploy; `revealed` defaults to false everywhere, so behavior is unchanged until an admin reveals a round. No data migration (existing `format_config` rows read `revealed` as false via the schema default). Rollback = revert the diff; any `revealed: true` already written is simply ignored once the gate is removed.

## Open Questions

- Should a revealed round also expose a header/section marker on `/matches` (e.g. a "Round of 32 — schedule" divider), or just interleave rows by day like today? (Default: interleave by day, as now.)
- Should revealing a round be blocked unless the round's fixtures exist for the competition? (Default: allow; an empty round simply adds nothing.)
