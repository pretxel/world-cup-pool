## Why

The `LanguageSwitcher` exists but is broken visually: it's a native `<select>` wrapped in a parent `<label className="sr-only">`, with `not-sr-only` on the inner select to "undo" the hide. The result is a tiny OS-style native picker glued onto an otherwise polished header — fragile markup, no flag affordance, no presence on mobile (where `MobileNav` shows the menu drawer but no switcher). Users on Spanish/French routes don't have a clear way to discover or change locale.

This change replaces the native `<select>` with a properly styled dropdown that:
- Renders a compact trigger in the desktop nav with the active locale's flag + ISO code (e.g. `🇪🇸 ES`).
- Opens a popover listing all three locales as flag + name rows, highlighting the active one.
- Lives inside the mobile menu drawer as a dedicated section, not crammed into the header bar.
- Still writes the `NEXT_LOCALE` cookie and `router.replace`'s the same logical path with the new prefix on selection.

## What Changes

- `components/language-switcher.tsx` rewritten — drops the `<label sr-only>` + native `<select>` markup. New shape: a `<button>` trigger and an absolute-positioned dropdown panel. Click-outside and `Escape` close behaviors. Trigger composition: small flag (`TeamFlag`-style `<img>` from `/flags/<iso>.svg`) + uppercase ISO code (`EN` / `ES` / `FR`) + chevron icon.
- New `components/language-switcher-list.tsx` (or a sub-component in the same file) — server-renderable list of locale options consumed by both the desktop dropdown panel and the mobile menu section so the markup and copy stay in one place.
- `components/site-nav-client.tsx#MobileNav`: add a `Language` section inside the drawer with the same list of locale options. Tapping a row writes the cookie + navigates, same handler used by the desktop dropdown.
- Flag images for the switcher reuse `public/flags/` SVGs — no new assets. Map `Locale → ISO slug` lives in `lib/i18n.ts`.

## Capabilities

### Modified Capabilities
- `i18n`: the spec's "Language switcher" requirement is extended — the switcher now describes a styled dropdown (not a native select) and SHALL be visible/usable on both desktop and mobile.

## Impact

- Code: `components/language-switcher.tsx` (rewrite), `components/site-nav-client.tsx` (add mobile section), `lib/i18n.ts` (add `LOCALE_FLAG_SLUG` map).
- Assets: no new files — reuse existing `public/flags/{us,es,fr}.svg`. (US flag stands in for the `en` locale, France for `fr`, Spain for `es`. Not perfect linguistic mapping — see Open Questions in design.)
- Tests: extend the existing locale-rendering coverage; no new test files.
- No DB changes. No new runtime deps. Same `next-intl` `useLocale` / `usePathname` / `router.replace` plumbing as today.
