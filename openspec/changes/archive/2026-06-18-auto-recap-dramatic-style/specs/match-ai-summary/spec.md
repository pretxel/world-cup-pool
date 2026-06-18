## ADDED Requirements

### Requirement: Automatic recap uses the dramatic style

The automatic recap generation path SHALL apply the `dramatic` style preset by default —
the post-final flow (the result-sync cron pass and the management-list quick action)
stores the active version with `style_key = "dramatic"` and the preset's
`style_instruction`. Admin regeneration with an explicitly chosen style SHALL be
unaffected — the dramatic default applies only when no style is supplied. The dramatic
recap SHALL remain grounded strictly in the provided events and score; the style
guidance SHALL NOT override the no-invented-facts constraint.

#### Scenario: Automatic recap is dramatic

- **WHEN** the automatic path generates a recap for a `final` match
- **THEN** the stored active version records `style_key = "dramatic"` and the dramatic
  `style_instruction`, and the recap stays within the provided events and score

#### Scenario: Explicit admin style still wins

- **WHEN** an admin regenerates with an explicitly chosen style (e.g. `concise`)
- **THEN** that chosen style is applied, not the dramatic auto default
