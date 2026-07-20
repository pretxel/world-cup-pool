# Design: add-pool-winners-email

## Context

`score_rules_email` is the exact precedent: an admin-triggered, one-off broadcast with a send-once ledger, surfaced as a manual-only tile on the Operations overview. The plumbing this change slots into:

- `lib/operations/record-run.ts` — `OperationKind` union + `OPERATION_KINDS`; every kind gets a tile automatically.
- `lib/operations/schedule.ts` — `OPERATION_SCHEDULES`; a kind with no entry renders "Manual only" and never fires from cron.
- `app/[locale]/(admin)/admin/operations/actions.ts` — `JOB` map runs the dispatcher under `recordRun(kind, "manual", …)` after `assertAdmin()`; `overview.tsx`'s `RUN_ACTION` map wires the button.
- `supabase/migrations/20260627000000_score_rules_email_log.sql` — ledger-table shape (user_id PK → profiles, RLS enabled, no policies) and the `operation_runs_kind_check` extension pattern.
- Email module pattern: pure `render*(data)` template file + sender module with `build*Strings(t)` and a `dispatch*(fromName?)` returning a `DispatchSummary`-shaped object.
- `lib/notifications/email-previews.ts` / `preview-fixtures.ts` — preview registry; one entry + one fixture adds the template to the admin previews.
- Winners source: `v_leaderboard_overall` (`user_id`, `display_name`, `rank`, `total_points`, `exact_hits`, …).

## Goals / Non-Goals

**Goals**

- Podium players (final rank ≤ 3, ties included) each get one congratulation email, ever.
- Admin fires it manually from the overview once final standings are settled; re-runs are safe.
- Localized copy, email-pref respecting, previewable in the admin like every other template.

**Non-Goals**

- Automatic detection of "competition finished" (admin judgment stays the trigger).
- Group-level winners (overall leaderboard only; per-group podiums could be a follow-up).
- Prizes/rewards content — copy congratulates and shows standings, nothing more.
- Push notification variant.

## Decisions

### 1. Recipients: rank ≤ 3 on `v_leaderboard_overall`, ties included

Query rows with `rank <= 3` (the view already handles ranking). Ties share the podium and all get the email. A recipient must also have a deliverable address (`isSendableEmail`, resolved via the admin client like the other senders) and pass the pref gate.

*Alternative — winner only (rank 1)*: rejected; podium recognition is the norm in pools and costs nothing extra.

### 2. Pref gate: reuse the `results_digest` preference

`EMAIL_PREF_KEYS` has no announcement key, and `score_rules_email` already gates its broadcast on `results_digest`. Follow that precedent rather than adding a new pref key for a ~3-recipient one-shot.

*Alternative — new `winners` pref key*: rejected; a settings toggle for an email you receive at most once ever is UI noise, and adding a key touches prefs schema, account menu, and unsubscribe surfaces.

### 3. Idempotency: `winners_email_log` ledger, row written after Resend accepts

Same contract as `score_rules_email_log`: a winner is pending while opted-in with no ledger row; the row is stamped only after the provider accepts, so crashes and partial failures leave the remainder pending for the next manual run. At-most-once per player, safe re-runs. Migration also extends `operation_runs_kind_check` with `winners_email` (drop + recreate, listing all ten kinds).

*Alternative — one-shot guard on `operation_runs` (job-level)*: rejected; a partial batch failure would strand the unsent winners with no retry path.

### 4. Manual-only operation kind `winners_email`

Add to `OperationKind`/`OPERATION_KINDS`; add **no** `OPERATION_SCHEDULES` entry (tile shows "Manual only", cron never fires it); add dispatcher to the `JOB` map and a `runWinnersEmail` action to `RUN_ACTION`. `recordRun` gives run history, status, and the redirect-back summary for free.

### 5. Email content and module shape

`winners-email-template.ts` (pure, dependency-free, table-layout HTML matching the existing templates' visual language) renders: eyebrow/heading with the recipient's final rank ("You finished #2"), a podium table (rank, name, points — recipient's row highlighted via a `youLabel` marker like the result email), and a leaderboard CTA. `winners-emails.ts` exports `buildWinnersEmailStrings(t, { displayName, rank, totalPoints })` (namespace `winnersEmail`, strings resolved at `DEFAULT_LOCALE` per sender convention) and `dispatchWinnersEmail(fromName?)` returning `{ winners, emailed, skipped }` so the overview's generic summary renderer shows meaningful counts.

Rank display uses the medal framing per rank (1st/2nd/3rd variants selected via ICU `select` in the messages), so copy stays fully in the message files.

The footer carries two extra lines, both localized message keys: a maker credit ("Made with love :) — pretxel") and a teaser for the next pool ("Coming soon: La Liga Pool"). Product name "La Liga Pool" and the signature "pretxel" stay verbatim across locales; the surrounding phrasing translates.

### 6. Preview integration

One `winnersFixture` (podium of three incl. one long name, recipient rank 2) + one registry entry (namespace `winnersEmail`). The preview spec's "eleven types" requirement is updated to twelve via a MODIFIED delta; the existing preview test derives its matrix from `EMAIL_PREVIEW_IDS`, so it covers the new template with no test changes.

## Risks / Trade-offs

- [Admin fires the email before the final match is scored] → Copy states final standings; the ledger makes a re-send impossible, so a premature run is unrecoverable per recipient. Mitigate with explicit tile description copy ("send once, after the final is scored") — accepted residual risk, same as `score_rules_email`.
- [`v_leaderboard_overall` rank ties at the podium boundary inflate recipients] → Acceptable and intended; ties included by design.
- [Remote migration must be applied by hand] → Known project constraint (deploys don't run migrations; `db push` unsafe): apply via pooler psql, record in migration history, `NOTIFY pgrst` — called out in tasks.
- [Pref reuse means a player who disabled digests misses their congratulation] → Accepted; consistent with the score-rules precedent and respects the player's stated choice.

## Open Questions

- None blocking. Group-level winner emails deliberately deferred.
