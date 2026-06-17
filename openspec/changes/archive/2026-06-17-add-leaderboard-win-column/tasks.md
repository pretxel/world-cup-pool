## 1. i18n keys

- [x] 1.1 Add `headerWins` to the `leaderboard` namespace in `messages/en.json`, `es.json`, `fr.json`, `de.json` (e.g. en "Wins", es "Ganados", fr "Gagnés", de "Siege")
- [x] 1.2 Add `boardWins` to the `groups` namespace in all four locale files, matching the existing `boardExact`/`boardWinnerGd` naming

## 2. Shared table component

- [x] 2.1 In `components/leaderboard-table.tsx`, add `winner_hits: number | null` to the `BoardRow` type
- [x] 2.2 Add `wins: string` to the `LeaderboardLabels` type
- [x] 2.3 Render a "Wins" header cell after the W+GD header using `labels.wins`, with `hidden sm:table-cell` to match the other hit columns
- [x] 2.4 Render a body cell after the W+GD cell showing `row.winner_hits ?? 0`, text-right, with `hidden sm:table-cell`

## 3. Wire up call sites

- [x] 3.1 In `app/[locale]/(public)/leaderboard/page.tsx`, pass `wins: t("headerWins")` in the `labels` object; confirm rows carry `winner_hits`
- [x] 3.2 In `app/[locale]/(app)/groups/[id]/page.tsx`, pass `wins: t("boardWins")` in the group board `labels` object; confirm rows carry `winner_hits`

## 4. Verify

- [x] 4.1 Run `pnpm lint` / `pnpm typecheck` (or project equivalent) and resolve any type errors from the widened `BoardRow`
- [x] 4.2 Visually verify on `/leaderboard`: Wins column shows winner-only counts, hidden below the small breakpoint, visible above it
- [x] 4.3 Visually verify the group mini-board renders the Wins column with correct values
- [x] 4.4 Switch locale (en/es/fr/de) and confirm the Wins header is translated
