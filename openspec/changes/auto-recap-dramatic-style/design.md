## Context

`generateMatchSummary` (`lib/matches/match-summary.ts`) resolves the style as
`const style = opts.style ?? { key: DEFAULT_STYLE_KEY, instruction: null }` where
`DEFAULT_STYLE_KEY = "neutral"`. Callers:
- `generatePendingSummaries` (post-final cron) → `generateMatchSummary(admin, id)` (no
  style) → neutral.
- `summarizeMatch` admin quick action → `generateMatchSummary(admin, match_id)` (no
  style) → neutral.
- `regenerateMatchSummary` admin → passes an explicit resolved style.

After the auto recap inserts as active, the existing chain runs `generateMatchImagePrompt`
→ `requestMatchImageRender` (both isolated). `STYLE_PRESETS.dramatic` already exists and
`buildSummaryPrompt` appends any style instruction AFTER the grounding rule.

## Goals / Non-Goals

**Goals:**
- The automatic recap defaults to the `dramatic` style (recorded on the row), so the
  recap and its downstream comic are punchier.
- Keep the existing trigger and auto-chain (recap → image_prompt → render) intact.

**Non-Goals:**
- Changing the trigger, the chain, or admin regeneration (explicit styles still win).
- Making the style configurable per-competition or via env (a single constant for now).
- Re-generating recaps for matches already summarized in neutral (idempotent auto path
  skips existing versions; admins can regenerate if they want dramatic retroactively).

## Decisions

### Flip the auto-mode default style to dramatic (single point)
Change the fallback in `generateMatchSummary` from neutral to a dramatic default:
```
const AUTO_SUMMARY_STYLE_KEY = "dramatic";
...
const style = opts.style ??
  { key: AUTO_SUMMARY_STYLE_KEY, instruction: STYLE_PRESETS[AUTO_SUMMARY_STYLE_KEY] || null };
```
This is the one place the auto callers fall through, so both the cron and the admin
quick action become dramatic, while `regenerate` (which always passes a style) is
untouched. Recording happens already (the resolved `style.key`/`style.instruction` are
written to the row), and grounding is already preserved by `buildSummaryPrompt`.

Alternative considered: pass the dramatic style only inside `generatePendingSummaries`
(cron-only). Rejected — both auto entry points are "automatic"; one default keeps them
consistent and avoids a second source of truth. `DEFAULT_STYLE_KEY` (still referenced
for the neutral preset elsewhere) is left as-is; the auto default uses the new constant.

## Risks / Trade-offs

- **Admin quick-action ("Summarize") also becomes dramatic** → Intended (it's an
  automatic-mode trigger); admins retain full style choice via regenerate. Low stakes.
- **Existing neutral recaps stay neutral** → The auto path is idempotent and skips
  matches that already have a version; this only affects newly-finalized matches.
  Acceptable (no mass re-generation / extra cost).
- **Dramatic tone drifting from facts** → Mitigated by the unchanged grounding rule that
  precedes the style guidance in the prompt; the preset itself says "stay strictly
  factual and within the provided events and score".

## Migration Plan

1. Add the `AUTO_SUMMARY_STYLE_KEY` constant and flip the auto-mode style fallback.
2. Update the auto-path test assertion (now dramatic).
3. No DB/deploy migration; ship with the normal build. Rollback = revert the fallback.

## Open Questions

- Should the auto style be env/competition-configurable later? Deferred — a single
  constant is enough for now; easy to lift to config if needed.
