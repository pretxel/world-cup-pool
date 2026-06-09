# news — Delta Spec

## ADDED Requirements

### Requirement: Responsive news layout
The News page SHALL adapt its layout across viewport sizes without horizontal overflow or clipped content. The article card grid SHALL render one column on mobile viewports, two columns from the `sm` breakpoint, and three columns from the `lg` breakpoint, within a page container wide enough for three readable columns. The page header SHALL scale its headline progressively across mobile, tablet, and desktop. Each card footer SHALL keep the source name, published date, and "read more" affordance legible at narrow widths: the source name truncates, the date never wraps, and the separator between source and date renders only when a source name exists.

#### Scenario: Mobile single column
- **WHEN** a visitor opens `/en/news` at a 320–639px wide viewport
- **THEN** article cards render in a single column
- **AND** no element overflows horizontally and the card footer shows the date and "read more" without collision, truncating long source names

#### Scenario: Tablet two columns
- **WHEN** the viewport is between the `sm` and `lg` breakpoints (640–1023px)
- **THEN** article cards render in two columns

#### Scenario: Desktop three columns
- **WHEN** the viewport is at or above the `lg` breakpoint (≥1024px)
- **THEN** article cards render in three columns inside the widened page container
- **AND** thumbnails keep their 16/9 aspect ratio at the narrower column width

#### Scenario: Missing source name
- **WHEN** an article has no source name
- **THEN** the card footer omits the source/date separator and shows only the published date beside the "read more" affordance
