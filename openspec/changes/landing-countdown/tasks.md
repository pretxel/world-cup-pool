## 1. Foundation

- [x] 1.1 Create `lib/tournament.ts` exporting `TOURNAMENT_START_ISO = "2026-06-11T19:00:00Z"` and a `TOURNAMENT_OPENING = { home: "Mexico", away: "South Africa", venue: "Estadio Azteca" }` constant for the subhead fallback.

## 2. Extend KickoffCountdown

- [x] 2.1 Add an optional `labels?: { days: string; hours: string; mins: string; secs: string }` prop. When omitted, fall back to the current English defaults.
- [x] 2.2 Stacked variant: when `remaining <= 0`, render `lockedNode` (new optional `React.ReactNode` prop) if provided, else the same "Locked at kickoff" pill the inline variant uses. Do NOT keep ticking after kickoff (mount-time check is enough since target ISO doesn't change).
- [x] 2.3 Confirm the existing match-detail caller (`<KickoffCountdown variant="inline" …>`) still renders unchanged.

## 3. Translation keys

- [x] 3.1 Add `home.countdownEyebrow`, `countdownDays`, `countdownHrs`, `countdownMin`, `countdownSec`, `countdownLive`, `countdownLiveSubhead`, `countdownSubhead` keys to `messages/en.json`. `countdownSubhead` is an ICU template like `"{home} vs {away} · {date}"`.
- [x] 3.2 Mirror the same keys with Spanish translations in `messages/es.json`.
- [x] 3.3 Mirror the same keys with French translations in `messages/fr.json`.

## 4. TournamentCountdown server component

- [x] 4.1 Create `components/tournament-countdown.tsx` (server). Fetches earliest match from Supabase, falls back to `TOURNAMENT_START_ISO`. Detects placeholder vs real fixture via `flagSlug`. Renders eyebrow + stacked countdown + localized subhead, or the live pill if past kickoff.
- [x] 4.2 Style: `max-w-6xl` gutter, `border-y` divider, subtle pitch-stripe + grain overlays so the band rhymes with the hero.

## 5. Wire into the landing page

- [x] 5.1 In `app/[locale]/page.tsx`, import and render `<TournamentCountdown />` between the `<Hero />` and `<ScoringSection />` sections.

## 6. Tests

- [x] 6.1 `pnpm test` — message-bundle key-parity test now exercises the new countdown keys; 37/37 still pass.

## 7. Verification

- [x] 7.1 `pnpm typecheck` — zero errors.
- [x] 7.2 `pnpm lint` — zero errors. (Required one `react-hooks/purity` disable for the intentional request-time `Date.now()` check in the server component; the effect-side setState removed in favor of a plain early-return.)
- [x] 7.3 `openspec validate landing-countdown` — valid.
- [x] 7.4 Manual: `pnpm dev`, hit `/en`, `/es`, `/fr` — confirmed countdown renders with the right localized labels ("Kickoff in" / "Faltan" / "Coup d'envoi dans") and "Days" / "Días" / "Jours".
- [ ] 7.5 Manual: temporarily set system clock past 2026-06-11 (or override the constant) and confirm the band collapses to the live pill in all three locales.
