## ADDED Requirements

### Requirement: Matches list marks fixtures the signed-in user has already predicted

The `/matches` list SHALL display a "picked" indicator on every row for which the **currently authenticated** user has submitted a prediction. The indicator SHALL carry an accessible label sourced from the `matches.rowPicked` message. For anonymous (signed-out) visitors the list SHALL render exactly as before, with no picked indicator and no additional prediction query.

#### Scenario: Signed-in user sees picks marked

- **WHEN** an authenticated user who has predicted some fixtures opens `/matches`
- **THEN** each row whose match they have predicted shows the picked indicator
- **AND** rows they have not predicted show no picked indicator

#### Scenario: Anonymous visitor sees no indicators

- **WHEN** a signed-out visitor opens `/matches`
- **THEN** no row shows a picked indicator
- **AND** no per-user prediction query is issued

#### Scenario: Indicator is accessible

- **WHEN** the picked indicator is rendered for a row
- **THEN** it exposes the localized `matches.rowPicked` text to assistive technology (e.g. as an aria-label or visually-hidden label)
