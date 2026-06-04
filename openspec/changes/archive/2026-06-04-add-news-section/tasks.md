## 1. Database

- [x] 1.1 Add a migration `supabase/migrations/<ts>_news_articles.sql`: create `public.news_articles` (id uuid pk, external_id text null, source_url text not null, dedup_key text not null unique, title text not null, summary text null, image_url text null, source text null, published_at timestamptz not null, created_at timestamptz default now(), updated_at timestamptz default now())
- [x] 1.2 Add index `news_articles_published_at_idx` on `(published_at desc)`
- [x] 1.3 Add the `set_updated_at` trigger to `news_articles` (reuse existing function)
- [x] 1.4 Enable RLS; add a public `select` policy for `anon` + `authenticated`; add no write policy (service-role only)
- [ ] 1.5 Apply the migration locally and confirm anon select works while anon insert is rejected — BLOCKED: Docker/local Supabase not running. Run `supabase db push` (or start Docker + `supabase db reset`) before deploy.

## 2. Types & env

- [x] 2.1 Regenerate `lib/database.types.ts` to include `news_articles` (hand-authored to match the migration — Docker down; re-run `supabase gen types` when DB is up to confirm parity)
- [x] 2.2 Add `NewsArticleRow` alias in `lib/db.ts`
- [x] 2.3 Add `newsApiToken: process.env.NEWS_API_TOKEN ?? null` and optional `newsApiUrl` to `lib/env.ts`
- [x] 2.4 Document `NEWS_API_TOKEN` (and `NEWS_API_URL`) in `.env.example`

## 3. Sync logic (lib)

- [x] 3.1 Create `lib/news.ts`: `fetchNewsFeed(token, url)` returning normalized articles
- [x] 3.2 Add `normalizeSourceUrl` (strip query/trailing slash) and `dedupKeyFor` helpers
- [x] 3.3 Map the provider response shape (NewsAPI `everything`) to the normalized type
- [x] 3.4 Add unit tests in `tests/news.test.ts` for normalization + dedup-key stability (idempotency)

## 4. Cron route

- [x] 4.1 Create `app/api/cron/sync-news/route.ts` mirroring `sync-matches`: Bearer `CRON_SECRET` auth, `204 x-skipped: missing-env` when secret missing in prod or token absent
- [x] 4.2 Fetch via `lib/news.ts`, upsert into `news_articles` with `onConflict: dedup_key` using the admin client
- [x] 4.3 Return JSON summary `{ fetched, inserted, updated, skipped, errors }`; log a one-line summary
- [x] 4.4 Add the cron entry to `vercel.json` (`/api/cron/sync-news`, schedule `0 */6 * * *`)

## 5. Public News page

- [x] 5.1 Create `app/[locale]/(public)/news/page.tsx` (Server Component): select latest N articles ordered by `published_at` desc
- [x] 5.2 Render headline cards (title, blurb, source, date, optional thumbnail) linking to `source_url` with `target="_blank" rel="noopener noreferrer"`
- [x] 5.3 Render a localized empty state when there are no articles
- [x] 5.4 Add page-level metadata (title/description) for the News route

## 6. Nav & i18n

- [x] 6.1 Add a `news` link to the nav link list in `components/site-nav.tsx`
- [x] 6.2 Add a `news` namespace + `nav.news` to `messages/en.json`
- [x] 6.3 Mirror the `news` namespace + `nav.news` in `messages/es.json` and `messages/fr.json`

## 7. Verify

- [x] 7.1 Run `pnpm typecheck` and `pnpm lint` clean
- [x] 7.2 Run `pnpm test` (62/62 pass, incl. 15 news tests)
- [ ] 7.3 Manually hit `/api/cron/sync-news` with the secret + token, confirm rows upsert and a second run is idempotent — BLOCKED: needs running DB. NEWS_API_TOKEN set in `.env.local`.
- [ ] 7.4 Load `/en/news`, `/es/news`, `/fr/news` and confirm cards render, link out, and empty state works — BLOCKED: needs running DB + synced rows.

## 8. Adversarial review follow-ups (6 confirmed findings)

- [x] 8.1 HIGH: stored-XSS via `javascript:` in untrusted `source_url` → reject non-http(s) at ingest (`lib/news.ts isHttpUrl`), guard again at render (`news/page.tsx`), and add a DB CHECK `source_url ~* '^https?://'`
- [x] 8.2 MEDIUM: untrusted `image_url` scheme → null off-scheme images at ingest + render guard
- [x] 8.3 LOW: `fetched` reported post-normalization count → `fetchNewsFeed` now returns `rawCount`; route reports raw `fetched` and computes `skipped = rawCount - kept`
- [x] 8.4 LOW: dead `skipped` summary field → now populated (see 8.3)
- [x] 8.5 LOW: news API token in URL query string → header-only (`X-Api-Key`); dropped `apiKey` query param
- [ ] 8.6 LOW: no app-wide Content-Security-Policy (defense-in-depth) — DEFERRED: a global CSP must be validated against the GA inline script, next/font, and Supabase; needs a running app to avoid breaking the site. Track as a separate hardening change.
