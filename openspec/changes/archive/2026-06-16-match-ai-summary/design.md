## Context

The live feed already ingests per-match play-by-play into `match_events` (migration `20260615000000_match_events.sql`) and the cron-driven result sync (`lib/result-sync/core.ts`, `app/api/cron/sync-matches/route.ts`) flips matches to `status='final'` and calls `compute_match_scores`. The post-final moment is where a recap becomes useful, and the sync flow is the natural trigger point — it already knows which matches it just finalized and already isolates side-effects (e.g. `syncLiveEvents`, `dispatchResultEmails`) in try/catch and tracks work via `recordRun`. There is no existing LLM integration in the repo, so the AI provider and its env wiring are net-new. Next.js is 16.2.6 (App Router) with breaking changes vs. common training data — consult `node_modules/next/dist/docs/` before writing route/`after()` code.

## Goals / Non-Goals

**Goals:**
- Generate exactly one concise recap per match after it reaches `final`, grounded in the match's `match_events` + final score.
- Use OpenRouter as the LLM provider, gated by `OPENROUTER_API_KEY`, degrading cleanly when unset.
- Keep generation fully isolated: a summary failure never affects score/status writes.
- Persist summaries idempotently and surface them read-only via the live API + match-detail UI.

**Non-Goals:**
- Regeneration / editing / versioning of summaries (one-shot per match; manual re-run can come later).
- Streaming the summary to the client or live-updating it mid-match.
- Multi-locale generation — summaries are generated in **English** only; the `locale` column exists for future expansion.
- A new admin UI for summaries.

## Decisions

**Trigger from the sync core, after `final` is committed.** Generation hangs off the same flow that sets `status='final'` rather than a DB trigger or a separate cron. Rationale: the sync already enumerates finalized matches, runs server-side with the admin client, and has the isolation+recording primitives. A Postgres trigger can't call OpenRouter; a separate cron would duplicate "which matches are newly final" detection. Alternative considered: a dedicated `/api/cron/generate-summaries` sweeping `final` matches lacking a summary — kept as a possible fallback/backfill but not the primary path.

**Isolation via try/catch + `recordRun`, mirroring `syncLiveEvents`/`dispatchResultEmails`.** The generation pass is wrapped so it cannot throw into the score-write path, and each pass is recorded as an operation run (`kind: "generate_summaries"`) for monitoring. Use Next.js `after()` where the trigger is request-scoped so generation runs after the response is sent.

**OpenRouter over `fetch`, no new dependency.** OpenRouter exposes an OpenAI-compatible `POST /api/v1/chat/completions`. A thin `lib/ai/openrouter.ts` client over `fetch` avoids pulling in the OpenAI SDK and keeps the surface tiny. Env: `OPENROUTER_API_KEY` (required to run) and `OPENROUTER_MODEL` (optional, defaulted). Add both to `.env.example` and `lib/env.ts`. Alternative considered: Vercel AI Gateway / AI SDK — heavier and unnecessary for one non-streaming call; revisit if more AI features land.

**Idempotency at the database.** `match_summaries.match_id` is unique; the generator checks for an existing row (and respects the unique constraint as a backstop) before spending an LLM call. One summary per match, safe under concurrent sync instances.

**Prompt grounded in events + score.** Serialize the ordered `match_events` (minute, team, type, player, detail) plus team names and final score into the user message; system prompt constrains the model to a short factual recap **in English** with no invented facts. Store `content`, `provider`, `model`, token usage, `locale` (`'en'`), `generated_at`.

**Surface additively.** Extend the `LiveFeedPayload` with an optional `summary`; the match-detail page reads it (or queries the table server-side) and renders a read-only section only when present. No change to existing live-feed requirements — purely additive.

## Risks / Trade-offs

- **LLM latency/cost on each finalize** → Generate once per match (idempotent), isolate so it never blocks sync, default to a small/cheap model, cap output tokens.
- **Hallucinated match facts** → Constrain the prompt to provided events only; store raw events in `payload`-style context is unnecessary, but keep the recap short and factual. Acceptable for a non-authoritative recap; scores/standings remain sourced from `matches`.
- **Missing/late events at finalize time** → A match may go `final` before all events ingest. Mitigation: allow score-only summaries; the idempotency-by-existence check means a backfill cron could (later) fill matches that ended with no events. Document the one-shot limitation.
- **Provider outage / key unset** → Short-circuit silently (no row, no throw); the match simply has no summary, which the UI already handles by omitting the section.
- **Secret handling** → `OPENROUTER_API_KEY` is server-only; the client lives behind `lib/ai/` and is only invoked from sync/server code using the admin client. Never import into client components.

## Migration Plan

1. Add `supabase/migrations/<ts>_match_summaries.sql` (table, unique `match_id`, RLS: public select, service-role write) and regenerate `lib/database.types.ts`.
2. Add `OPENROUTER_API_KEY` / `OPENROUTER_MODEL` to `.env.example` and `lib/env.ts`; deploy with the key set in prod (feature stays dormant until the key exists).
3. Ship `lib/ai/openrouter.ts` + `lib/matches/match-summary.ts`, wired into the sync core's post-final path under try/catch + `recordRun`.
4. Extend the live API payload + match-detail UI to render the summary.
5. Rollback: unset `OPENROUTER_API_KEY` to disable generation; the table and additive UI are inert without summaries and can be dropped via a follow-up migration if abandoned.

## Open Questions

- Which default model on OpenRouter (cost vs. quality) — pick a small instruct model as the default, overridable via `OPENROUTER_MODEL`.
- Should we backfill summaries for matches already `final` at ship time — out of scope here; a one-off sweep can reuse the same generator.
- ~~Locale: generate in the pool's primary locale now, or always English~~ — **Resolved: always English.** Summaries are generated in English; the `locale` column (`'en'`) leaves room to revisit.
