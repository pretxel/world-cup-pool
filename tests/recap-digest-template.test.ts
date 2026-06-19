import { describe, expect, it } from "vitest";
import {
  renderRecapDigest,
  type RecapDigestData,
  type RecapDigestStrings,
} from "@/lib/notifications/recap-digest-template";

// ---------------------------------------------------------------------------
// renderRecapDigest — pure renderer
// ---------------------------------------------------------------------------

const STRINGS: RecapDigestStrings = {
  subject: "New match comics from the pool",
  preheader: "preheader text",
  eyebrow: "Match comics",
  heading: "Alex, fresh comics just dropped",
  headingNoName: "Fresh comics just dropped",
  intro: "We turned the latest matches into comic recaps.",
  vsLabel: "vs",
  matchCtaLabel: "View match",
  shareCtaLabel: "Share",
  footer: "You're getting this recap-comic digest from your World Cup pool.",
};

function makeData(overrides: Partial<RecapDigestData> = {}): RecapDigestData {
  return {
    displayName: "Alex",
    comics: [
      {
        home: "FRA",
        away: "ARG",
        comicUrl: "https://cdn.example.com/storage/v1/object/public/match-recap-images/m1.png",
        matchUrl: "https://example.com/en/matches/m1",
        shareUrl: "https://twitter.com/intent/tweet/share-m1",
      },
      {
        home: "BRA",
        away: "GER",
        comicUrl: "https://cdn.example.com/storage/v1/object/public/match-recap-images/m2.png",
        matchUrl: "https://example.com/en/matches/m2",
        shareUrl: "https://twitter.com/intent/tweet/share-m2",
      },
    ],
    strings: STRINGS,
    ...overrides,
  };
}

describe("renderRecapDigest", () => {
  it("returns the subject and includes the preheader", () => {
    const out = renderRecapDigest(makeData());
    expect(out.subject).toBe(STRINGS.subject);
    expect(out.html).toContain("preheader text");
  });

  it("uses the personalized heading when a display name is present", () => {
    const out = renderRecapDigest(makeData({ displayName: "Alex" }));
    expect(out.html).toContain("Alex, fresh comics just dropped");
    expect(out.text).toContain("Alex, fresh comics just dropped");
  });

  it("uses the no-name heading when displayName is null", () => {
    const out = renderRecapDigest(makeData({ displayName: null }));
    expect(out.html).toContain("Fresh comics just dropped");
    expect(out.html).not.toContain("Alex, fresh comics just dropped");
    expect(out.text).toContain("Fresh comics just dropped");
  });

  it("includes each comic's image, match link and share link in the HTML", () => {
    const out = renderRecapDigest(makeData());
    for (const c of makeData().comics) {
      expect(out.html).toContain(c.comicUrl);
      expect(out.html).toContain(c.matchUrl);
      expect(out.html).toContain(c.shareUrl);
    }
  });

  it("gives each comic image team-naming alt text", () => {
    const out = renderRecapDigest(makeData());
    expect(out.html).toContain('alt="FRA vs ARG"');
    expect(out.html).toContain('alt="BRA vs GER"');
  });

  it("lists each match and its match link in the text part (useful with images off)", () => {
    const out = renderRecapDigest(makeData());
    expect(out.text).toContain("FRA vs ARG");
    expect(out.text).toContain("https://example.com/en/matches/m1");
    expect(out.text).toContain("BRA vs GER");
    expect(out.text).toContain("https://example.com/en/matches/m2");
  });

  it("HTML-escapes interpolated copy", () => {
    const out = renderRecapDigest(
      makeData({
        comics: [
          {
            home: "A & B",
            away: "C<D>",
            comicUrl: "https://cdn.example.com/x.png",
            matchUrl: "https://example.com/en/matches/m9",
            shareUrl: "https://twitter.com/intent/tweet?text=x",
          },
        ],
      }),
    );
    expect(out.html).toContain("A &amp; B");
    expect(out.html).toContain("C&lt;D&gt;");
    expect(out.html).not.toContain("C<D>");
  });
});
