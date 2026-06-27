## Context

Knockout fixtures are seeded with placeholder participants. `lib/bracket-core.ts`'s `buildBracket(matches)` already resolves each knockout slot to a real team using the live group standings and recorded knockout results, tagging each resolved participant with a status: `confirmed` (source group(s) fully complete), `provisional` (in progress), or `placeholder` (unresolved). `/bracket` renders this projection but never writes it back.

A match is "confirmed" purely by `isConfirmedMatch` (`lib/match-utils.ts`): both `home_team` and `away_team` resolve to a real country via `flagSlug`. Confirmed + scheduled + future-kickoff ⇒ the match shows on `/matches` and is pickable (`match-availability`, `predictions-lock`). There is no separate publish step and no pick-open date.

The admin `/admin/matches` page already has a "Sync now" server action that calls a core directly, revalidates the match views, and surfaces a summary. `saveFixture` already edits a single fixture's teams (no future-kickoff guard on edits).

## Goals / Non-Goals

**Goals:**
- One admin action that confirms all currently-resolvable knockout fixtures (the R32, now) by stamping their real teams from the bracket.
- Write only final (`confirmed`) resolutions; never provisional.
- Idempotent and safe to re-run; report what changed.
- Make R32 pickable through existing rules — no new pick gate.

**Non-Goals:**
- No pick-open-date / window concept (explicitly chosen: rely on auto-enable).
- No change to lock rules, the scorer, or cron jobs.
- Not auto-running on a schedule — it is a manual admin action (results sync + standings already update the *projection*; this writes it to fixtures on demand).

## Decisions

### Decision: Derive teams from `buildBracket`, write confirmed-only diffs
A pure `computeKnockoutTeamUpdates(matches)` runs `buildBracket`, then for each knockout fixture compares the stored `home_team`/`away_team` against the resolved participant. It emits an update for a side only when the resolved participant has `status === "confirmed"`, carries a real team, and differs from what is stored. Group-stage rows are ignored. The result is a list of `{ id, home_team?, away_team? }`.

*Why confirmed-only:* a provisional projection can still reshuffle (e.g. best-third allocation) until groups complete; writing it could stamp a team that later changes. Confirmed slots are final.

*Alternative considered:* write provisional too and overwrite later. Rejected — risks showing/!pickable wrong teams and churn on the matches list.

### Decision: Reuse the placeholder→real model, don't add a status column
Writing real team names is itself the confirmation signal — `isConfirmedMatch` flips to true with no new flag, exactly as manual editing does today. This keeps a single source of truth for "confirmed" and means the matches list / detail / pickability all light up on the next request with no extra wiring.

### Decision: Admin action on `/admin/matches`, mirroring "Sync now"
`confirmKnockoutTeams` is a server action: assert admin, scope to the managed competition, load its matches via the service-role client, compute updates, apply them (a small number of `update` calls by id, or a batched upsert), `revalidatePath`/`revalidateTag` the match surfaces, and return `{ updated, fixtures }` for inline display. It is **not** an `operation_runs` job — it is fixture maintenance, not a scheduled pipeline, so it lives beside the existing fixture controls rather than in the operations control room.

*Alternative considered:* an operations-dashboard job kind. Rejected — adds cron/schedule scaffolding for something inherently manual and fixture-scoped.

### Decision: Idempotent by construction
Because updates are only emitted for confirmed slots that differ from the stored value, a second run with unchanged standings produces zero updates. Re-running after more groups complete fills the newly-confirmed slots.

## Risks / Trade-offs

- **Stamping a team while a group is mid-recompute** → mitigated by writing confirmed-only (group complete); a provisional reshuffle never reaches the fixtures.
- **Overwriting an admin's manual correction** → the action only changes a side that is still a placeholder *or* whose stored value differs from a confirmed resolution; since confirmed resolutions are final and correct, agreement is expected. (If an admin hand-set a wrong real team, the action would not "fix" it — it only acts on placeholders and confirmed diffs; document that manual edits remain authoritative for already-confirmed sides.)
- **Later-round chains** → only slots whose feeders are final resolve as confirmed, so the action naturally no-ops on unresolved later rounds; it does the right thing when re-run after those results land.

## Migration Plan

Pure additive feature. Deploy; an admin clicks "Confirm knockout teams" once the group stage is complete to stamp the R32. No data migration, no schema change. Rollback = revert the diff (any teams already written stay, which is correct).

## Open Questions

- Should the action also be exposed as a button per-round, or is a single all-resolvable-fixtures pass enough? (Default: single pass.)
- Should it emit a per-fixture before/after list in the summary, or just a count? (Default: count + the list of updated fixture labels.)
