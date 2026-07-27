## Context

The World Cup pool app has been rebranded to **WinScore** and is now hosted at `winscore.me`. The current Vercel project (`world-cup-pool`) still serves the old app at `world-cup-pool-*.vercel.app` with cron jobs actively running. All traffic must be permanently redirected to the new domain.

**Current state:**
- `vercel.json` has only cron job definitions, no redirect rules.
- Middleware handles locale resolution and auth; adding a redirect there would run after the request reaches the framework.
- `next.config.ts` has no redirects defined.

**Constraints:**
- The redirect must cover all paths: pages, API routes, static assets, cron endpoints.
- Minimal code change — ideally zero framework code touched.
- The redirect must be a permanent (308) redirect for SEO.

## Goals / Non-Goals

**Goals:**
- Redirect every incoming request on the old domain to `https://winscore.me/` with a 308 Permanent Redirect.
- Preserve SEO value by signaling to search engines that the site has permanently moved.
- Route the redirect at the CDN/edge layer for zero latency and complete coverage.

**Non-Goals:**
- Preserving individual path mappings (e.g., `/matches` → new path) — a flat root redirect is sufficient.
- Migrating cron jobs to the new project — cron migration is a separate concern, handled by creating equivalent cron definitions on the winscore.me Vercel project.
- Removing or archiving the old Vercel project — it stays live to serve the redirect.

## Decisions

### Decision 1: Use `vercel.json` redirects over middleware or `next.config.ts`

**Choice:** Add a `redirects` array to `vercel.json`.

**Alternatives considered:**
- **Middleware (`middleware.ts`)**: would cover most paths but not assets excluded by the matcher pattern (favicons, images, etc.). Also adds framework execution overhead for every request.
- **`next.config.ts` `redirects()`**: covers framework-routed paths but misses static assets and has the same overhead.
- **`vercel.json` `redirects`**: runs at the Vercel Edge Network before any framework code. Covers **every** URL including static assets, API routes, and cron paths. Zero cold-start overhead. This is the standard approach for domain migrations on Vercel.

### Decision 2: Use 308 (Permanent Redirect) status code

**Choice:** 308 Permanent Redirect.

**Rationale:** 308 preserves the HTTP method (unlike 301 which may change POST to GET), important for API routes and form submissions. It also signals to search engines that the move is permanent, transferring SEO equity. The `vercel.json` redirects use `permanent: true` which maps to 308.

### Decision 3: Flat root redirect (no path preservation)

**Choice:** Map all source paths to `https://winscore.me/` (root), not `/location/$1`.

**Rationale:** The new WinScore site has a different information architecture. Path-level mapping would create broken links. A clean root redirect is simpler and safer. Players bookmarking deep links will land on the new homepage and navigate from there.

## Risks / Trade-offs

- **[Risk] Cron jobs stop working**: the 8 cron endpoints will be caught by the redirect. → **Mitigation**: Create equivalent cron definitions on the winscore.me Vercel project before or alongside the redirect deploy. This is a prerequisite.
- **[Risk] API consumers break**: if any external services call the old API routes, they'll receive a 308 instead of data. → **Mitigation**: Verify no external integrations depend on the old domain. All API consumers should already be pointed at the new domain.
- **[Trade-off] All paths go to root**: deep links won't resolve to equivalent content on the new site. This is acceptable because the new site structure differs and a 404 is worse UX than landing on the homepage.
