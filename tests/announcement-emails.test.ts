import { describe, expect, it } from "vitest";
import {
  renderAnnouncementEmail,
  type AnnouncementEmailData,
  type AnnouncementEmailStrings,
} from "@/lib/notifications/announcement-email-template";
import {
  computePendingRecipients,
  buildAnnouncementEmailStrings,
  type AnnouncementPlayerRow,
} from "@/lib/notifications/announcement-emails";

// ---------------------------------------------------------------------------
// renderAnnouncementEmail — pure renderer
// ---------------------------------------------------------------------------

const STRINGS: AnnouncementEmailStrings = {
  subject: "We're now WinScore — with multi-league, crypto payments & more 🎉",
  preheader: "A fresh name, a new home at winscore.me, and the features you asked for.",
  eyebrow: "Big news",
  heading: "Say hello to WinScore",
  intro: "The pool you love has a new name and a new home at winscore.me.",
  whatsNewLabel: "What's new",
  features: [
    { title: "Multi-league pools", body: "Run pools across multiple leagues from one account." },
    { title: "Crypto payments", body: "Buy in and pay out with crypto." },
    { title: "…and plenty more", body: "A refreshed look and faster standings." },
  ],
  ctaLabel: "Explore WinScore",
  footer: "You're getting this because you play the pool.",
  madeWithLove: "Made with love :) — pretxel",
};

function makeData(overrides: Partial<AnnouncementEmailData> = {}): AnnouncementEmailData {
  return {
    ctaUrl: "https://winscore.me",
    strings: STRINGS,
    ...overrides,
  };
}

describe("renderAnnouncementEmail", () => {
  it("returns subject/html/text without DB or network", () => {
    const out = renderAnnouncementEmail(makeData());
    expect(out.subject).toBe(STRINGS.subject);
    expect(out.html).toContain("<!DOCTYPE html>");
    expect(typeof out.text).toBe("string");
  });

  it("carries the WinScore wordmark, feature list and CTA in both bodies", () => {
    const out = renderAnnouncementEmail(makeData());
    // Wordmark: the gold "Score" chip is HTML-only; the CTA URL and features
    // appear in both bodies.
    expect(out.html).toContain(">Score</span>");
    for (const part of [out.html, out.text]) {
      for (const f of STRINGS.features) {
        expect(part).toContain(f.title);
        expect(part).toContain(f.body);
      }
      expect(part).toContain("https://winscore.me");
    }
    expect(out.html).toContain(STRINGS.ctaLabel);
    expect(out.text).toContain(STRINGS.ctaLabel);
  });

  it("carries the credit line in both bodies", () => {
    const out = renderAnnouncementEmail(makeData());
    for (const part of [out.html, out.text]) {
      expect(part).toContain("pretxel");
    }
  });

  it("escapes HTML in localized copy", () => {
    const out = renderAnnouncementEmail(
      makeData({
        strings: { ...STRINGS, heading: "<img src=x>" },
      }),
    );
    expect(out.html).not.toContain("<img src=x>");
    expect(out.html).toContain("&lt;img src=x&gt;");
  });
});

// ---------------------------------------------------------------------------
// computePendingRecipients — ledger + preference gating
// ---------------------------------------------------------------------------

function player(id: string, email_prefs: unknown = {}): AnnouncementPlayerRow {
  return { user_id: id, email_prefs };
}

describe("computePendingRecipients", () => {
  const players = [player("a"), player("b"), player("c")];

  it("keeps everyone when no ledger rows and no opt-outs", () => {
    const pending = computePendingRecipients(players, []);
    expect(pending.map((p) => p.user_id)).toEqual(["a", "b", "c"]);
  });

  it("drops players already in the send-once ledger", () => {
    const pending = computePendingRecipients(players, [{ user_id: "b" }]);
    expect(pending.map((p) => p.user_id)).toEqual(["a", "c"]);
  });

  it("drops players opted out of the recap_digest preference", () => {
    const opted = [player("a"), player("b", { recap_digest: false }), player("c")];
    const pending = computePendingRecipients(opted, []);
    expect(pending.map((p) => p.user_id)).toEqual(["a", "c"]);
  });

  it("treats absent or malformed prefs as opted-in", () => {
    const messy = [player("a", "garbage"), player("b", null), player("c")];
    const pending = computePendingRecipients(messy, []);
    expect(pending.map((p) => p.user_id)).toEqual(["a", "b", "c"]);
  });

  it("is idempotent: a fully-ledgered player set yields nothing", () => {
    const pending = computePendingRecipients(
      players,
      players.map((p) => ({ user_id: p.user_id })),
    );
    expect(pending).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// buildAnnouncementEmailStrings — assembles the localized feature list
// ---------------------------------------------------------------------------

describe("buildAnnouncementEmailStrings", () => {
  // Key-echo translator, mirroring existing email tests.
  const t = (key: string) => key;

  it("assembles three features from the numbered keys", () => {
    const strings = buildAnnouncementEmailStrings(t);
    expect(strings.features).toEqual([
      { title: "feature1Title", body: "feature1Body" },
      { title: "feature2Title", body: "feature2Body" },
      { title: "feature3Title", body: "feature3Body" },
    ]);
    expect(strings.subject).toBe("subject");
    expect(strings.ctaLabel).toBe("ctaLabel");
  });
});
