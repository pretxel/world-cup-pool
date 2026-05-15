## 1. Locale → flag mapping

- [x] 1.1 Add `LOCALE_FLAG_SLUG: Record<Locale, string>` to `lib/i18n.ts` mapping `en → "us"`, `es → "es"`, `fr → "fr"`. (Note the en/us pragmatic call — see design's Open Questions.)

## 2. Rewrite the switcher

- [x] 2.1 In `components/language-switcher.tsx`, drop the `<label sr-only>` + `<select>` markup. Build:
  - A `useChangeLocale()` hook that closes over `useLocale`, `usePathname`, `useRouter`, `useTransition`. Returns a single `change(next: Locale)` function that writes the cookie and `router.replace`s the same logical route under the new prefix.
  - A `LocaleList` exported sub-component: renders the three locale options as flag + name rows, marks the active one with `bg-muted` + a `CheckIcon`. Each row is a `<button type="button">` that calls `change(loc)`.
  - The default-exported `LanguageSwitcher` (client component): a `<button>` trigger showing the active flag + uppercase ISO code + chevron, plus an absolute-positioned panel containing `<LocaleList />`. Click-outside and `Escape` close it (mirror `MobileNav`'s pattern).
- [x] 2.2 Trigger styling: 16×12 flag image with 1px border, mono uppercase ISO code, small chevron that rotates 180° when open. Hover/focus rings match other nav buttons.

## 3. Mount on mobile

- [x] 3.1 In `components/site-nav-client.tsx#MobileNav`, import `LocaleList` and render it inside the open drawer as a labelled section below the nav links. Section header: a small uppercase "Language" eyebrow translated from the existing `languageSwitcher.label` key.
- [x] 3.2 Tapping a row in the mobile list calls the same `change(loc)` handler and the drawer closes via the existing route-change effect.

## 4. Verification

- [x] 4.1 `pnpm typecheck` — zero errors.
- [x] 4.2 `pnpm lint` — zero errors.
- [x] 4.3 `pnpm test` — all existing tests still green (key-parity test still passes; no message-key changes). **37/37 pass.**
- [x] 4.4 `openspec validate language-switcher-in-nav` — valid.
- [ ] 4.5 Manual: `pnpm dev`, open desktop nav at `/en/`, `/es/`, `/fr/` — confirm trigger shows the right flag + code, dropdown lists all three, switching navigates correctly.
- [ ] 4.6 Manual: shrink window to mobile width, open the menu drawer, confirm the Language section appears and switching works.
