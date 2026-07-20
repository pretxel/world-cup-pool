# admin-email-preview Specification

## Purpose

Give admins a render-only preview of every transactional email template — subject, preheader, HTML, and plain text, in any supported locale — from the admin Operations area, so copy, layout, and translation changes can be verified without sending a real email.

## Requirements

### Requirement: Admin can preview every transactional email template

The admin Operations Emails tab SHALL offer a Previews mode listing every transactional email type (welcome, result, results digest, recap digest, prediction reminder, quiz reminder, playoff score, comeback, score rules, group invite, magic link, winners). Selecting a type SHALL render the real template function with representative sample data and display the rendered subject, preheader, and HTML body.

#### Scenario: Admin opens a template preview

- **WHEN** an admin opens the Previews mode and selects an email type
- **THEN** the page shows that email's rendered subject and preheader as text, and the HTML body inside a sandboxed iframe

#### Scenario: Every email type is available

- **WHEN** an admin views the template selector
- **THEN** all twelve transactional email types are listed and each one renders without error

### Requirement: Preview renders in any supported locale

The preview SHALL accept a locale selection covering all supported locales (`en`, `es`, `fr`, `de`) and SHALL build the email strings through the same localized string-building path the senders use. Invalid locale values SHALL fall back to `en`.

#### Scenario: Admin switches preview locale

- **WHEN** an admin changes the preview locale to `es`
- **THEN** the subject, preheader, and body copy render from the Spanish messages

#### Scenario: Invalid locale falls back

- **WHEN** the preview URL carries an unsupported locale value
- **THEN** the preview renders in English

### Requirement: Preview shows the plain-text variant

The preview SHALL provide a toggle between the HTML body and the plain-text version produced by the same render call.

#### Scenario: Admin views the text version

- **WHEN** an admin toggles the preview to plain text
- **THEN** the page shows the template's `text` output in a monospace block instead of the HTML iframe

### Requirement: Previews are render-only

Rendering a preview SHALL NOT send any email, call the email provider, write any send log or guard column, or read recipient data. Sample data SHALL be deterministic fixtures typed against the template input types, requiring no database state.

#### Scenario: Preview causes no side effects

- **WHEN** an admin renders any template preview repeatedly
- **THEN** no Resend call is made, no email log rows or send-guard timestamps are written, and the output is identical each time

### Requirement: Preview HTML is isolated from the admin page

The HTML body SHALL be displayed in an iframe with the `sandbox` attribute and no same-origin access, so email styles cannot affect the admin page and admin styles cannot affect the email.

#### Scenario: Email styles stay contained

- **WHEN** a template's HTML includes global element styles
- **THEN** those styles apply only inside the preview iframe and the admin page chrome is unaffected

### Requirement: Preview access is admin-only

The preview mode SHALL live inside the existing admin-gated Operations route and SHALL NOT be reachable by non-admin users.

#### Scenario: Non-admin cannot reach previews

- **WHEN** a non-admin user requests the Operations preview URL
- **THEN** they are denied by the same admin gate that protects the Operations page
