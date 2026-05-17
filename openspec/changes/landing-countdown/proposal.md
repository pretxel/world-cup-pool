## Why

The landing page currently leads with the headline, the demo bracket card, and the scoring/cadence sections — nothing that anchors visitors in time. A WC pool is fundamentally time-bound: the closer the opening match, the more urgency the product carries. A live countdown to the first kickoff turns "I'll come back later" into "I should pick now," and gives the page a moving element that signals the product is actively maintained.

First match is fixed in the schedule (Mexico vs South Africa, 2026-06-11 19:00 UTC, Estadio Azteca) so the target is concrete.

## What Changes

- New `TournamentCountdown` server component on the landing page that reads the earliest `kickoff_at` from `public.matches` and passes it to a small client component for the live tick.
- Reuse the existing `<KickoffCountdown variant="stacked" />` for the tile layout (days / hrs / min / sec). Extend it minimally so its tile labels accept translated strings instead of the hardcoded English ones, and so the locked-state branch is reachable from the stacked variant (today it only fires from the inline variant).
- Place the countdown as a band between the hero section and the scoring section on `app/[locale]/page.tsx`. Layout: a small uppercase eyebrow ("Kickoff in" / "Faltan" / "Coup d'envoi dans"), the four large tiles, and a one-line subhead naming the opening fixture + kickoff date/time in the visitor's locale.
- After kickoff, the band collapses to a compact "Tournament live" / "El torneo está en vivo" / "Le tournoi est lancé" pill so the section doesn't go blank.
- Locale-aware labels (Days/Hours/Min/Sec) via new `home.countdown*` translation keys in `messages/{en,es,fr}.json`. ICU plurals for the day count.

## Capabilities

### Modified Capabilities
- `match-presentation`: this is a new presentation surface on the landing page. Add a single requirement covering the tournament countdown's data source, locale labels, and post-kickoff fallback.

## Impact

- Code: `components/tournament-countdown.tsx` (new, server + client split), `components/kickoff-countdown.tsx` (extend tile labels + add locked branch to stacked variant), `app/[locale]/page.tsx` (insert the band).
- Messages: ~6 new keys per locale under `home.countdown*` — `eyebrow`, `days`, `hrs`, `min`, `sec`, `live`. ICU plural on day count.
- Tests: extend `tests/i18n.test.ts` parity check (auto-covered as the new keys arrive in all three locales together).
- No DB schema changes. No new runtime deps. Single new query: `select min(kickoff_at) from public.matches` cached on the same render as the rest of the home page.
