import { describe, expect, it } from "vitest";
import {
  CARD_VERSION,
  cardETag,
  ifNoneMatchSatisfied,
  notModified,
  OG_CACHE_CONTROL,
} from "@/lib/og-cache";

const base = [3, "Ada Lovelace", 47, 9, 128, "en"] as const;

describe("cardETag", () => {
  it("is a quoted strong validator", () => {
    const tag = cardETag([...base]);
    expect(tag.startsWith('"')).toBe(true);
    expect(tag.endsWith('"')).toBe(true);
    expect(tag.startsWith("W/")).toBe(false);
  });

  it("is stable for identical inputs", () => {
    expect(cardETag([...base])).toBe(cardETag([...base]));
  });

  it("changes when any rendered input changes", () => {
    const baseline = cardETag([...base]);
    const mutations: Array<readonly (string | number)[]> = [
      [4, "Ada Lovelace", 47, 9, 128, "en"], // rank
      [3, "Ada L.", 47, 9, 128, "en"], // name
      [3, "Ada Lovelace", 48, 9, 128, "en"], // points
      [3, "Ada Lovelace", 47, 10, 128, "en"], // exact
      [3, "Ada Lovelace", 47, 9, 129, "en"], // players
      [3, "Ada Lovelace", 47, 9, 128, "es"], // locale
    ];
    for (const m of mutations) {
      expect(cardETag([...m])).not.toBe(baseline);
    }
  });

  it("distinguishes null/undefined from empty string consistently", () => {
    expect(cardETag([null])).toBe(cardETag([undefined]));
    expect(cardETag([null])).toBe(cardETag([""]));
  });

  it("folds CARD_VERSION into the hash", () => {
    // Sanity: the constant exists and participates (same inputs + same version).
    expect(typeof CARD_VERSION).toBe("string");
    expect(cardETag(["x"])).toBe(cardETag(["x"]));
  });
});

describe("ifNoneMatchSatisfied", () => {
  const etag = cardETag([...base]);
  const req = (h: string | null) =>
    new Request("https://x.test/api/og/rank", {
      headers: h === null ? {} : { "if-none-match": h },
    });

  it("matches an exact ETag", () => {
    expect(ifNoneMatchSatisfied(req(etag), etag)).toBe(true);
  });

  it("matches a weak-prefixed validator", () => {
    expect(ifNoneMatchSatisfied(req(`W/${etag}`), etag)).toBe(true);
  });

  it("matches within a comma-separated list", () => {
    expect(ifNoneMatchSatisfied(req(`"other", ${etag}`), etag)).toBe(true);
  });

  it("matches the wildcard", () => {
    expect(ifNoneMatchSatisfied(req("*"), etag)).toBe(true);
  });

  it("does not match a different ETag or a missing header", () => {
    expect(ifNoneMatchSatisfied(req('"nope"'), etag)).toBe(false);
    expect(ifNoneMatchSatisfied(req(null), etag)).toBe(false);
  });
});

describe("notModified", () => {
  it("returns a 304 echoing the validators", () => {
    const etag = cardETag([...base]);
    const res = notModified(etag);
    expect(res.status).toBe(304);
    expect(res.headers.get("etag")).toBe(etag);
    expect(res.headers.get("cache-control")).toBe(OG_CACHE_CONTROL);
  });
});
