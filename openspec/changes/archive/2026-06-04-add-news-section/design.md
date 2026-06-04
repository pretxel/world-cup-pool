## Context

The app is Next.js 16 (App Router, Server Components) on Supabase, with next-intl for `en`/`es`/`fr` and an existing daily cron (`/api/cron/sync-matches`) that pulls from football-data.org using an admin (service-role) Supabase client. There is no editorial content today. We want a public, auto-updating News feed for World Cup 2026 with no manual authoring. The feed shows cards that link out to the original source; the app does not host article bodies.

This design reuses the established cron + service-role + nullable-env patterns rather than inventing new ones. football-data.org has no news endpoint, so news requires a separate third-party feed.

## Goals / Non-Goals

**Goals:**
- Public `/[locale]/news` feed of cached headlines, ordered newest first, links out to source.
- Auto-refresh via a scheduled cron that mirrors `sync-matches` (auth, token gate, `204 x-skipped`, JSON summary).
- Idempotent upserts — no duplicate rows across runs.
- Localized page chrome; content (titles) stays in the source language.
- No build crash when the news token is absent (nullable env, graceful skip).

**Non-Goals:**
- Per-article detail pages or hosting full article bodies (licensing + scope).
- Admin authoring UI, editing, comments, reactions, notifications.
- Translating article titles/bodies into the three locales.

## Decisions

**1. Data source: external news API (NewsAPI-style), cached in Supabase.**
Chosen over (a) admin-curated posts — no editorial effort wanted; (b) static MDX — every post is a deploy. Cron pulls a keyword query (e.g. "World Cup 2026", "FIFA World Cup") and caches results. The route is written source-agnostically: `NEWS_API_TOKEN` + optional `NEWS_API_URL` so the provider can change without touching the schema. Helper logic (fetch, normalize, dedup key) lives in `lib/news.ts` for unit testing, mirroring how match logic is factored out.

**2. Cache in Supabase, read directly from the Server Component.**
Same shape as matches: `news_articles` table, public read RLS, service-role writes from cron. The feed page is a Server Component selecting `order('published_at', desc).limit(N)` — no client fetch, no API key in the browser. Alternative (fetch the third-party API at request time) rejected: leaks the key, couples page latency to a rate-limited upstream, and risks blank pages on upstream outage.

**3. Dedup by stable external key.**
Store `external_id` (provider id when present) else a normalized `source_url`, with a unique constraint. Cron does `upsert(..., { onConflict })`. Guarantees idempotency so re-runs update instead of duplicate. Normalization strips query strings/trailing slashes to avoid near-duplicate URLs.

**4. Schedule + freshness.**
Add a `vercel.json` cron. News moves faster than the daily match sync — run it a few times a day (e.g. every 6h, `0 */6 * * *`). Keep a bounded number of articles surfaced (limit in query); optionally prune old rows in a later iteration.

**5. RLS: public read only.**
`select` policy for `anon`+`authenticated`; no insert/update/delete policy, so only the service-role cron writes. Matches the read-only posture of public match data.

**6. Nav + i18n.**
Add a `news` link to the existing nav link list (`site-nav` builds labels from a `news` message key). Add a `news` namespace to `messages/{en,es,fr}.json` for heading, intro, empty state, source/date labels, "read more".

## Risks / Trade-offs

- **Feed quality / off-topic results** → Constrain the query (exact phrase + domain allowlist if the provider supports it); store `source` so low-quality sources can be filtered later.
- **Content licensing / attribution** → Cards link out to the source and display the source name + only a short summary; we do not reproduce full bodies. Confirm the chosen provider's ToS permits headline+snippet display.
- **Rate limits / upstream outage** → Cron caches into Supabase, so the page is decoupled from upstream; a failed sync just means staler cache, never a broken page. Token-gate returns `204` instead of throwing.
- **Duplicate near-URLs from different providers/redirects** → URL normalization + unique key; accept that cross-provider duplicates of the same story may still slip through (acceptable for v1).
- **Mixed-language titles on localized pages** → Accepted non-goal; chrome is localized, titles stay native. Could add a `language` column later to filter per-locale.
- **Stale rows accumulating** → v1 simply limits the query; pruning is a follow-up.

## Migration Plan

1. New Supabase migration: create `news_articles`, index on `published_at`, unique key on the dedup column, enable RLS + public `select` policy.
2. Regenerate `lib/database.types.ts`; add `NewsArticleRow` alias in `lib/db.ts`.
3. Add `newsApiToken` (+ optional url) to `lib/env.ts` (nullable) and document in `.env.example`.
4. Add `lib/news.ts` (fetch/normalize/dedup) + cron route + `vercel.json` entry.
5. Add the public route, nav link, and `news` i18n strings.
6. Deploy. Rollback: revert the nav link + route to hide the feature; the table and cron are inert without the env token and harmless if left.

## Open Questions

- Which provider exactly (NewsAPI.org vs GNews vs other) and does its free tier + ToS allow our query volume and snippet display? Wiring is provider-agnostic, but the token/URL/response-mapping in `lib/news.ts` must target one. Default assumption: NewsAPI.org `everything` endpoint.
- Do we want basic moderation (domain allowlist) in v1, or accept raw feed and iterate?
