# Tasks: add-pool-winners-email

## 1. Database

- [x] 1.1 Create migration `supabase/migrations/<ts>_winners_email_log.sql`: `winners_email_log` table (user_id uuid PK → profiles, sent_at timestamptz default now(), RLS enabled, no policies) + drop/recreate `operation_runs_kind_check` including `winners_email` — mirror `20260627000000_score_rules_email_log.sql`
- [x] 1.2 Regenerate/extend `lib/database.types.ts` with `winners_email_log` (local stack or hand-add following existing log-table shapes)

## 2. Email template and dispatch

- [x] 2.1 Create `lib/notifications/winners-email-template.ts`: `WinnersEmailStrings`, `WinnersEmailData` (recipient rank/points, podium rows with `isYou` marking, leaderboardUrl), pure `renderWinnersEmail` returning subject/html/text in the existing templates' visual language
- [x] 2.2 Create `lib/notifications/winners-emails.ts`: `buildWinnersEmailStrings(t, { displayName, rank, totalPoints })` (namespace `winnersEmail`, ICU select for rank phrasing) and `dispatchWinnersEmail(fromName?)` — query `v_leaderboard_overall` rank ≤ 3, filter `results_digest` pref + `isSendableEmail`, skip ledgered users, send via Resend, stamp `winners_email_log` after acceptance, return `{ winners, emailed, skipped }`
- [x] 2.3 Unit tests: pure renderer (subject/html/text, podium marking) and dispatch recipient selection/idempotency following `tests/*-emails.test.ts` mocking patterns

## 3. Operations wiring

- [x] 3.1 Add `winners_email` to `OperationKind` + `OPERATION_KINDS` in `lib/operations/record-run.ts`; add **no** `OPERATION_SCHEDULES` entry
- [x] 3.2 Add `winners_email` to the `JOB` map and export `runWinnersEmail` in `app/[locale]/(admin)/admin/operations/actions.ts`; wire it into `RUN_ACTION` in `overview.tsx`
- [x] 3.3 Add `admin.operations.jobs.winners_email` + `jobsDesc.winners_email` keys (description warns: send once, after the final match is scored) in all four locale files

## 4. Preview integration

- [x] 4.1 Add `winnersFixture` to `lib/notifications/preview-fixtures.ts` (podium of three incl. one long name, recipient rank 2) and a `winners` entry to `EMAIL_PREVIEW_IDS` + `renderEmailPreview` in `lib/notifications/email-previews.ts`
- [x] 4.2 Add `admin.operations.emails.previews.templates.winners` label in all four locale files; confirm `tests/email-previews.test.ts` picks up the new id automatically (matrix derives from `EMAIL_PREVIEW_IDS`)

## 5. i18n content

- [x] 5.1 Write the `winnersEmail` namespace (subject, preheader, eyebrow, heading with rank select, intro, podium labels, youLabel, ptsSuffix, ctaLabel, footer, `madeWithLove` credit "Made with love :) — pretxel", `comingSoon` teaser for "La Liga Pool") in `messages/en.json`, then es/fr/de — keep "pretxel" and "La Liga Pool" verbatim across locales

## 6. Verification

- [x] 6.1 Typecheck, lint, prettier, full test suite; confirm preview matrix now 12×4
- [x] 6.2 Verify the overview tile renders "Manual only" with a Run now button and that cron never enumerates `winners_email`; note in PR that the remote migration must be applied manually (pooler psql + record + NOTIFY pgrst) before the first run
