# brand-identity Specification

## MODIFIED Requirements

### Requirement: Branding resolves from the active competition

User-facing brand surfaces — site name, title templates, keywords, OpenGraph cards and alt text, email sender name, news query, logo edition, and footer/nav copy — SHALL resolve from the active competition's `branding` (and `name`/`short_name`) rather than hardcoded World Cup 2026 literals.

#### Scenario: World Cup branding unchanged

- **WHEN** the active competition is `world-cup-2026`
- **THEN** every brand surface renders the same text and OG imagery as before

#### Scenario: La Liga branding renders correctly

- **WHEN** an admin switches the active competition to `la-liga-2026-2027`
- **THEN** site name, metadata, OG cards, email sender, and footer/nav copy reflect La Liga branding
- **AND** the brand code shows as `LALIGA` instead of `WC26`

#### Scenario: No residual hardcoded competition literals

- **WHEN** the codebase is checked for hardcoded `World Cup` / `WC26` literals outside the competitions seed and `branding`
- **THEN** none remain in `app/`, `components/`, or `lib/`
