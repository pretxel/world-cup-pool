import { describe, expect, it, vi } from "vitest";

// result-emails.ts pulls in @/lib/env, which throws on missing vars at import.
// We only exercise the pure isSendableEmail guard, so a minimal stub is enough.
vi.mock("@/lib/env", () => ({
  env: {
    resendApiKey: "test",
    emailFrom: "World Cup Pools <noreply@wc26pool.com>",
    siteUrl: "https://wc26pool.com",
  },
}));

import { isSendableEmail } from "@/lib/notifications/result-emails";

describe("isSendableEmail", () => {
  it("accepts ordinary deliverable addresses", () => {
    expect(isSendableEmail("player@gmail.com")).toBe(true);
    expect(isSendableEmail("a.b+tag@sub.domain.co.uk")).toBe(true);
  });

  it("rejects RFC 2606 reserved example domains (Resend's named offender)", () => {
    expect(isSendableEmail("seed@example.com")).toBe(false);
    expect(isSendableEmail("seed@example.org")).toBe(false);
    expect(isSendableEmail("seed@EXAMPLE.NET")).toBe(false);
  });

  it("rejects reserved TLDs", () => {
    expect(isSendableEmail("dev@app.test")).toBe(false);
    expect(isSendableEmail("dev@foo.invalid")).toBe(false);
    expect(isSendableEmail("dev@anything.example")).toBe(false);
    expect(isSendableEmail("dev@box.localhost")).toBe(false);
  });

  it("rejects malformed addresses", () => {
    expect(isSendableEmail("")).toBe(false);
    expect(isSendableEmail("noatsign")).toBe(false);
    expect(isSendableEmail("@nolocal.com")).toBe(false);
    expect(isSendableEmail("trailing@")).toBe(false);
    expect(isSendableEmail("no@dotdomain")).toBe(false);
    expect(isSendableEmail("double@@at.com")).toBe(false);
    expect(isSendableEmail("dots@bad..domain.com")).toBe(false);
  });
});
