## 1. Database

- [x] 1.1 Add `supabase/migrations/<ts>_match_summaries.sql`: `match_summaries` table with `id` uuid pk, `match_id` uuid FK → `matches(id)` on delete cascade, `content` text not null, `provider` text, `model` text, `prompt_tokens`/`completion_tokens` int nullable, `locale` text, `generated_at` timestamptz default now(), `created_at`/`updated_at`
- [x] 1.2 Add unique constraint on `match_id` (one summary per match) and an index on `match_id`
- [x] 1.3 Enable RLS: public `select`, writes restricted to service role (match the `match_events` policy pattern)
- [x] 1.4 Apply migration and regenerate `lib/database.types.ts`

## 2. Config / Env

- [x] 2.1 Add `OPENROUTER_API_KEY` and optional `OPENROUTER_MODEL` to `.env.example`
- [x] 2.2 Wire both into `lib/env.ts` (server-only; key optional so feature stays dormant when unset)

## 3. OpenRouter client

- [x] 3.1 Create `lib/ai/openrouter.ts` with a `fetch`-based `POST /api/v1/chat/completions` call, default model, `server-only` import, and typed request/response
- [x] 3.2 Return `null` (no throw) when `OPENROUTER_API_KEY` is unset; surface usage tokens from the response

## 4. Summary generation

- [x] 4.1 Create `lib/matches/match-summary.ts`: load a match + its `match_events` ordered by `sequence`, build the system+user prompt (concise factual recap **in English** grounded in events + score); store `locale = 'en'`
- [x] 4.2 `generateMatchSummary(matchId)`: skip if a `match_summaries` row already exists; skip if status ≠ `final`; call OpenRouter; persist via admin client (insert, on-conflict do nothing for idempotency)
- [x] 4.3 Add a batch pass `generatePendingSummaries()` that finds `final` matches lacking a summary, for the sync trigger and future backfill

## 5. Wire into result sync

- [x] 5.1 Invoke summary generation after `final`/score writes in the sync flow (`lib/result-sync/core.ts` and/or `app/api/cron/sync-matches/route.ts`), isolated in try/catch so it never blocks score writes
- [x] 5.2 Surface the pass inside the existing `recordRun("sync_matches", "cron", ...)` (folded in alongside `syncLiveEvents`/`dispatchResultEmails`, returning a `summaries` count) rather than adding a new `generate_summaries` `OperationKind` — the kind union is fixed by a DB CHECK constraint + dashboard i18n labels, so a new kind would balloon scope. The isolation + run-tracking intent is met

## 6. Surface the summary

- [x] 6.1 Extend `LiveFeedPayload` and `GET /api/matches/[matchId]/live` to include an optional `summary` when a row exists (absent otherwise)
- [x] 6.2 Render a read-only summary section on the match-detail view (English recap body, localized section labels); omit entirely when no summary exists

## 7. Tests & verification

- [x] 7.1 Unit-test `generateMatchSummary`: skips non-final, skips when summary exists, short-circuits when key unset, persists on success (mock OpenRouter)
- [x] 7.2 Test the live API includes/omits `summary` correctly and the isolation (generation failure does not block score writes)
- [x] 7.3 Run `npm run lint`, `npm run typecheck`, `npm run test`
