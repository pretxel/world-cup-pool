## ADDED Requirements

### Requirement: Every seeded quiz question ships translated

Every quiz question that ships with the product (the seeded set, and any row backfilled into an already-deployed database) SHALL carry complete Spanish (`es`) and French (`fr`) translations of its prompt and options. A shipped translation SHALL provide a non-blank prompt and exactly one non-blank option per English option, in the same order, so it is accepted by the existing translation validator and grades identically under the stored `correct_index`. The English columns remain canonical and unchanged; this requirement guarantees that a supported-locale visitor never falls back to English merely because translation content is absent.

This strengthens — but does not replace — the existing "Quiz content is served in the request locale with English fallback" requirement: fallback remains the defined behavior for any malformed or missing translation, but the shipped content SHALL not rely on it.

#### Scenario: Seeded question has Spanish and French translations
- **WHEN** the seed data is loaded
- **THEN** every seeded question has an `es` translation and an `fr` translation
- **AND** each translation's option count equals the English option count
- **AND** each translation's prompt and every option are non-blank

#### Scenario: Translated options preserve order and index
- **WHEN** a seeded question's `es` or `fr` translation is read
- **THEN** translated `options[i]` corresponds to English `options[i]` for every `i`
- **AND** answering by the stored `correct_index` is correct in every locale

#### Scenario: Existing database backfilled without reseed
- **WHEN** the backfill migration runs against a database that already contains the seeded questions
- **THEN** each existing question (matched by `active_on`) gains its `es` and `fr` translations
- **AND** re-running the migration leaves the data unchanged (idempotent)

#### Scenario: Supported-locale visitor sees translated content
- **WHEN** a visitor loads `/es/quiz` or `/fr/quiz` on a day with a seeded question
- **THEN** the prompt and options render in that locale, not English
