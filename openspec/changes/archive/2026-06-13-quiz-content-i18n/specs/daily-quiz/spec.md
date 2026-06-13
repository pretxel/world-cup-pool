# daily-quiz — delta for quiz-content-i18n

## ADDED Requirements

### Requirement: Quiz content is served in the request locale with English fallback

The `/quiz` page SHALL render the active question's prompt and options in the request locale (`es`, `fr`) when that locale's translation exists on the question, and in English otherwise. A translation SHALL be used only when its option count matches the English option count and all of its fields are non-blank; any malformed or partial translation SHALL fall back to English entirely (never a mixed-language question). Option order SHALL be identical across locales so the stored `correct_index` grades every locale the same way.

#### Scenario: Translated question in Spanish
- **WHEN** a visitor loads `/es/quiz` and today's question has a Spanish translation with the same number of options as the English original
- **THEN** the page renders the Spanish prompt and Spanish options
- **AND** answering by index grades identically to the English question

#### Scenario: Untranslated question falls back to English
- **WHEN** a visitor loads `/fr/quiz` and today's question has no French translation
- **THEN** the page renders the English prompt and options

#### Scenario: Malformed translation falls back entirely
- **WHEN** today's question has a Spanish translation whose option count differs from the English options (or contains a blank entry)
- **THEN** `/es/quiz` renders the full English prompt and options, with no mixed-language content

#### Scenario: Translations never leak the correct answer
- **WHEN** any client reads today's question through the public view
- **THEN** the response may contain prompt/option translations but still omits the correct option index

## MODIFIED Requirements

### Requirement: Admin question authoring

The system SHALL let an admin create a quiz question with a prompt, options, the correct option, and an `active_on` date, plus optional Spanish and French translations of the prompt and options. A translation SHALL be accepted only when its prompt is non-blank and it provides exactly one non-blank option per English option (preserving order/index alignment); a fully blank translation block SHALL be ignored rather than rejected. Non-admins SHALL NOT be able to create or edit questions.

#### Scenario: Admin creates a question
- **WHEN** an admin submits a prompt, options, correct option, and an `active_on` date
- **THEN** the question is stored and becomes the active question on that date

#### Scenario: Admin adds translations
- **WHEN** an admin fills the Spanish and/or French translation fields with a prompt and one option per English option
- **THEN** the translations are stored with the question and served to visitors in those locales

#### Scenario: Mismatched translation rejected
- **WHEN** an admin submits a Spanish translation whose non-blank option count differs from the English options
- **THEN** the action is rejected with a validation error and nothing is stored

#### Scenario: Non-admin blocked
- **WHEN** a non-admin attempts to create or edit a question
- **THEN** the operation is denied by RLS
