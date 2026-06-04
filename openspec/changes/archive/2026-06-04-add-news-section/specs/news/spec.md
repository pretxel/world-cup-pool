## ADDED Requirements

### Requirement: Public news feed
The system SHALL expose a public News page at `/[locale]/news` that lists cached World Cup 2026 headlines as cards. Each card SHALL show the title, a short blurb, the source name, and the published date, and MAY show a thumbnail. Each card SHALL link to the original article on the source site, opening in a new tab with `rel="noopener noreferrer"`. The page SHALL require no authentication.

#### Scenario: Visitor views the feed
- **WHEN** an unauthenticated visitor opens `/en/news`
- **THEN** the page renders the most recent articles ordered by published date descending
- **AND** each card links to its `source_url` on the external site

#### Scenario: Empty feed
- **WHEN** no articles exist in `news_articles`
- **THEN** the page renders an empty-state message instead of an error

#### Scenario: Localized chrome
- **WHEN** the visitor opens `/es/news` or `/fr/news`
- **THEN** the page chrome (heading, blurb, empty state, "read more") is rendered in that locale using the `news` message namespace

### Requirement: Cached article storage
The system SHALL store fetched headlines in a `news_articles` table. Each row SHALL include a stable external id or source URL used as the dedup key, title, optional summary, optional image URL, source name, source URL, and a published timestamp. The table SHALL be publicly readable via RLS and SHALL NOT be writable by anonymous or authenticated end users — only the service role (cron) writes to it.

#### Scenario: Public read, no public write
- **WHEN** the browser Supabase client selects from `news_articles`
- **THEN** the rows are returned
- **AND** an insert/update/delete attempt from the anon or authenticated role is rejected by RLS

#### Scenario: Ordered retrieval
- **WHEN** the feed queries articles
- **THEN** results are ordered by `published_at` descending using an index on `published_at`

### Requirement: Automated news sync
The system SHALL provide a cron route `/api/cron/sync-news` that fetches World Cup 2026 headlines from an external news feed and upserts them into `news_articles`. The route SHALL authenticate with `Bearer ${CRON_SECRET}` when the secret is set, SHALL return `204` with header `x-skipped: missing-env` when the cron secret is missing in production or the news API token is absent, and SHALL return a JSON summary of `{ fetched, inserted, updated, skipped, errors }` on success. The sync SHALL run on a schedule registered in `vercel.json`.

#### Scenario: Authorized sync
- **WHEN** the cron route is called with a valid `Bearer ${CRON_SECRET}` and a configured news API token
- **THEN** it fetches the feed, upserts articles, and returns a JSON summary

#### Scenario: Missing token
- **WHEN** the news API token is not configured
- **THEN** the route returns `204` with `x-skipped: missing-env` and writes nothing

#### Scenario: Unauthorized call
- **WHEN** the route is called in production without the correct `Authorization` header while `CRON_SECRET` is set
- **THEN** the route returns `401` and writes nothing

### Requirement: Deduplication and freshness
The sync SHALL deduplicate incoming articles by their stable external key (external id or normalized source URL) so repeated runs do not create duplicate rows. Re-fetching an existing article SHALL update its mutable fields (title, summary, image) rather than insert a new row.

#### Scenario: Repeated sync is idempotent
- **WHEN** the sync runs twice over a feed containing the same article
- **THEN** the article exists exactly once in `news_articles`
- **AND** the second run reports it under `updated`/`skipped`, not `inserted`
