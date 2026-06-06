## Context

The `matches` table stores `home_team`/`away_team` as plain text. Group fixtures hold real country names; knockout fixtures hold placeholders (`"2nd Group A"`, `"Winner Match 73"`, …). The app already has a single source of truth for "is this a real country": `flagSlug(team)` in `lib/team-flag.ts` returns a slug for participating countries and `null` for placeholders/unknowns (a test keeps the map in sync with the seed). `TeamFlag` and the `match-team-filter` capability already rely on it.

The public list (`/matches`) currently shows every fixture; the detail page (`/matches/[matchId]`) renders a `PredictionForm` unless the user is signed out or the match is locked; `submitPrediction` validates status + kickoff. Admin (`/admin/matches`) has a create form, a result form, and delete — but no per-match field editor, even though `saveFixture` already performs an UPDATE when given an `id`.

User decisions for this change: (1) public visibility rule = **both teams confirmed** (not strict group-stage); (2) unconfirmed matches are **blocked end to end** — hidden from list, not pickable, detail shows a not-available state.

## Goals / Non-Goals

**Goals:**
- Hide unconfirmed (placeholder-team) fixtures from the public list, detail-pick flow, and prediction writes.
- Make a knockout fixture appear automatically the moment an admin sets both real teams — no publish step.
- Give admins a way to set/correct a fixture's teams and fields, and to see at a glance which fixtures are still unconfirmed.

**Non-Goals:**
- No `confirmed` column, migration, or RLS change — confirmation is derived from the team strings.
- No automatic bracket resolution (computing which team advances). Admins set teams manually.
- No change to the kickoff/status lock (`predictions-lock`) or to scoring.
- No change to admin auth (`assertAdmin` already guards the actions).

## Decisions

### D1: "Confirmed" is derived, not stored — `isConfirmedMatch(match)` in `lib/match-utils.ts`
A match is confirmed iff `flagSlug(home_team)` AND `flagSlug(away_team)` are both non-null. Reusing `flagSlug` keeps a single definition of "real team" shared with `TeamFlag` and `match-team-filter`, and the existing seed-sync test transitively guards it. No schema work, and editing a placeholder to a real country flips confirmation with zero extra state.

- **Alternative considered**: a stored `confirmed` boolean or a `teams_confirmed_at` timestamp. Rejected — adds a migration, a write path to keep in sync, and a second source of truth that can drift from the actual team strings.
- **Alternative considered**: gate on `stage = 'group'`. Rejected by the user — it would never surface knockout matches even after teams are known.

### D2: Gate the public list at the source, before filter/stats/grouping
In `matches/page.tsx`, derive `confirmed = list.filter(isConfirmedMatch)` immediately after the fetch and treat it as the base list everywhere downstream (team filter, `filterableTeams`, stats, day groups, empty state). This composes cleanly with `match-team-filter` (which filters the shown list) and keeps every count consistent with what's rendered. `filterableTeams` already excludes placeholders, so chips are unaffected.

### D3: Detail page renders a not-confirmed branch; the action rejects too
`matches/[matchId]/page.tsx` computes `confirmed = isConfirmedMatch(match)`. When false, the prediction section renders a "teams not confirmed yet" card instead of the sign-in/lock/`PredictionForm` ladder. `submitPrediction` independently re-checks confirmation (selecting `home_team, away_team`) and returns a localized error if unconfirmed — defense in depth so a stale client or direct POST can't write a pick for an unknown matchup. This is enforced at the action/UI layer (not RLS), since confirmation isn't a DB concept; it sits alongside, and does not alter, the existing `predictions-lock` rules.

- The detail page remains reachable by URL (no 404) so a shared knockout link degrades to an informative state rather than a dead end.

### D4: Admin edit form reuses `saveFixture` (UPDATE branch) + an Unconfirmed indicator
Each match row gains a collapsible/inline edit `<form action={saveFixture}>` with a hidden `id` and prefilled inputs for `stage`, `group_code`, `home_team`, `away_team`, `kickoff_at` (datetime-local), and `venue` — mirroring the existing "new fixture" form's fields and the same server validation. No new action is written. Rows whose match fails `isConfirmedMatch` show an **Unconfirmed** badge so admins can scan for work.

- `saveFixture`'s UPDATE branch skips the "kickoff must be in the future" guard (only inserts enforce it), so admins can edit past/near fixtures — correct for confirming teams on an imminent knockout match.
- **Note**: `kickoff_at` for datetime-local needs a value formatted as `YYYY-MM-DDTHH:mm`; the stored value is UTC ISO. The prefilled input uses the UTC wall-clock slice to stay deterministic (no hydration/timezone surprise), consistent with how the rest of admin treats times.

## Risks / Trade-offs

- **A real country missing from the flag map reads as "unconfirmed"** → it would be hidden publicly. Mitigation: the existing `team-flag` seed-sync test fails CI if a seeded country lacks a mapping, so this surfaces at build time, not in production.
- **Editing teams after picks exist** (shouldn't happen for placeholders, which have no picks, but possible if an admin edits a confirmed match) → existing predictions keep their `match_id`; scores recompute on result entry as today. Out of scope to reconcile, and unconfirmed→confirmed edits have no prior picks by construction.
- **Direct-URL pick attempt on an unconfirmed match** → blocked by D3's action check; returns a clear message rather than a silent no-op.
- **List/detail consistency during the brief window after an admin edit** → both `/admin/matches` and `/matches` are revalidated by `saveFixture`; the public surface updates on next request.

## Migration Plan

Pure additive frontend/action change. No DB migration. Deploy is the standard build; rollback reverts the commit. No data backfill — existing placeholder fixtures simply become hidden until edited.

## Open Questions

- None blocking. Whether to also surface a count of "unconfirmed remaining" in the admin header is a nice-to-have, left out for YAGNI.
