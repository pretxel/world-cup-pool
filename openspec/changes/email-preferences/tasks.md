## 1. Migration

- [ ] 1.1 Add a migration under `supabase/migrations/` adding `email_prefs jsonb not null default '{"prediction_reminder":true,"result":true,"quiz_reminder":true}'` to `public.profiles` (additive, mirroring the comment style of `20260614030000_prediction_reminder_email.sql`).
- [ ] 1.2 In the same migration, backfill `email_prefs` from existing columns: `prediction_reminder = not prediction_reminder_opt_out`, `quiz_reminder = not quiz_reminder_opt_out`, `result = true`. Keep the legacy boolean columns in place (the footer routes still write them).

## 2. Server action

- [ ] 2.1 Add `updateEmailPrefs(prefs)` to `app/[locale]/profile-actions.ts` (`"use server"`): validate the three known boolean keys with a small zod schema, merge into and update `profiles.email_prefs` for the current user, `revalidatePath("/", "layout")`, return `{ ok: true; prefs }` or `{ ok: false; error }` (no redirect). Model the result shape on `updateDisplayName`.

## 3. Account menu toggles

- [ ] 3.1 In `components/user-menu.tsx`, add a preferences section below the name editor: one labeled switch per email type (`prediction_reminder`, `result`, `quiz_reminder`) initialized from an `emailPrefs` prop.
- [ ] 3.2 On toggle, call `updateEmailPrefs` in a transition with optimistic local state; toast success/error via `sonner` and revert the switch on failure.
- [ ] 3.3 In `components/site-nav.tsx`, add `email_prefs` to the existing `profiles` select and pass it to `<UserMenu emailPrefs ... />`.

## 4. Dispatch honors preferences

- [ ] 4.1 In `lib/notifications/prediction-reminder-emails.ts`, change `loadOptedInProfiles` to select `email_prefs` and keep recipients where `email_prefs->>'prediction_reminder'` is not `'false'` (replacing `.eq("prediction_reminder_opt_out", false)`; treat absent as opted-in).
- [ ] 4.2 In `lib/notifications/quiz-reminder-emails.ts`, apply the same change for the `quiz_reminder` key (replacing `.eq("quiz_reminder_opt_out", false)`).
- [ ] 4.3 In `lib/notifications/result-emails.ts`, add a `profiles.email_prefs` read for the pending `userIds` and drop anyone whose `result` preference is `false` before `dispatchPending` (this path has no opt-out today).

## 5. Footer unsubscribe consistency

- [ ] 5.1 Update the existing one-click unsubscribe routes (`/api/prediction-reminders/unsubscribe`, `/api/quiz-reminders/unsubscribe`) to also set the matching `email_prefs` key to `false`, so footer opt-outs appear in the menu and can be reversed.

## 6. i18n

- [ ] 6.1 Add an `emailPrefs` namespace to `messages/en.json` (section heading + one label per email type + saved/error messages) and translate in `messages/{es,fr,de}.json`.

## 7. Verification

- [ ] 7.1 Run `pnpm typecheck`, `pnpm lint`, `pnpm test`; fix failures (cover the new opt-in/opt-out filtering with unit tests on the pure recipient-filtering logic).
- [ ] 7.2 Manually verify: a signed-in player sees the three toggles in the account menu reflecting their stored prefs; turning one off saves without reload and stops only that email type on the next dispatch; result emails now respect the toggle; a footer unsubscribe shows as off in the menu and can be turned back on; all four locales render.
