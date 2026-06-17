## 1. Combined server action

- [x] 1.1 In `app/[locale]/(admin)/admin/matches/actions.ts`, add `generateAndRenderImageAction(formData)` mirroring the existing recap actions: `assertAdmin` → `getManagedCompetition` → parse `versionActionSchema` → `createAdminSupabaseClient` → `assertMatchInManaged` → confirm the version belongs to the match
- [x] 1.2 Sequence the work in a try/catch: call `generateMatchImagePrompt(admin, summary_id)`; only if it generated, call `requestMatchImageRender(admin, summary_id)`; map to a single `comboResult` code (`rendered` | `prompt-only` | `no-key` | `error`) and `revalidateAfterMutation(managed.is_active, "/matches/<id>")`, then redirect with `comboResult`

## 2. Admin UI

- [x] 2.1 On the admin match detail page, add a per-version **"Generate & render image"** button (its own `<form action={generateAndRenderImageAction}>` with hidden `summary_id`/`match_id`/`locale`), disabled when the OpenRouter key is absent (`!hasKey`), alongside the existing controls
- [x] 2.2 Extend `resolveOutcome` to map the `comboResult` family: `rendered`→success, `prompt-only`→info, `no-key`→info, `error`→error
- [x] 2.3 Add the `comboResult` strings + button label/pending to the message catalogs (en/es/fr/de)

## 3. Tests & verification

- [x] 3.1 Action tests (extend `tests/recap-version-actions.test.ts`): admin gate, scope/ownership refusal, happy path (`comboResult=rendered`, asserts prompt then render called in order), `prompt-only` when render returns a skip/throws, `no-key` when the prompt step is dormant, error mapping
- [x] 3.2 Run `pnpm lint` + test suite; verify the button end-to-end in a configured env (one click → prompt stored → render pending → image via webhook/poll)
