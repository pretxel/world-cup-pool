## Context

Current `components/language-switcher.tsx`:

```tsx
<label className="sr-only" htmlFor="lang-switcher">
  {t("label")}
  <select id="lang-switcher" … className="… not-sr-only">
    {SUPPORTED_LOCALES.map(loc => <option …>{LOCALE_LABELS[loc]}</option>)}
  </select>
</label>
```

The `<label sr-only>` collapses the whole label (including the inner select) into a 0×0 absolute element; `not-sr-only` on the child tries to undo it but yields layout that depends on Tailwind's exact reset implementation. The end result varies by browser and breaks accessibility (the label is visually attached but screen readers see "Language" before the select).

It's also missing on mobile entirely. `MobileNav` (drawer) doesn't render `LanguageSwitcher`.

Available UI primitives in `components/ui/`: `dialog`, `tabs`, `button`, `input`, etc. No `dropdown-menu` or `popover`. Project does have `@base-ui/react` installed but it's only used by sonner today. I'll keep this PR dep-light and hand-roll the dropdown (same pattern `MobileNav` already uses for its drawer).

## Goals / Non-Goals

**Goals:**
- Replace the broken `<label sr-only><select>` pattern with a clean styled dropdown.
- One source of truth for the locale-option list (consumed by desktop dropdown + mobile menu section).
- Visible on both desktop nav and mobile drawer.
- Flag affordance — visitors immediately recognize which locale they're on.
- Keeps the existing client-side logic (cookie write + `router.replace`).

**Non-Goals:**
- Don't introduce `@base-ui/react` Menu/Popover. Hand-roll the dropdown to match the local pattern already used by `MobileNav`.
- Don't add new flag SVGs. Reuse `public/flags/` files.
- Don't change the URL strategy. Locale prefix routing stays as-is.
- Don't add per-locale region pickers (no `es-MX` vs `es-ES`).

## Decisions

**1. Locale → flag slug map lives in `lib/i18n.ts`.**

```ts
export const LOCALE_FLAG_SLUG: Record<Locale, string> = {
  en: "us",      // pragmatic stand-in (US hosting + WC26 site context)
  es: "es",      // Spain
  fr: "fr",      // France
};
```

Why `us` for English: the US is the primary WC26 host nation and the default audience reading English. The "gb" alternative is technically correct (English-language origin) but less culturally tied to this product. Open to revisit if a maintainer prefers `gb-eng`.

**2. Hand-rolled dropdown component.**

`LanguageSwitcher` becomes a small client component owning:
- `open` state.
- `triggerRef` for click-outside detection.
- `Escape` key handler.
- A shared `LocaleList` sub-component rendering the three options as flag + name rows, with a checkmark for the active locale.

The desktop dropdown renders `<LanguageSwitcher />` as a button with the compact `{flag}{code}` lockup. Tapping it opens an absolute-positioned panel beneath the trigger containing `<LocaleList />`.

For mobile, we export the `LocaleList` portion separately and mount it inside `MobileNav`'s drawer as a section. It renders the same option rows but without the dropdown wrapper — clicking a row closes the drawer and navigates.

**3. Click-outside + Escape.**

Pattern matches `MobileNav`: a `useEffect` while `open` is true that adds `keydown` (Escape) and `pointerdown` (close if click target is outside the trigger root). Cleanup on unmount + when `open` flips. No new library.

**4. Trigger affordance.**

Desktop trigger:
```
[flag] [EN] [▾]
```
- 16×12 flag SVG with a 1px border so it reads on busy backgrounds.
- Uppercase 2-letter ISO code, mono font, `tracking-[0.16em]`.
- Tiny chevron rotates 180° when open.

Active row in the dropdown panel:
- Slight background highlight (`bg-muted`) + a small check icon on the right.

Mobile section:
- Header: small uppercase "Language" eyebrow (translated from the existing `languageSwitcher.label` key).
- Rows: flag + name + check. Tap = same handler.

**5. Cookie write + nav.**

Same as today:
```ts
document.cookie = `NEXT_LOCALE=${next}; Max-Age=31536000; Path=/; SameSite=Lax`;
const stripped = pathname.replace(/^\/[a-z]{2}(?=\/|$)/, "") || "/";
const target = `/${next}${stripped === "/" ? "" : stripped}`;
router.replace(target);
router.refresh();
```

Factor this into a small `useChangeLocale()` hook so the desktop dropdown and mobile section share one implementation.

## Risks / Trade-offs

- **Risk**: The `en` → `us` flag mapping rubs some users wrong. → **Mitigation**: documented in proposal as an Open Question; trivial to swap to `gb-eng` later by editing one line. Pick `us` for now given the WC26 host-nation context.
- **Risk**: hand-rolled dropdown lacks the polish of a library (no focus trap, no roving tabindex). → **Mitigation**: keep keyboard support minimal: Enter/Space opens, Escape closes, arrow keys not required for 3 items. If users complain we can wire up `@base-ui/react`'s Menu later — no migration cost since the affordance API is the same shape.
- **Risk**: `MobileNav`'s `<form action="/sign-out">` and the new locale-section live inside the same drawer; tap target overlap risk. → **Mitigation**: keep the language section distinct with a `border-t` divider and `pt-3` spacing.

## Migration Plan

1. Add `LOCALE_FLAG_SLUG` to `lib/i18n.ts`.
2. Rewrite `components/language-switcher.tsx`. Export both `LanguageSwitcher` (desktop dropdown) and `LocaleList` (option list, for mobile reuse).
3. Wire `LocaleList` into `MobileNav` as a labeled section.
4. Visually verify across all three locales in dev (desktop + mobile width).
5. Manual: tap to switch on each surface; confirm cookie persists; confirm `router.replace` lands on the right path.

Rollback: revert the PR. No DB or migration impact.

## Open Questions

- Should `en` use `gb-eng` flag instead of `us`? (Defer; doc'd; one-line swap.)
- Should switching language also revalidate the current route's data fetches? (Today it doesn't — same DB queries return same rows. Defer unless we add locale-conditional content.)
