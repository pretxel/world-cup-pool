## Why

When a match ends, the live feed leaves behind a rich `match_events` timeline (goals, cards, subs) that no one revisits. A short, readable recap turns that raw play-by-play into something a pool member actually wants to read after the final whistle. We have the data and the post-final sync hook already; we just need to generate and store the narrative.

## What Changes

- Add a `match_summaries` table storing one AI-generated recap per match (summary text, model/provider used, token usage, generation timestamp), keyed to `matches(id)`.
- Generate the summary once a match transitions to `final`, driven from the existing result-sync flow, using the match's `match_events` feed plus final score as the prompt input.
- Integrate **OpenRouter** as the LLM provider via a new `lib/ai/` client, gated by a new `OPENROUTER_API_KEY` env var; the step is isolated (try/catch) so a summary failure never blocks score writes.
- Make generation idempotent (one summary per match) and recorded as an operation run for monitoring.
- Surface the stored summary on the match-detail view (read-only, locale-aware) and via the per-match live API payload once present.

## Capabilities

### New Capabilities
- `match-ai-summary`: persistence model for AI match recaps, the post-final generation trigger and idempotency rules, the OpenRouter client + env gating + isolation/recording contract, and how a stored summary surfaces to viewers.

### Modified Capabilities
<!-- None: generation hangs off the existing automated-results sync flow and the live-match-feed payload is extended additively; all new behavior lives in the new capability spec. -->

## Impact

- **Database**: new `supabase/migrations/<ts>_match_summaries.sql`; regenerated `lib/database.types.ts`.
- **New code**: `lib/ai/openrouter.ts` (client), `lib/matches/match-summary.ts` (generate + persist), wired into `lib/result-sync/core.ts` / the sync cron after a match reaches `final`.
- **Config**: `OPENROUTER_API_KEY` (+ optional model id) added to `.env.example` and `lib/env.ts`.
- **API/UI**: `GET /api/matches/[matchId]/live` payload gains an optional `summary`; match-detail page renders it.
- **Dependencies**: no new package required (OpenRouter is OpenAI-compatible over `fetch`); operation tracked through existing `recordRun`.
