## 1. Default style flip

- [x] 1.1 In `lib/matches/match-summary.ts`, add `const AUTO_SUMMARY_STYLE_KEY = "dramatic";` and change the auto-mode style fallback (line ~168) from `{ key: DEFAULT_STYLE_KEY, instruction: null }` to `{ key: AUTO_SUMMARY_STYLE_KEY, instruction: STYLE_PRESETS[AUTO_SUMMARY_STYLE_KEY] || null }`
- [x] 1.2 Confirm the recap → image_prompt → render auto-chain is unchanged, and that `regenerateMatchSummary` (explicit style) is unaffected

## 2. Tests

- [x] 2.1 Update the auto-path test in `tests/match-summary.test.ts` (the "generates and persists an ACTIVE … version on success" case) to expect `style_key: "dramatic"` and the dramatic `style_instruction` instead of neutral/null
- [x] 2.2 Add/confirm a test that the regenerate path with an explicit style still records that style (auto default does not override)

## 3. Verification

- [x] 3.1 Run `pnpm lint` + `pnpm typecheck` + test suite
- [x] 3.2 Verify on a newly-finalized match (or via the admin quick action) that the stored active recap is `dramatic` and the image prompt + render still chain from it
