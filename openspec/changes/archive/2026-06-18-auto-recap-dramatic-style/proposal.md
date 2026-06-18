## Why

When scoring finishes for a final match, the automatic recap is generated in the
`neutral` style. Neutral reads flat and makes a dull comic. The `dramatic` preset
already exists (admins use it on regenerate) and produces punchier recaps — and a
far better source for the comic image that the auto-chain renders next. Making the
automatic recap dramatic by default raises the quality of every auto-generated recap
and its downstream image.

## What Changes

- The **automatic** recap path (post-final: the result-sync cron pass and the
  management-list quick action) generates the recap using the **`dramatic`** style
  preset instead of `neutral`, recording `style_key = "dramatic"` and the preset's
  `style_instruction`.
- The existing auto-chain is unchanged and still follows: dramatic recap →
  `image_prompt` → Leonardo render. No new trigger needed — "score engine finished"
  is the existing post-final flow.
- Admin **regeneration** is unaffected: an explicitly chosen style still wins (the
  dramatic default applies only when no style is supplied).
- Grounding is preserved: the dramatic guidance is appended after the "use only the
  provided events and score, never invent" constraint, which still dominates.

## Capabilities

### New Capabilities
<!-- None. -->

### Modified Capabilities
- `match-ai-summary`: the automatic generation path applies the `dramatic` style
  preset by default (the spec did not previously pin the automatic style).

## Impact

- **Code**: `lib/matches/match-summary.ts` — the auto-mode style fallback changes from
  `{ neutral, null }` to the dramatic preset (one constant + the fallback). Affects the
  two auto callers (cron `generatePendingSummaries`, admin `summarizeMatch`); explicit
  `regenerate` styles are untouched.
- **Tests**: update the auto-path assertion (now `style_key: "dramatic"` + the dramatic
  instruction).
- **No** schema, migration, or dependency change. Depends on the existing recap +
  image auto-chain (`match-ai-summary`, `match-recap-image-prompt`,
  `match-recap-image-render`).
