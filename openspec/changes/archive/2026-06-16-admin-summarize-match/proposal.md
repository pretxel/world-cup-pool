## Why

AI match recaps are generated only by the cron `sync_matches` pass, so an admin
has no way to produce (or retry) a recap for a specific match on demand — e.g.
right after correcting a final score, or when the cron pass skipped a match. A
recap built from an empty timeline is also low value: today generation will run
from the score alone even when zero `match_events` were ingested. Admins need a
one-click "Summarize" control on the match they are managing, and that control
must only act when there is real event data to summarize.

## What Changes

- Add a per-match **Summarize** button in the admin matches management view,
  shown for `final` matches that have event data and no recap yet.
- Add an admin Server Action that validates admin auth, that the match belongs
  to the managed competition, and that the match has `match_events`, then
  generates and persists the recap via the existing summary generator.
- Add a **`no-events`** precondition to recap generation: `generateMatchSummary`
  skips (does not call OpenRouter, writes nothing) when the match has zero
  `match_events`. This makes "summarize only when event data exists" authoritative
  for both the new manual path and the existing cron pass.
- Surface the outcome inline (generated / already exists / no events / not final
  / generator disabled / error) using the existing admin action-status pattern,
  and show an at-a-glance "recap ready" indicator when a summary already exists.
- Add localized strings (en/es/fr) for the button and every outcome message.

No breaking changes. The cron pass keeps working; it now skips event-less finals
instead of summarizing them from the score alone.

## Capabilities

### New Capabilities
- `admin-match-summary`: an admin-triggered, per-match recap control — the
  management-view button, the Server Action behind it (auth + managed-competition
  + event-data validation), and the inline outcome feedback.

### Modified Capabilities
- `match-ai-summary`: recap generation gains a `no-events` precondition — it does
  not generate or persist a recap for a match that has no `match_events`. Applies
  to both the manual admin trigger and the cron pass.

## Impact

- **New**: admin Server Action for single-match summarization (in
  `app/[locale]/(admin)/admin/matches/actions.ts`); a `<SummarizeMatchButton>`
  client component mirroring `ResendResultEmailsButton`.
- **Modified**: `lib/matches/match-summary.ts` (add `no-events` reason +
  event-count check before the OpenRouter call); the admin matches page
  (`app/[locale]/(admin)/admin/matches/page.tsx`) to render the button, the
  "recap ready" indicator, and the result `ActionStatus`; `messages/{en,es,fr}.json`.
- **Writes**: `match_summaries` via the service-role admin client (unchanged
  insert path, RLS-bypassing). No schema/migration change.
- **Tests**: extend `tests/match-summary.test.ts` for the `no-events` gate
  (and fix the existing zero-events unique-violation case to use real events);
  add coverage for the admin action's validation + outcome mapping.
- **Out of scope**: regenerating/overwriting an existing recap; recording the
  manual trigger in operations-monitoring (`OperationKind` stays the fixed union).
