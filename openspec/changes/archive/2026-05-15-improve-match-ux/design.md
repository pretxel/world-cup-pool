## Context

Three consumer pages render match data today:

- `app/(public)/matches/page.tsx` — grouped-by-day fixture list. Each row uses team-name text + a `MatchStateBadge`.
- `app/(public)/matches/[matchId]/page.tsx` — hero "scoreboard" panel with pitch-stripe background, then prediction form below.
- `app/(app)/my-picks/page.tsx` — list of the signed-in user's submitted picks.

Stack: Next.js 16 App Router (per `AGENTS.md`, this isn't standard Next.js — heed deprecation notices), React 19, Tailwind v4, `tw-animate-css` for animation utilities, `lucide-react` for iconography. No motion library installed.

Teams seeded in `supabase/seed/matches.sql` include the 48 WC2026 nations plus knockout placeholders like `"2nd Group A"`, `"3rd Group A/B/C/D/F"`, and `"Winner R32-1"`. The data model has no team ID — only a free-text `home_team`/`away_team`. Flag rendering must key off the string.

Venues are 16 stadiums across USA/Canada/Mexico (the 2026 host nations). Photo licensing is not a problem we want to solve in this PR — the component is built so photos are optional drop-ins.

## Goals / Non-Goals

**Goals:**
- Make matches feel like real fixtures: instantly recognizable countries via flags, clearer stage cues, richer detail-page hero.
- Zero new runtime deps. Static SVGs only. Animations from CSS utilities already in the project.
- Graceful degradation: knockout placeholders, unknown team names, and missing venue photos all render cleanly with a fallback.
- Server-component-first — only the few components that need client-side interactivity stay client.

**Non-Goals:**
- No team crests / kits / players (out of scope; copyright sensitive and not asked for).
- No animated transitions between routes — keep CSS-only entry animations on mount.
- No DB changes. No `team_id` foreign keys yet.
- No internationalization of team names. English-only.
- No fancy parallax or canvas effects. Tailwind utilities only.

## Decisions

**1. Flag asset strategy: vendor 48 SVGs under `public/flags/`, not the full `flag-icons` package.**

Alternatives considered:
- *Install the `flag-icons` npm package*: ~600KB of SVGs ship with the package, but our app only needs 48 of ~250. Static asset bloat + CSS import dance.
- *Use a hosted CDN (`flagcdn.com`, etc.)*: zero asset weight but adds a CSP/CORS axis and an external dependency for a core visual.
- *Emoji flags*: zero assets but renders inconsistently on Windows / Linux / some Android fonts.

Chosen: download the 48 SVGs we need from the MIT-licensed `lipis/flag-icons` repo into `public/flags/<iso>.svg`. License notice added to `public/flags/README.md`. Served as static assets via `next/image` with `unoptimized` (SVG) or `<img>`.

**2. Team → ISO mapping lives in `lib/team-flag.ts` as a const record.**

```ts
export const TEAM_FLAG: Record<string, string> = {
  "Argentina": "ar",
  "Brazil": "br",
  // ...
  "England": "gb-eng",
  "Scotland": "gb-sct",
};
```

ISO 3166-1 alpha-2 for most; `flag-icons` regional codes (`gb-eng`, `gb-sct`) for home nations. Function `flagSlug(teamName)` returns the slug or `null` for placeholders / unknown.

**3. `TeamFlag` component is server-renderable.**

```tsx
<TeamFlag team={match.home_team} size="md" />
```

Renders an `<img src="/flags/<slug>.svg" alt="<team> flag" />` with explicit `width`/`height` to prevent CLS. When `flagSlug(team)` returns `null`, renders a small neutral "?" chip. No JS needed.

**4. `StageIcon` is a switch over inline SVG paths.**

Six stages = six tiny inline SVGs (~200 bytes each). Lives in `components/stage-icon.tsx`. Server-renderable. Used alongside `stageLabel` on the match detail page.

**5. `VenueImage` is optional and self-fallback-aware.**

```tsx
<VenueImage venue={match.venue} className="..." />
```

Computes `slug = kebab-case(venue.split(",")[0])` → checks for `public/venues/<slug>.jpg` at build time? No — Next's static file resolution is request-time. We can't `fs.existsSync` from a Server Component in production without bundling logic. Instead: ship a manifest `lib/venues.ts` with the list of slugs that have photos. Component checks the manifest synchronously and either renders `next/image` or the existing pitch-stripe fallback. Photos can be added incrementally — when a slug is added to the manifest and the file dropped into `public/venues/`, it lights up.

Alternatives considered: dynamic `fetch('/venues/...').ok` check — wasteful round-trip. JS-side `onError={hide}` — works but causes layout shift. Manifest is the simplest reliable approach.

**6. Animations: CSS-only via `tw-animate-css` utilities.**

`tw-animate-css` ships utilities like `animate-in fade-in slide-in-from-bottom-2 duration-500`. Already installed (see `package.json:33`).

Animations chosen:
- Match detail hero panel: `animate-in fade-in slide-in-from-bottom-3 duration-500 ease-out` on mount.
- Stage chip: `animate-in zoom-in-50 duration-300 delay-100` for a tiny entrance.
- Final score numerals when `isFinal`: small `animate-in zoom-in-95 fade-in duration-400 delay-200` per side. (Score doesn't change after final, so a one-shot entrance is the right semantic — no live tickers.)
- Live status badge: existing dot + `animate-pulse` on the wrapper when status is `live`.
- `/matches` list rows: stagger via `style={{ animationDelay: `${i * 20}ms` }}` + `animate-in fade-in slide-in-from-bottom-1 duration-300`. Capped at e.g. 800ms total so long days don't feel slow.

No animations on `/my-picks` rows beyond hover lift (already present-ish via Tailwind `transition-colors`). Tasteful, not overwhelming.

**7. Respect `prefers-reduced-motion`.**

Animations are applied via Tailwind classes that already wrap in `@media (prefers-reduced-motion: no-preference)` per `tw-animate-css` defaults. Double-check by adding `motion-safe:` prefix where the underlying utility doesn't gate itself.

## Risks / Trade-offs

- **Risk**: missing flag for a future team rename (e.g. "Türkiye" vs "Turkey") → **Mitigation**: `flagSlug` returns `null` and the placeholder chip renders. No crash. Add a unit test that the mapping covers every distinct team currently in `supabase/seed/matches.sql`.
- **Risk**: SVGs ship to every page → **Mitigation**: they're static assets, served only when referenced. Each flag is ~1KB. Page weight grows by `n_visible_flags × 1KB`.
- **Risk**: stagger animation feels janky if list is large → **Mitigation**: stagger cap (max delay 800ms) and short per-row duration (300ms).
- **Risk**: animations on slow devices → **Mitigation**: all animations are GPU-friendly (opacity + transform). No layout-triggering animations. Reduced-motion respected.
- **Risk**: venue manifest drifts from `/public/venues/` contents → **Mitigation**: small + easy-to-grep; can add a lint script later if needed. Out of scope here.

## Migration Plan

1. Vendor 48 SVGs into `public/flags/` + `public/flags/README.md` with attribution.
2. Add `lib/team-flag.ts` + `lib/venues.ts` (empty manifest by default).
3. Add new components.
4. Wire into the three consumer pages.
5. Apply animations.
6. Tests + typecheck + lint.
7. Manual visual verify in dev + on preview deploy.

Rollback: revert the PR. No DB or runtime state involved.

## Open Questions

- Want venue photos shipped now or deferred? Deferred per scoping — manifest stays empty initially; the component falls back cleanly. User can add `.jpg` + manifest entry later in a follow-up PR.
