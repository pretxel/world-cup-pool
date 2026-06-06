## 1. Copy & i18n

- [x] 1.1 Add `home.*` feature-section keys to `messages/en.json`: `featuresEyebrow`, `featuresHeadline`, and per feature `groupsTitle`/`groupsCopy`/`groupsCta`, `newsTitle`/`newsCopy`/`newsCta`, `quizTitle`/`quizCopy`/`quizCta`
- [x] 1.2 Mirror the same keys (translated) in `messages/es.json` and `messages/fr.json`

## 2. Landing section component

- [x] 2.1 Add a `FeatureSections` component in `app/[locale]/page.tsx` following the existing `ScoringSection`/`Cadence` idiom (eyebrow + heading + 3-up card grid), typed with the same `T` translator
- [x] 2.2 Render three cards (Groups / News / Quiz) with a `lucide-react` icon each (`UsersIcon`, `NewspaperIcon`, `BrainIcon`/`HelpCircleIcon`), title, description, and a locale-aware `localePath` link to `/groups`, `/news`, `/quiz`
- [x] 2.3 Insert `<FeatureSections locale={locale} t={t} />` into the page composition (after `Cadence`)

## 3. Verify

- [x] 3.1 Run `pnpm test` (confirms `tests/i18n.test.ts` key parity across en/es/fr)
- [x] 3.2 Run `pnpm lint`, `pnpm typecheck`, and `pnpm build`
- [x] 3.3 Manually confirm the landing page shows the three cards and each links to the right locale-prefixed route
