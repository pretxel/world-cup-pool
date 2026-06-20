import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// web-push is mocked so no real network/keys are needed. We control what
// sendNotification resolves/throws per case.
const sendNotification = vi.fn();
const setVapidDetails = vi.fn();
vi.mock("web-push", () => ({
  default: {
    setVapidDetails: (...args: unknown[]) => setVapidDetails(...args),
    sendNotification: (...args: unknown[]) => sendNotification(...args),
  },
}));

const SUB = { endpoint: "https://push.example/abc", p256dh: "p", auth: "a" };
const PAYLOAD = { title: "t", body: "b", url: "/x" };

async function importFresh() {
  vi.resetModules();
  return await import("@/lib/notifications/web-push");
}

describe("sendWebPush", () => {
  const original = {
    pub: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    priv: process.env.VAPID_PRIVATE_KEY,
    subj: process.env.VAPID_SUBJECT,
  };

  beforeEach(() => {
    sendNotification.mockReset();
    setVapidDetails.mockReset();
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = original.pub;
    process.env.VAPID_PRIVATE_KEY = original.priv;
    process.env.VAPID_SUBJECT = original.subj;
  });

  it("no-ops with status 'skipped' when VAPID env is unset", async () => {
    delete process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
    delete process.env.VAPID_SUBJECT;
    const { sendWebPush, isWebPushConfigured } = await importFresh();

    expect(isWebPushConfigured()).toBe(false);
    const res = await sendWebPush(SUB, PAYLOAD);
    expect(res.status).toBe("skipped");
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it("sends and returns 'sent' when VAPID is configured", async () => {
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "pub";
    process.env.VAPID_PRIVATE_KEY = "priv";
    process.env.VAPID_SUBJECT = "mailto:ops@example.com";
    sendNotification.mockResolvedValueOnce(undefined);
    const { sendWebPush } = await importFresh();

    const res = await sendWebPush(SUB, PAYLOAD);
    expect(res.status).toBe("sent");
    expect(setVapidDetails).toHaveBeenCalledOnce();
    expect(sendNotification).toHaveBeenCalledOnce();
  });

  it.each([410, 404])("reports 'expired' on %i so the caller can prune", async (code) => {
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "pub";
    process.env.VAPID_PRIVATE_KEY = "priv";
    process.env.VAPID_SUBJECT = "mailto:ops@example.com";
    sendNotification.mockRejectedValueOnce(Object.assign(new Error("gone"), { statusCode: code }));
    const { sendWebPush } = await importFresh();

    const res = await sendWebPush(SUB, PAYLOAD);
    expect(res).toEqual({ status: "expired", statusCode: code });
  });

  it("returns 'error' (not expired) on other failures", async () => {
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "pub";
    process.env.VAPID_PRIVATE_KEY = "priv";
    process.env.VAPID_SUBJECT = "mailto:ops@example.com";
    sendNotification.mockRejectedValueOnce(Object.assign(new Error("boom"), { statusCode: 500 }));
    const { sendWebPush } = await importFresh();

    const res = await sendWebPush(SUB, PAYLOAD);
    expect(res.status).toBe("error");
    if (res.status === "error") expect(res.statusCode).toBe(500);
  });
});
