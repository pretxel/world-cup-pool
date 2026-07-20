import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { SUPPORTED_LOCALES } from "@/lib/i18n";

// Real messages + real ICU formatting: getTranslations resolves against the
// actual locale files and throws on any missing key or bad interpolation, so
// this suite proves every preview id maps to a valid namespace in every locale.
vi.mock("next-intl/server", async () => {
  const { createTranslator } = await import("next-intl");
  return {
    getTranslations: vi.fn(
      async ({ locale, namespace }: { locale: string; namespace: string }) => {
        const messages = JSON.parse(readFileSync(`messages/${locale}.json`, "utf8"));
        return createTranslator({
          locale,
          messages,
          namespace: namespace as never,
          onError(error) {
            throw error;
          },
        });
      },
    ),
  };
});

import {
  EMAIL_PREVIEW_IDS,
  isEmailPreviewId,
  renderEmailPreview,
} from "@/lib/notifications/email-previews";

describe("renderEmailPreview", () => {
  for (const id of EMAIL_PREVIEW_IDS) {
    for (const locale of SUPPORTED_LOCALES) {
      it(`renders ${id} in ${locale}`, async () => {
        const out = await renderEmailPreview(id, locale);
        expect(out.subject.length).toBeGreaterThan(0);
        expect(out.preheader.length).toBeGreaterThan(0);
        expect(out.html).toContain("<!DOCTYPE html>");
        expect(out.text.length).toBeGreaterThan(0);
      });
    }
  }

  it("is deterministic for repeated renders", async () => {
    const a = await renderEmailPreview("result", "en");
    const b = await renderEmailPreview("result", "en");
    expect(b).toEqual(a);
  });

  it("guards unknown template ids", () => {
    expect(isEmailPreviewId("welcome")).toBe(true);
    expect(isEmailPreviewId("nope")).toBe(false);
  });
});
