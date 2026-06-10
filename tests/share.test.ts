import { describe, expect, it } from "vitest";
import {
  MAX_SHARE_GOALS,
  buildFacebookShareUrl,
  buildPickSharePath,
  buildTweetIntentUrl,
  clampGoals,
} from "@/lib/share";

describe("clampGoals", () => {
  it("passes through valid integers", () => {
    expect(clampGoals(0)).toBe(0);
    expect(clampGoals(3)).toBe(3);
    expect(clampGoals("7")).toBe(7);
  });

  it("clamps out-of-range values", () => {
    expect(clampGoals(999)).toBe(MAX_SHARE_GOALS);
    expect(clampGoals(-5)).toBe(0);
    expect(clampGoals("999")).toBe(MAX_SHARE_GOALS);
  });

  it("floors decimals", () => {
    expect(clampGoals(2.9)).toBe(2);
  });

  it("returns null for non-numeric input", () => {
    expect(clampGoals(undefined)).toBeNull();
    expect(clampGoals(null)).toBeNull();
    expect(clampGoals("")).toBeNull();
    expect(clampGoals("abc")).toBeNull();
    expect(clampGoals(NaN)).toBeNull();
  });
});

describe("buildPickSharePath", () => {
  it("builds a locale-prefixed path with clamped scores", () => {
    expect(buildPickSharePath("en", "abc-123", 2, 1)).toBe(
      "/en/share/pick/abc-123?h=2&a=1",
    );
    expect(buildPickSharePath("es", "abc-123", 999, -1)).toBe(
      `/es/share/pick/abc-123?h=${MAX_SHARE_GOALS}&a=0`,
    );
  });
});

describe("intent URLs", () => {
  it("tweet intent encodes text and url", () => {
    const url = buildTweetIntentUrl(
      "My pick: México 2–1 Côte d'Ivoire",
      "https://example.com/en/share/pick/x?h=2&a=1",
    );
    expect(url.startsWith("https://twitter.com/intent/tweet?")).toBe(true);
    const params = new URL(url).searchParams;
    expect(params.get("text")).toBe("My pick: México 2–1 Côte d'Ivoire");
    expect(params.get("url")).toBe(
      "https://example.com/en/share/pick/x?h=2&a=1",
    );
  });

  it("facebook sharer encodes the url", () => {
    const url = buildFacebookShareUrl(
      "https://example.com/en/share/pick/x?h=2&a=1",
    );
    expect(url.startsWith("https://www.facebook.com/sharer/sharer.php?")).toBe(
      true,
    );
    expect(new URL(url).searchParams.get("u")).toBe(
      "https://example.com/en/share/pick/x?h=2&a=1",
    );
  });
});
