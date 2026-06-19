import { describe, expect, it, vi } from "vitest";
import {
  checkEmailSenderConfig,
  RESEND_SANDBOX_ADDRESS,
} from "@/lib/notifications/email-sender-config";

// The helper is pure: it takes the resolved config + NODE_ENV explicitly, so
// these tests never touch process.env or the real `@/lib/env` module. The
// stub mirrors the default env import shape (`emailFrom`, `resendApiKey`).
vi.mock("@/lib/env", () => ({
  env: { emailFrom: "World Cup Pools <test@example.com>", resendApiKey: "re_test" },
}));

const SANDBOX_FROM = `World Cup Pools <${RESEND_SANDBOX_ADDRESS}>`;
const VERIFIED_FROM = "World Cup Pools <noreply@verified-domain.com>";

describe("checkEmailSenderConfig", () => {
  it("flags the sandbox sender in production (key present) as warning-worthy", () => {
    const result = checkEmailSenderConfig(
      { emailFrom: SANDBOX_FROM, resendApiKey: "re_live" },
      "production",
    );
    expect(result.isSandboxSender).toBe(true);
    expect(result.missingApiKey).toBe(false);
    expect(result.shouldWarn).toBe(true);
    expect(result.message).toContain(RESEND_SANDBOX_ADDRESS);
  });

  it("flags a missing API key in production as warning-worthy", () => {
    const result = checkEmailSenderConfig(
      { emailFrom: VERIFIED_FROM, resendApiKey: null },
      "production",
    );
    expect(result.missingApiKey).toBe(true);
    expect(result.isSandboxSender).toBe(false);
    expect(result.shouldWarn).toBe(true);
    expect(result.message).toContain("RESEND_API_KEY");
  });

  it("does not warn for a verified sender + key in production", () => {
    const result = checkEmailSenderConfig(
      { emailFrom: VERIFIED_FROM, resendApiKey: "re_live" },
      "production",
    );
    expect(result.isSandboxSender).toBe(false);
    expect(result.missingApiKey).toBe(false);
    expect(result.shouldWarn).toBe(false);
    expect(result.message).toBeNull();
  });

  it("does not warn outside production even with sandbox sender and no key", () => {
    const result = checkEmailSenderConfig(
      { emailFrom: SANDBOX_FROM, resendApiKey: null },
      "development",
    );
    // The facts are still reported...
    expect(result.isSandboxSender).toBe(true);
    expect(result.missingApiKey).toBe(true);
    expect(result.isProduction).toBe(false);
    // ...but it is not a production warning.
    expect(result.shouldWarn).toBe(false);
    expect(result.message).toBeNull();
  });

  it("matches the sandbox address regardless of a custom display name", () => {
    const result = checkEmailSenderConfig(
      { emailFrom: `Totally Custom Brand <${RESEND_SANDBOX_ADDRESS}>`, resendApiKey: "re_live" },
      "production",
    );
    expect(result.isSandboxSender).toBe(true);
    expect(result.shouldWarn).toBe(true);
  });

  it("matches a bare sandbox address with no display name", () => {
    const result = checkEmailSenderConfig(
      { emailFrom: RESEND_SANDBOX_ADDRESS, resendApiKey: "re_live" },
      "production",
    );
    expect(result.isSandboxSender).toBe(true);
    expect(result.shouldWarn).toBe(true);
  });

  it("reports both problems when key is missing and sandbox sender is used", () => {
    const result = checkEmailSenderConfig(
      { emailFrom: SANDBOX_FROM, resendApiKey: null },
      "production",
    );
    expect(result.message).toContain("RESEND_API_KEY");
    expect(result.message).toContain(RESEND_SANDBOX_ADDRESS);
  });
});
