## 1. Schema & types

- [x] 1.1 Add migration `supabase/migrations/<ts>_match_summaries_image_prompt.sql` adding nullable `image_prompt text` to `public.match_summaries` (no backfill, no RLS change)
- [x] 1.2 Apply the migration locally and regenerate `lib/database.types.ts`; confirm `image_prompt` appears in the `match_summaries` Row/Insert/Update types

## 2. Prompt builder & generator

- [x] 2.1 Create `lib/matches/match-image-prompt.ts` with the fixed template constants (ART STYLE, CHARACTER DESIGN "Kenji", TECHNICAL SPECIFICATIONS) and the 4-panel PANEL LAYOUT skeleton
- [x] 2.2 Implement pure `buildImagePromptMessages(content, match)` returning `{ system, user }`: system tells the model to emit the fixed sections verbatim and fill ONLY the four `Visual`/`Narration Box` panels, grounded strictly in the recap + match context (no invented facts)
- [x] 2.3 Implement `generateMatchImagePrompt(admin, summaryId)`: load the summary row + its match (teams/score/stage), gate on `OPENROUTER_API_KEY`, call `createChatCompletion` (raised `maxTokens` ~800), update `image_prompt` on that row, and return `{ generated, reason? }` (`no-key` | `missing` | `empty-content`); throw only on configured-key provider/DB failure

## 3. Auto generation in the sync flow

- [x] 3.1 In `generateMatchSummary` (auto mode success path, after the active recap insert), call `generateMatchImagePrompt(admin, inserted.id)` inside a try/catch that logs and swallows errors so recap/score/sync writes are never blocked
- [x] 3.2 Confirm the regenerate (draft) path does NOT auto-generate an image prompt

## 4. Admin on-demand action & UI

- [x] 4.1 Add server action `generateMatchImagePromptAction(summaryId)` in `app/[locale]/(admin)/admin/matches/actions.ts`, guarded by the same admin check as the other recap actions, calling the core function, then `revalidatePath` on the match detail route
- [x] 4.2 On the admin match detail page (`app/[locale]/(admin)/admin/matches/[matchId]/page.tsx`), render each version's stored `image_prompt` and add a "Generate image prompt" button (regenerate label when one exists) wired to the action, with success/error feedback
- [x] 4.3 Add the admin-UI label/toast string(s) to the message catalogs (en/es/fr/de)

## 5. Tests & verification

- [x] 5.1 Unit test `buildImagePromptMessages`: fixed sections present verbatim, exactly four panels, output references the provided teams/score and stays within the recap (mirror `tests/match-summary.test.ts` style)
- [x] 5.2 Test `generateMatchImagePrompt` paths: `no-key` dormant (no write), `missing` row, successful write to `image_prompt`, and provider-failure throw
- [x] 5.3 Test the auto chain: image-prompt failure is swallowed and does not fail recap generation (extend the relevant `tests/*summary*.test.ts`)
- [x] 5.4 Run `pnpm lint` and the test suite; verify the admin action end-to-end in the running app (generate + regenerate a prompt for a version)
