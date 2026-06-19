import { describe, expect, it } from "vitest";
import {
  DEFAULT_EMAIL_PREFS,
  emailPrefsSchema,
  isOptedIn,
  normalizeEmailPrefs,
} from "@/lib/email-prefs";

describe("isOptedIn", () => {
  it("returns false only when the key is explicitly false", () => {
    expect(isOptedIn({ result: false }, "result")).toBe(false);
  });

  it("treats a missing key as opted-in", () => {
    expect(isOptedIn({ result: true }, "quiz_reminder")).toBe(true);
    expect(isOptedIn({}, "result")).toBe(true);
  });

  it("treats null/undefined/non-object prefs as opted-in", () => {
    expect(isOptedIn(null, "result")).toBe(true);
    expect(isOptedIn(undefined, "result")).toBe(true);
    expect(isOptedIn("nonsense", "result")).toBe(true);
  });

  it("treats a non-boolean value as opted-in", () => {
    expect(isOptedIn({ result: "no" }, "result")).toBe(true);
    expect(isOptedIn({ result: 0 }, "result")).toBe(true);
  });
});

describe("normalizeEmailPrefs", () => {
  it("fills missing keys with the all-on default", () => {
    expect(normalizeEmailPrefs({ result: false })).toEqual({
      prediction_reminder: true,
      result: false,
      quiz_reminder: true,
      results_digest: true,
      recap_digest: true,
      comeback: true,
    });
  });

  it("returns all-on for an absent/empty value", () => {
    expect(normalizeEmailPrefs(undefined)).toEqual(DEFAULT_EMAIL_PREFS);
    expect(normalizeEmailPrefs({})).toEqual(DEFAULT_EMAIL_PREFS);
  });
});

describe("emailPrefsSchema", () => {
  it("accepts a partial payload of known boolean keys", () => {
    const parsed = emailPrefsSchema.safeParse({ result: false });
    expect(parsed.success).toBe(true);
  });

  it("rejects a non-boolean value", () => {
    const parsed = emailPrefsSchema.safeParse({ result: "no" });
    expect(parsed.success).toBe(false);
  });

  it("ignores unknown keys (strips them)", () => {
    const parsed = emailPrefsSchema.safeParse({ result: true, bogus: true });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data).toEqual({ result: true });
  });
});
