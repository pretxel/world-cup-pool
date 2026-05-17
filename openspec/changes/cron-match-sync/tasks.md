## 1. Env wiring

- [x] 1.1 Extend `lib/env.ts` to expose `footballDataToken: string | null` (from `FOOTBALL_DATA_TOKEN`) and `cronSecret: string | null` (from `CRON_SECRET`). Both nullable so missing env doesn't crash the build. (Skipped the `requireCronSecret()` helper — the route handler does its own check.)
- [ ] 1.2 Add the two env vars to Vercel project settings (Production + Preview) via the dashboard or `vercel env add`. (Manual step — user must do this before the first cron fires.)

## 2. Team-name aliases

- [x] 2.1 Create `lib/team-name-aliases.ts` exporting `REMOTE_TO_LOCAL_TEAM` and `normalizeTeamName(remote)`. Seeded with the common diffs: USA → United States, Korea Republic → South Korea, Côte d'Ivoire → Ivory Coast, Czechia → Czech Republic, Türkiye → Turkey, Cabo Verde → Cape Verde, DR Congo / Congo DR / "Democratic Republic of the Congo" → DR Congo, Curacao → Curaçao.

## 3. Cron route handler

- [x] 3.1 Create `app/api/cron/sync-matches/route.ts`. Auth via `Bearer ${env.cronSecret}` (allows bypass in non-prod with no secret set, for local testing). Returns 204 + `x-skipped: missing-env` if `FOOTBALL_DATA_TOKEN` is missing. Fetches `https://api.football-data.org/v4/competitions/WC/matches?season=2026`, indexes local matches by `home|away|YYYY-MM-DD`, applies status/score mapping (FINISHED → score+status='final', IN_PLAY/PAUSED → status='live' unless already final, never downgrades a final), calls `compute_match_scores` for every touched match. Returns JSON summary.

## 4. Vercel cron registration

- [x] 4.1 Create `vercel.json` with `crons: [{ path: "/api/cron/sync-matches", schedule: "*/10 * * * *" }]`. Requires Vercel Pro plan.

## 5. Tests

- [x] 5.1 `tests/team-name-aliases.test.ts` — alias roundtrip + pass-through + trim + null safety.
- [x] 5.2 `tests/sync-matches.test.ts` — mocks `fetch` and the admin Supabase client. Covers: 401 missing bearer, 401 wrong bearer, FINISHED → write score + RPC, IN_PLAY when scheduled → flip to live, IN_PLAY when already final → no write, unmatched remote row → logged + no write.
- [x] 5.3 `pnpm test` — 47/47 pass (10 new).

## 6. Verification

- [x] 6.1 `pnpm typecheck` — zero errors.
- [x] 6.2 `pnpm lint` — zero errors.
- [x] 6.3 `openspec validate cron-match-sync` — valid.
- [ ] 6.4 Manual (post-deploy): hit `https://world-pool.edselserrano.com/api/cron/sync-matches` without auth → 401. With `Bearer ${CRON_SECRET}` → 2xx JSON summary. With env unset on a fresh deploy → 204 with `x-skipped`.
- [ ] 6.5 Manual: check Vercel dashboard → Crons tab shows `*/10 * * * *` scheduled (requires Pro plan).
