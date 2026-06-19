## Why

Predictions lock the instant kickoff hits (`lib/match-utils.ts` `lockReason` returns `"kickoff"` once `kickoff_at <= Date.now()`; `prediction-form.tsx`/`actions.ts` then disable the form). On the public matches list (`app/[locale]/(public)/matches/page.tsx`, the inline `MatchRowCard`) a still-pickable fixture shows a static "Pick" label and its local kickoff time — there is nothing that conveys *the window is about to close*. The countdown lives only on the match detail page (`components/kickoff-countdown.tsx`, used in `prediction-form.tsx` and `[matchId]/page.tsx`), so a user scanning the list has no signal that a fixture locks in minutes and no nudge to act before it does.

`análisis.md` calls this out twice: friction #5 ("Lock duro al kickoff sin gracia ni aviso visual … Sin badge 'se cierra en 5 min'") and medium bet **M1** ("Badge 'se cierra en 5 min' + toast de urgencia en filas de partido → urgencia visual/temporal → acción inmediata antes del lock", effort Med / impact Alto). This change brings the closing-soon signal to the list, where the user is already deciding what to pick.

## What Changes

- Add a per-row "closes in" urgency state to `MatchRowCard` for fixtures that are **still pickable** (scheduled, unlocked) and whose kickoff is **imminent** (within a fixed lead window, e.g. ≤5 minutes away). Such rows SHALL show a live countdown badge ("closes in 4:32") and subtle urgency styling, replacing the static "Pick" affordance for those rows only.
- Render the countdown with a small client component (extending/reusing the existing `components/kickoff-countdown.tsx` countdown logic, which already ticks every second from the client clock) so the badge counts down in the visitor's real time and resolves to the locked state at kickoff without a page reload.
- Leave every other row unchanged: not-yet-imminent scheduled rows keep the static "Pick" label, and live / locked / final / cancelled / already-picked rows keep their current badges. The urgency state is purely additive to the open-and-imminent case.
- Add the new copy to the `matches` i18n namespace in `messages/{en,es,fr,de}.json`.
- No schema, no cron, no Supabase Realtime, no new data fetch — the kickoff timestamp and lock rules already exist on each `MatchRow`.

## Capabilities

### New Capabilities
- `match-row-lock-urgency`: A closing-soon urgency state on the `/matches` fixture rows — a live "closes in mm:ss" countdown badge plus subtle urgency styling on still-pickable rows whose kickoff is imminent, nudging the pick before the kickoff lock, and resolving to the locked state on the client when kickoff hits.

### Modified Capabilities
<!-- None at the spec level. MatchRowCard gains an imminent-lock branch, but no existing capability spec changes its requirements. -->

## Impact

- **Matches page**: `app/[locale]/(public)/matches/page.tsx` — `MatchRowCard` (currently a server-rendered `<Link>`) gains an imminent-lock branch. The decision uses the already-computed `uiStatus` plus the row's `kickoff_at`; only the `scheduled` (unlocked, unpicked) case can become "closing soon". The countdown badge is the only client island added to the row.
- **Countdown component**: `components/kickoff-countdown.tsx` (or a thin sibling) — reused for the second-resolution, client-clock countdown and the at-kickoff transition to the locked label. Its existing tick/lock logic already covers both states.
- **i18n**: new `matches` keys (e.g. `rowClosesIn`, `rowClosingSoon`) in `messages/{en,es,fr,de}.json`.
- No schema changes, no migration, no cron, no Realtime, no new dependency, no new query. The matches list already loads `kickoff_at`, `status`, and the per-user picked set.
