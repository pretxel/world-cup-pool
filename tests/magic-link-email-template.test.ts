import { describe, expect, it } from "vitest";
import {
  buildMagicLinkEmailStrings,
  isLinkAction,
  renderMagicLinkEmail,
  type MagicLinkEmailStrings,
} from "@/lib/notifications/magic-link-email-template";

const STRINGS: MagicLinkEmailStrings = {
  subject: "Your sign-in link",
  preheader: "Your secure sign-in link.",
  eyebrow: "Secure sign-in",
  heading: "Sign in to your pool",
  intro: "Tap the button below to sign in.",
  ctaLabel: "Sign in",
  fallbackLabel: "Button not working? Paste this link:",
  expiryNote: "This link expires in 1 hour.",
  ignoreNote: "If you didn't request it, ignore this email.",
  footer: "You're receiving this because someone entered this address.",
};

const ACTION_URL = "https://ref.supabase.co/auth/v1/verify?token=abc123&type=magiclink&redirect_to=https%3A%2F%2Fwc26.app%2Fauth%2Fcallback";

describe("renderMagicLinkEmail", () => {
  it("renders branded, email-safe HTML with the wordmark and CTA to the action URL", () => {
    const { subject, html } = renderMagicLinkEmail({ actionUrl: ACTION_URL, strings: STRINGS });

    expect(subject).toBe("Your sign-in link");
    // WC·26·POOL wordmark signature.
    expect(html).toContain(">WC<");
    expect(html).toContain(">26<");
    expect(html).toContain(">POOL<");
    // Pitch-green brand color, table layout, no oklch/var().
    expect(html).toContain("#1B7A4D");
    expect(html).toContain("role=\"presentation\"");
    expect(html).not.toMatch(/oklch|var\(/);
    // CTA button + copy-paste fallback both link to the action URL (& escaped).
    const escaped = ACTION_URL.replace(/&/g, "&amp;");
    expect(html).toContain(`href="${escaped}"`);
    expect(html).toContain("Sign in");
  });

  it("includes a plain-text part mirroring the link and copy", () => {
    const { text } = renderMagicLinkEmail({ actionUrl: ACTION_URL, strings: STRINGS });
    expect(text).toContain("Sign in to your pool");
    expect(text).toContain(`Sign in: ${ACTION_URL}`);
    expect(text).toContain("This link expires in 1 hour.");
  });

  it("escapes user/request-derived values in the HTML", () => {
    const evil = "https://ref.supabase.co/auth/v1/verify?redirect_to=\"><script>alert(1)</script>";
    const { html } = renderMagicLinkEmail({
      actionUrl: evil,
      strings: { ...STRINGS, heading: "<b>x</b>" },
    });
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&lt;b&gt;x&lt;/b&gt;");
  });
});

describe("isLinkAction / buildMagicLinkEmailStrings", () => {
  it("recognizes link-bearing action types", () => {
    expect(isLinkAction("magiclink")).toBe(true);
    expect(isLinkAction("recovery")).toBe(true);
    expect(isLinkAction("password_changed_notification")).toBe(false);
    expect(isLinkAction("bogus")).toBe(false);
  });

  it("selects per-action copy and falls back to magiclink for unknown types", () => {
    const t = (key: string) => key;
    expect(buildMagicLinkEmailStrings(t, "recovery").subject).toBe("actions.recovery.subject");
    expect(buildMagicLinkEmailStrings(t, "bogus").ctaLabel).toBe("actions.magiclink.ctaLabel");
    // Shared keys resolve regardless of action.
    expect(buildMagicLinkEmailStrings(t, "magiclink").footer).toBe("footer");
  });
});
