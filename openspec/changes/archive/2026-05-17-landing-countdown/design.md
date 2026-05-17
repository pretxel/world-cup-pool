## Context

Existing pieces in play:

- `components/kickoff-countdown.tsx` — client component. Two variants: `inline` and `stacked`. Stacked renders 4 tiles (`days/hrs/min/sec`) but its labels are hardcoded English. When the countdown hits zero, only the inline variant returns a "Locked at kickoff" pill; stacked just keeps rendering "00" tiles.
- `app/[locale]/page.tsx` — server component, locale-aware, already wired with `getTranslations("home")`. The hero + scoring + cadence layout has clear seams to drop a new band in.
- `public.matches.kickoff_at` — already used by the leaderboard, sitemap, etc. Min row is the tournament's opening match.

The home page is server-rendered. We don't want every visitor to also boot a websocket or anything — the countdown is a pure clock-relative-to-fixed-target render. So: read the target ISO on the server, hand it down to a tiny client component that ticks `setInterval(1s)`.

## Goals / Non-Goals

**Goals:**
- One countdown for the *first match*, not a per-day calendar.
- Visible at every landing-page render; updates every second on the client without any data refetch.
- Locale-aware labels.
- Graceful state after kickoff (tournament started) — no "00:00:00" forever.
- Reuse `KickoffCountdown`'s stacked variant rather than building a parallel timer.

**Non-Goals:**
- No countdown to the local user's *next* match. (That's a different surface — `/my-picks` could host that later.)
- No backend job emitting "countdown live" events. Plain client clock.
- No locale-specific day/hour wording beyond what ICU plurals already give us.
- No tournament end-date logic ("Tournament ends in X days"); only the kickoff target.

## Decisions

**1. Data source.**

Read `min(kickoff_at)` from `public.matches` on the home page server render. Memoize it via Next's RSC cache (just call `supabase.from("matches").select("kickoff_at").order("kickoff_at",{ascending:true}).limit(1).maybeSingle()` — same query the sitemap already does).

If the query fails or returns null (e.g. matches table empty in a dev environment), fall back to the constant `"2026-06-11T19:00:00Z"`. Keep that constant in a single place: `lib/tournament.ts` exporting `TOURNAMENT_START_ISO`.

Rationale: the DB is the truth (handles schedule shifts), the constant is the safety net (handles cold dev environments / first deploys).

**2. Server/client split.**

`TournamentCountdown` is a server component owning:
- The DB query / fallback.
- The localized labels lookup (via `getTranslations("home")`).
- The layout (eyebrow, tiles wrapper, subhead).

Inside, it renders the existing `<KickoffCountdown variant="stacked" kickoffAt={...} />` client component, passing the translated tile labels as props.

This keeps the bulk of the markup server-rendered (good for SEO and initial paint) and only the 4 numbers and the locked-state branch live in client code.

**3. Extend `KickoffCountdown` minimally, don't fork.**

Current stacked variant hardcodes `{ value: days, label: "days" }`, etc. Change the prop API to accept an optional `labels` object:

```ts
labels?: { days: string; hours: string; mins: string; secs: string };
```

When omitted, fall back to the current English defaults so the existing callers (match detail's "Locked at kickoff" inline use) don't change behavior. The match-detail caller is `inline`, so it doesn't read these labels anyway.

Also: extend the locked branch so the *stacked* variant returns a small pill when remaining ≤ 0 (today it just keeps rendering 0s). Add a `lockedNode?: React.ReactNode` prop so the parent can supply the localized "Tournament live" pill. If omitted, keep current English "Tournament started" default.

**4. Placement on the landing page.**

Insert between hero and scoring section. Layout:

```
[hero with bracket + headline]
─────────────────────────────
[eyebrow: "Kickoff in"]
[ 12 ][ 04 ][ 32 ][ 07 ]
[ DAYS ][ HRS ][ MIN ][ SEC ]
[subhead: "Mexico vs South Africa · Thu 11 Jun 2026 · Estadio Azteca"]
─────────────────────────────
[scoring section]
```

Same gutter / max-width as the other sections; subtle pitch-stripe accent across the band so it visually rhymes with the hero.

**5. Post-kickoff fallback.**

When `min(kickoff_at) <= now()`, render a compact pill: `Tournament live` / `El torneo está en vivo` / `Le tournoi est lancé`. Use the existing live-pulse CSS class so it has a small red dot to match other "live" affordances in the app.

Subhead changes from "fixture name · date" to a generic "Picks open across the bracket" line — same translated copy across the three locales.

**6. Locale labels via translation keys.**

New keys under `home`:

```
"countdownEyebrow": "Kickoff in"
"countdownDays": "Days"
"countdownHrs": "Hrs"
"countdownMin": "Min"
"countdownSec": "Sec"
"countdownLive": "Tournament live"
"countdownLiveSubhead": "Picks open across the bracket"
"countdownSubhead": "{home} vs {away} · {date}"
```

Three-locale parity test passes automatically (the message-bundle parity test iterates `SUPPORTED_LOCALES`).

## Risks / Trade-offs

- **Risk**: clock skew between server (which renders the initial value) and client (which then ticks). For a long countdown (~3 weeks out as of writing) a few seconds of jitter on first paint is invisible. → **Mitigation**: client useEffect recomputes from `Date.now()` on mount, so the visible numbers are always client-authoritative after hydration. Server's initial value is a stable "good enough" placeholder for SSR.
- **Risk**: DB read on every home page render. → **Mitigation**: read is `select min(kickoff_at) from matches` on an indexed column — single-row scan, cached by Next's per-render cache. Negligible.
- **Risk**: setInterval running on every home-page client unnecessarily after kickoff. → **Mitigation**: once `remaining <= 0`, the component returns the static pill and doesn't schedule the interval.
- **Risk**: tournament fixture list changes (first match moves). → **Mitigation**: DB-driven; admin updates fixture, countdown follows. The constant is only a fallback.

## Migration Plan

1. Add `lib/tournament.ts` exporting `TOURNAMENT_START_ISO`.
2. Extend `KickoffCountdown` API (labels + stacked locked branch).
3. Build `components/tournament-countdown.tsx` (server wrapper).
4. Add the six translation keys to `messages/{en,es,fr}.json`.
5. Insert `<TournamentCountdown />` into `app/[locale]/page.tsx` between the hero and `ScoringSection`.
6. Typecheck + lint + tests + manual visual verify.

Rollback: revert the PR. No DB, runtime, or external-resource state.

## Open Questions

None.
