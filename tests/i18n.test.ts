import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  SUPPORTED_LOCALES,
  DEFAULT_LOCALE,
  isLocale,
  localePath,
  LOCALE_LABELS,
} from "@/lib/i18n";

const MESSAGES_DIR = path.resolve(__dirname, "..", "messages");

function flattenKeys(obj: unknown, prefix = ""): string[] {
  if (obj === null || typeof obj !== "object") return [prefix];
  const out: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const next = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === "object") {
      out.push(...flattenKeys(v, next));
    } else {
      out.push(next);
    }
  }
  return out.sort();
}

describe("i18n constants", () => {
  it("DEFAULT_LOCALE is in SUPPORTED_LOCALES", () => {
    expect((SUPPORTED_LOCALES as readonly string[])).toContain(DEFAULT_LOCALE);
  });

  it("every supported locale has a human-readable label", () => {
    for (const loc of SUPPORTED_LOCALES) {
      expect(LOCALE_LABELS[loc]).toBeTruthy();
    }
  });

  it("isLocale narrows correctly", () => {
    expect(isLocale("en")).toBe(true);
    expect(isLocale("xx")).toBe(false);
  });

  it("localePath prefixes correctly", () => {
    expect(localePath("en", "/")).toBe("/en");
    expect(localePath("en", "/matches")).toBe("/en/matches");
    expect(localePath("en", "matches")).toBe("/en/matches");
  });
});

describe("message bundles", () => {
  it("a JSON file exists for every supported locale", () => {
    for (const loc of SUPPORTED_LOCALES) {
      const file = path.join(MESSAGES_DIR, `${loc}.json`);
      expect(fs.existsSync(file), `missing ${file}`).toBe(true);
    }
  });

  it("all supported locales share the exact same key set", () => {
    const keysByLocale = SUPPORTED_LOCALES.map((loc) => ({
      loc,
      keys: flattenKeys(
        JSON.parse(
          fs.readFileSync(path.join(MESSAGES_DIR, `${loc}.json`), "utf8"),
        ),
      ),
    }));

    const reference = keysByLocale[0]!.keys;
    for (const { loc, keys } of keysByLocale.slice(1)) {
      expect(keys, `${loc} keys differ from ${keysByLocale[0]!.loc}`).toEqual(
        reference,
      );
    }
  });
});
