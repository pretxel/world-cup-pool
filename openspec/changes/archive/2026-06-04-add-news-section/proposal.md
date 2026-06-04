## Why

The pool has matches, predictions, and a leaderboard, but no editorial layer to keep players engaged between their daily picks. A News section that surfaces fresh World Cup 2026 headlines gives people a reason to return, adds context around the fixtures they are predicting, and increases time on site without manual editorial work.

## What Changes

- Add a public **News** section at `/[locale]/news`: a feed of headline cards (title, blurb, source, published date, optional thumbnail) that link out to the original article.
- Add a `news_articles` table in Supabase to cache fetched headlines, with public read-only RLS and an index on `published_at`.
- Add a cron route `/api/cron/sync-news` that pulls World Cup 2026 headlines from an external news feed, deduplicates, and upserts them into `news_articles`. Auth, token-gating, and the `204 x-skipped` pattern mirror the existing `sync-matches` cron.
- Register the cron in `vercel.json` and add a **News** link to the site nav.
- Add `NEWS_API_TOKEN` (and optional `NEWS_API_URL`) to the env layer (`lib/env.ts`), nullable so the build never crashes on cold envs.
- Add i18n strings for the News page across `en` / `es` / `fr`.

Non-goals: per-article detail pages, on-site full article bodies (cards link out), comments, admin authoring UI, push notifications.

## Capabilities

### New Capabilities
- `news`: Public, auto-updating feed of cached external World Cup 2026 headlines — sourcing, freshness, deduplication, public read access, and the feed presentation rules.

### Modified Capabilities
<!-- No existing spec's requirements change. The cron sourcing here is a new feed
     distinct from automated-results (match scores), so it gets its own capability. -->

## Impact

- **Database**: new `news_articles` table + RLS policy + index (new migration).
- **API**: new `app/api/cron/sync-news/route.ts`; new cron entry in `vercel.json`.
- **App**: new route `app/[locale]/(public)/news/page.tsx`; nav link in `site-nav` / `site-nav-client`.
- **Lib**: `lib/env.ts` gains `newsApiToken` (+ optional url); possible `lib/news.ts` for the fetch/normalize/dedup helpers; `lib/database.types.ts` regenerated for the new table.
- **Config**: `.env.example` documents `NEWS_API_TOKEN`; `messages/{en,es,fr}.json` gain a `news` namespace.
- **External dependency**: a third-party news API (NewsAPI-style) — adds an API key, rate limits, and content-licensing/attribution considerations.
