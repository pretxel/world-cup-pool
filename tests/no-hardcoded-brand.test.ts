import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Regression guard: these request-time surfaces were de-hardcoded to resolve
// branding from the active competition (getActiveBranding). They must not
// reintroduce a literal "World Cup" / "WC26" brand string.
//
// Excluded by design: the layouts (`app/layout.tsx`, `app/[locale]/layout.tsx`)
// keep STATIC English brand defaults — they cover statically-collected routes
// like /_not-found, so they must not touch the DB at build time. OG routes keep
// a `?? "WC26"` fallback. Per-locale competition names remain a documented
// deferred follow-up.
const CLEAN_FILES = [
  "components/site-nav.tsx",
  "components/tournament-countdown.tsx",
];

const BRAND_LITERAL = /World Cup|WC26/;

describe("no hardcoded brand literals in de-hardcoded surfaces", () => {
  for (const rel of CLEAN_FILES) {
    it(`${rel} resolves branding instead of hardcoding it`, () => {
      const src = readFileSync(join(process.cwd(), rel), "utf8");
      const offending = src
        .split("\n")
        .map((line, i) => [i + 1, line] as const)
        .filter(([, line]) => BRAND_LITERAL.test(line));
      expect(offending).toEqual([]);
    });
  }
});
