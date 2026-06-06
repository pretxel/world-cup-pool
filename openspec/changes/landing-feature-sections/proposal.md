## Why

The product has three engagement features beyond core predictions — friend **Groups** (private mini boards), the **News** feed, and the **Daily Call quiz** — but the marketing landing page (`/`) only explains scoring and the pick→lock→score→climb cadence. A first-time visitor never learns these features exist, so the homepage undersells the app and leaves sign-up/engagement motivation on the table.

## What Changes

- Add a **features section** to the landing page that explains Groups, News, and Quiz — each with a heading, one-line description, an icon, and a link to its route (`/groups`, `/news`, `/quiz`).
- Add the supporting `home.*` copy keys in all three locales (`en`, `es`, `fr`).
- Purely additive to the marketing surface: no new routes, no backend, no data model changes. The existing Hero, Scoring, Cadence, and countdown sections are unchanged.

Out of scope: changing the features themselves, adding screenshots/live data to the cards, or reworking the existing hero/scoring/cadence copy.

## Capabilities

### New Capabilities
- `landing-page`: what the marketing landing page (`/`) explains to visitors — specifically the feature-explanation sections that describe Groups, News, and Quiz and link to them, localized across supported locales.

### Modified Capabilities
<!-- None. This introduces landing-page content that no existing spec governs. The leaderboard spec's "homepage feature card" copy is untouched. -->

## Impact

- **UI**: `app/[locale]/page.tsx` — add one new section component (three feature cards) to the page composition; reuse existing section/card styling and the `home` translation namespace. Icons from `lucide-react`.
- **i18n**: new `home.*` keys for the three features in `messages/en.json`, `es.json`, `fr.json` (must stay key-parity, enforced by `tests/i18n.test.ts`).
- **No change**: routes, server code, database, or the existing landing sections.
