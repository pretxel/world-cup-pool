## Context

The landing page `app/[locale]/page.tsx` is a server component that composes section sub-components (`Hero`, `TournamentCountdown`, `ScoringSection`, `FlagWallDivider`, `Cadence`), all driven by the `home` translation namespace via `getTranslations("home")` and locale-aware `localePath()` links. Sections follow a consistent pattern: an eyebrow (mono uppercase), a heading (`font-heading`), and a card/grid body. This change adds one more section in that same idiom to surface Groups, News, and Quiz.

## Goals / Non-Goals

**Goals:**
- Tell visitors that Groups, News, and Quiz exist, in one scannable section, with a link into each.
- Match the existing landing-page visual language and i18n pattern exactly.
- Keep it static and additive — no data fetching, no new routes.

**Non-Goals:**
- Live/dynamic content in the cards (no real news headlines or today's question).
- Redesigning hero/scoring/cadence.
- Gating the section by auth (it renders for everyone, signed in or not).

## Decisions

### Decision: One new `FeatureSections` component, three cards in a grid
Add a single section component (e.g. `FeatureSections`) rendering a 3-up card grid (Groups / News / Quiz), placed after `Cadence` in the page composition. Each card: icon, title, one-line description, and a "learn more"-style link to the route.
- **Why:** Mirrors the existing `ScoringSection`/`Cadence` structure (eyebrow + heading + grid of cards), so it reads as native. One component keeps the page composition tidy.
- **Alternative rejected:** Three separate full-width sections — heavier, pushes the fold down, and over-emphasizes secondary features.

### Decision: Cards link to the live routes; Groups link is allowed to hit the auth gate
Links go to `localePath(locale, "/groups" | "/news" | "/quiz")`. `/news` and `/quiz` are public. `/groups` is under the authenticated `(app)` layout, so a signed-out visitor clicking it is redirected to `/sign-in`.
- **Why:** That redirect is the desired funnel — a visitor interested in Groups is exactly who we want to prompt to sign in. No special-casing needed.
- **Alternative rejected:** Hiding the Groups card for signed-out users — the landing page is primarily for signed-out visitors, so hiding it defeats the purpose.

### Decision: Copy lives in the `home` namespace, keyed per feature
Add keys under `home.*` (e.g. `featuresEyebrow`, `featuresHeadline`, then per-feature `groupsTitle`/`groupsCopy`/`groupsCta`, `newsTitle`/`newsCopy`/`newsCta`, `quizTitle`/`quizCopy`/`quizCta`). Mirror across `en`/`es`/`fr`.
- **Why:** Consistent with how every other landing section sources copy; `tests/i18n.test.ts` enforces key parity so a missing locale fails CI.
- **Alternative rejected:** A new top-level namespace — unnecessary; this is landing-page copy that belongs with `home`.

### Decision: Icons from `lucide-react`
Groups → `UsersIcon`, News → `NewspaperIcon`, Quiz → `BrainIcon` (or `HelpCircleIcon`). Same import + sizing convention as the existing sections.

## Risks / Trade-offs

- **Groups card 404/empty for signed-out users** → It doesn't 404; the `(app)` layout redirects to `/sign-in`. Acceptable and on-purpose (sign-in funnel).
- **i18n key drift across locales** → `tests/i18n.test.ts` fails if `en`/`es`/`fr` key sets differ, so a forgotten translation is caught before merge.
- **Section placement / page length** → Placing it after `Cadence` keeps the scoring story above it intact; if it feels buried, it can move directly under `ScoringSection` later (pure reorder, no behavior change).

## Open Questions

- Final icon for Quiz (`BrainIcon` vs `HelpCircleIcon`) — cosmetic, decide during implementation.
- Whether to add a small anchor/`id` for the features section (e.g. for a future hero link) — optional, omit unless needed.
