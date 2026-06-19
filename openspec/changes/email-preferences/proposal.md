## Why

The app sends three transactional/engagement emails — the prediction reminder, the result email, and the quiz reminder — but a signed-in player has no in-app way to choose which ones they get. The only opt-out is the one-click `List-Unsubscribe` link in each email's footer, which flips a single per-type boolean on `profiles` (`prediction_reminder_opt_out` / `quiz_reminder_opt_out`) and is a permanent, silent dead-end with no re-opt-in path. Worse, the result email (`lib/notifications/result-emails.ts`) honors *no* opt-out column at all, so a player can never stop result emails. This is engagement quick win **QW7**: surfacing per-type toggles in the account menu reduces the regret of a total unsubscribe and keeps players in the ecosystem instead of marking mail as spam.

## What Changes

- Add a single jsonb `profiles.email_prefs` column as the in-app source of truth for the three email types (`prediction_reminder`, `result`, `quiz_reminder`), each defaulting to opted-in (`true`). The migration backfills it from the two existing opt-out booleans so no one's current choice is lost.
- Add **per-type email toggles** to the existing account surface (`components/user-menu.tsx`): a switch per email type that the player can flip without leaving the page, with inline success/error feedback.
- Add an `updateEmailPrefs` server action (`app/[locale]/profile-actions.ts`) that validates and persists the toggles for the current user and revalidates.
- Make all three dispatch paths honor `email_prefs`: `prediction-reminder-emails.ts` and `quiz-reminder-emails.ts` filter recipients by their jsonb key (replacing the boolean `.eq(...)` filters), and `result-emails.ts` — which has no opt-out today — gains a recipient filter so opted-out players stop receiving result emails.
- Keep the existing footer one-click unsubscribe working by having it write the same `email_prefs` key it toggles in-app (so footer and in-app stay consistent and re-opt-in is possible from the menu).
- Add an `emailPrefs` i18n namespace (en/es/fr/de) for the toggle labels and feedback.

## Capabilities

### New Capabilities
- `email-preferences`: In-app per-type email preferences — a player can independently turn the prediction-reminder, result, and quiz-reminder emails on or off from the account menu, backed by `profiles.email_prefs`, and every email dispatch path honors those choices.

### Modified Capabilities
<!-- None at the spec level. The three notification dispatch paths change which recipients they select, but no existing capability spec documents email-type opt-out, so no prior requirement is altered. -->

## Impact

- **Schema**: one small additive migration under `supabase/migrations/` adding jsonb `profiles.email_prefs` (default all-on) and backfilling from `prediction_reminder_opt_out` / `quiz_reminder_opt_out`. The legacy boolean columns are kept for the existing footer unsubscribe routes; the new column is the read source.
- **New server action**: `updateEmailPrefs` in `app/[locale]/profile-actions.ts` (a sibling of `updateDisplayName`, same non-redirecting result shape).
- **Component**: `components/user-menu.tsx` gains a preferences section (toggles) fed by the player's current `email_prefs`; `components/site-nav.tsx` selects `email_prefs` alongside `display_name` and passes it in.
- **Dispatch**: `lib/notifications/prediction-reminder-emails.ts`, `lib/notifications/quiz-reminder-emails.ts`, and `lib/notifications/result-emails.ts` read/filter on `email_prefs`.
- **Unsubscribe routes**: the footer one-click handlers also set the matching `email_prefs` key so in-app and footer stay in sync.
- **i18n**: new `emailPrefs` namespace in `messages/{en,es,fr,de}.json`.
- No new dependencies (base-ui already present; `sonner` toaster already mounted).
