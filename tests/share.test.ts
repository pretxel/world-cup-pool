import { describe, expect, it } from "vitest";
import {
  MAX_SHARE_GOALS,
  buildFacebookShareUrl,
  buildH2HPath,
  buildPickSharePath,
  buildRankSharePath,
  buildTweetIntentUrl,
  canonicalH2HPair,
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
    expect(buildPickSharePath("en", "abc-123", 2, 1)).toBe("/en/share/pick/abc-123?h=2&a=1");
    expect(buildPickSharePath("es", "abc-123", 999, -1)).toBe(
      `/es/share/pick/abc-123?h=${MAX_SHARE_GOALS}&a=0`,
    );
  });
});

describe("buildRankSharePath", () => {
  it("builds a locale-prefixed path identifying the user, no score params", () => {
    expect(buildRankSharePath("en", "user-abc")).toBe("/en/share/rank/user-abc");
    expect(buildRankSharePath("fr", "user-abc")).toBe("/fr/share/rank/user-abc");
  });
});

describe("canonicalH2HPair", () => {
  it("sorts the two ids lexicographically regardless of argument order", () => {
    expect(canonicalH2HPair("alice", "bob")).toEqual(["alice", "bob"]);
    expect(canonicalH2HPair("bob", "alice")).toEqual(["alice", "bob"]);
  });

  it("is order-independent (a/b and b/a produce the same pair)", () => {
    expect(canonicalH2HPair("u-2", "u-1")).toEqual(canonicalH2HPair("u-1", "u-2"));
  });
});

describe("buildH2HPath", () => {
  it("builds a locale-prefixed canonical path identifying both users", () => {
    expect(buildH2HPath("en", "u-1", "u-2")).toBe("/en/h2h/u-1/u-2");
    expect(buildH2HPath("fr", "u-2", "u-1")).toBe("/fr/h2h/u-1/u-2");
  });

  it("returns the same path regardless of argument order", () => {
    expect(buildH2HPath("en", "zeta", "alpha")).toBe(buildH2HPath("en", "alpha", "zeta"));
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
    expect(params.get("url")).toBe("https://example.com/en/share/pick/x?h=2&a=1");
  });

  it("facebook sharer encodes the url", () => {
    const url = buildFacebookShareUrl("https://example.com/en/share/pick/x?h=2&a=1");
    expect(url.startsWith("https://www.facebook.com/sharer/sharer.php?")).toBe(true);
    expect(new URL(url).searchParams.get("u")).toBe("https://example.com/en/share/pick/x?h=2&a=1");
  });
});
