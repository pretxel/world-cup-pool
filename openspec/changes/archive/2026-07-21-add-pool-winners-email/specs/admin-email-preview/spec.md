# admin-email-preview Specification (delta)

## MODIFIED Requirements

### Requirement: Admin can preview every transactional email template

The admin Operations Emails tab SHALL offer a Previews mode listing every transactional email type (welcome, result, results digest, recap digest, prediction reminder, quiz reminder, playoff score, comeback, score rules, group invite, magic link, winners). Selecting a type SHALL render the real template function with representative sample data and display the rendered subject, preheader, and HTML body.

#### Scenario: Admin opens a template preview

- **WHEN** an admin opens the Previews mode and selects an email type
- **THEN** the page shows that email's rendered subject and preheader as text, and the HTML body inside a sandboxed iframe

#### Scenario: Every email type is available

- **WHEN** an admin views the template selector
- **THEN** all twelve transactional email types are listed and each one renders without error
