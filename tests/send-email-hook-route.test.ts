import { beforeEach, describe, expect, it, vi } from "vitest";
import { Webhook } from "standardwebhooks";

// Base64 secret shared by the route (via mocked env) and the test signer.
const B64_SECRET = Buffer.from("magic-link-hook-test-secret-0001").toString("base64");

// Mutable mocks shared with the module factories (hoisted above imports).
const h = vi.hoisted(() => ({
  env: {
    resendApiKey: "re_test" as string | null,
    sendEmailHookSecret: "" as string | null,
    emailFrom: "World Cup Pools <noreply@wc26pool.com>",
    supabaseUrl: "https://ref.supabase.co",
  },
  sendMock: vi.fn(async (_payload: { from: string; to: string; subject: string; html: string; text: string }) => ({
    data: { id: "msg_1" },
    error: null as { message?: string } | null,
  })),
}));

vi.mock("@/lib/env", () => ({ env: h.env }));
vi.mock("@/lib/competition", () => ({
  getActiveBranding: vi.fn(async () => ({ emailFromName: "WC Pool" })),
}));
vi.mock("next-intl/server", () => ({
  // Echo the key so we can assert which copy was selected.
  getTranslations: vi.fn(async () => (key: string) => key),
}));
vi.mock("resend", () => ({
  // Must be constructable (route does `new Resend(...)`); a class works, an
  // arrow-bodied vi.fn does not.
  Resend: class {
    emails = { send: h.sendMock };
  },
}));

import { POST } from "@/app/api/auth/send-email/route";

const REDIRECT = "https://world-cup-pool-sepia.vercel.app/auth/callback";

function makePayload(action: string) {
  return JSON.stringify({
    user: { email: "player@gmail.com" },
    email_data: {
      token_hash: "tok_hash_123",
      redirect_to: REDIRECT,
      email_action_type: action,
      site_url: "https://world-cup-pool-sepia.vercel.app",
    },
  });
}

// Build a request whose headers carry a valid Standard Webhooks signature for
// the given body, signed with the same secret the route verifies against.
function signedRequest(body: string, secret = B64_SECRET) {
  const wh = new Webhook(secret);
  const id = "msg_test_1";
  const timestamp = new Date();
  const signature = wh.sign(id, timestamp, body);
  return new Request("http://localhost/api/auth/send-email", {
    method: "POST",
    headers: {
      "webhook-id": id,
      "webhook-timestamp": Math.floor(timestamp.getTime() / 1000).toString(),
      "webhook-signature": signature,
      "content-type": "application/json",
    },
    body,
  });
}

beforeEach(() => {
  h.sendMock.mockClear();
  h.env.resendApiKey = "re_test";
  h.env.sendEmailHookSecret = `v1,whsec_${B64_SECRET}`;
});

describe("POST /api/auth/send-email", () => {
  it("sends a branded magic-link email for a validly-signed request", async () => {
    const res = await POST(signedRequest(makePayload("magiclink")));
    expect(res.status).toBe(200);
    expect(h.sendMock).toHaveBeenCalledTimes(1);

    const arg = h.sendMock.mock.calls[0][0] as {
      from: string;
      to: string;
      subject: string;
      html: string;
      text: string;
    };
    expect(arg.to).toBe("player@gmail.com");
    // Branding name swapped onto the verified-domain address.
    expect(arg.from).toBe("WC Pool <noreply@wc26pool.com>");
    expect(arg.subject).toBe("actions.magiclink.subject");
    // Verification link built from the public Supabase URL + payload fields.
    expect(arg.html).toContain("https://ref.supabase.co/auth/v1/verify");
    expect(arg.html).toContain("token=tok_hash_123");
    expect(arg.html).toContain("type=magiclink");
  });

  it("renders link-bearing alternate types (recovery)", async () => {
    const res = await POST(signedRequest(makePayload("recovery")));
    expect(res.status).toBe(200);
    expect(h.sendMock).toHaveBeenCalledTimes(1);
    const arg = h.sendMock.mock.calls[0][0] as { subject: string; html: string };
    expect(arg.subject).toBe("actions.recovery.subject");
    expect(arg.html).toContain("type=recovery");
  });

  it("rejects an invalid signature with 401 and sends nothing", async () => {
    const bad = signedRequest(makePayload("magiclink"), Buffer.from("wrong-secret").toString("base64"));
    const res = await POST(bad);
    expect(res.status).toBe(401);
    expect(h.sendMock).not.toHaveBeenCalled();
  });

  it("returns 401 when the hook secret is unset", async () => {
    h.env.sendEmailHookSecret = null;
    const res = await POST(signedRequest(makePayload("magiclink")));
    expect(res.status).toBe(401);
    expect(h.sendMock).not.toHaveBeenCalled();
  });

  it("no-ops with 200 for unknown/notification-only action types", async () => {
    const res = await POST(signedRequest(makePayload("password_changed_notification")));
    expect(res.status).toBe(200);
    expect(h.sendMock).not.toHaveBeenCalled();
  });

  it("no-ops with 200 when RESEND_API_KEY is unset (does not block auth)", async () => {
    h.env.resendApiKey = null;
    const res = await POST(signedRequest(makePayload("magiclink")));
    expect(res.status).toBe(200);
    expect(h.sendMock).not.toHaveBeenCalled();
  });
});
