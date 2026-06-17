## Context

The landing page (`app/[locale]/page.tsx`) is an async server component with no data
fetching; it composes section functions (Hero, TournamentCountdown, ScoringSection,
FlagWallDivider, Cadence, FeatureSections) and uses the `home` i18n namespace.
`TournamentCountdown` is the precedent for a **self-fetching async section component**:
it loads its own data server-side and renders (or not). i18n labels are read via
`getTranslations("home")`.

The render feature stores comics in the public `match-recap-images` bucket and tracks
them in `match_summary_images`, whose public SELECT RLS restricts rows to the **active**
recap version. The public object URL is
`${NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/match-recap-images/<path>` (the
`recapImagePublicUrl` helper on the public match page).

## Goals / Non-Goals

**Goals:**
- A landing gallery of the most recent active completed recap comics, newest first,
  each linking to its match, hidden when none.
- Reuse existing data/bucket/RLS; no new schema, route, or dependency.

**Non-Goals:**
- Pagination / infinite scroll / a dedicated gallery page (just the latest N).
- Showing draft or in-progress renders (RLS already excludes them).
- Client-side polling/refresh (static server render is fine; the cron pace is slow).

## Decisions

### Self-fetching async server section (mirror TournamentCountdown)
Add `components/recent-recap-images.tsx` exporting an async `RecentRecapImages({ locale })`
server component, mounted in `page.tsx` after `FeatureSections`. It fetches its own data
and `getTranslations("home")`, matching the `TournamentCountdown` pattern, so `page.tsx`
stays a thin composition. Returns `null` when there are no images (no heading, no empty
state).

### One embedded query, anon client, RLS does the scoping
Use `createServerSupabaseClient()` (anon) and a single query embedding the match:
`from("match_summary_images").select("storage_path, match_id, created_at, matches(home_team, away_team)").eq("status","complete").order("created_at", { ascending: false }).limit(8)`.
The active-only RLS guarantees at most the active version's render per match, so the list
is naturally one-per-match and contains only published comics. Order by `created_at`
desc = "last generated". Cap at 8 (one row of 4 on desktop, scal es down responsively).

### Layout
A `max-w-6xl` section matching the other landing sections (eyebrow + heading via the
`home` namespace), then a responsive grid (`grid-cols-2 sm:grid-cols-3 lg:grid-cols-4`)
of `<Link href={localePath(locale, "/matches/<id>")}>` cards, each a plain `<img>`
(eslint-disabled, as elsewhere — avoids next/image remote config) of the comic with
team-named alt and a small caption (`Home vs Away`). Portrait 2:3 thumbnails.

### URL + types
Reuse the `recapImagePublicUrl` pattern (`NEXT_PUBLIC_SUPABASE_URL` origin for the
browser). The embedded `matches(home_team, away_team)` is typed via the FK
(`match_summary_images.match_id → matches.id`); guard for a possibly-null embed.

## Risks / Trade-offs

- **Embedded join shape** (PostgREST returns `matches` as object or array depending on
  inference) → narrow defensively; skip any row whose teams can't be resolved.
- **Bucket object missing for a `complete` row (rare)** → the `<img>` simply fails to
  load; no crash. Bounded, low-stakes.
- **Cold start with no comics** → section returns null; zero visual/SEO impact.

## Migration Plan

1. Add `components/recent-recap-images.tsx`; mount it in `app/[locale]/page.tsx`.
2. Add the `home` gallery strings in en/es/fr/de.
3. No DB/deploy migration; ship with the normal build. Rollback = unmount + delete the
   component.

## Open Questions

- Final cap (6 vs 8) and placement (after FeatureSections vs higher) — start at 8, after
  FeatureSections; trivial to tune.
