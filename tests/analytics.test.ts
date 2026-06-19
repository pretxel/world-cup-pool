import { afterEach, describe, expect, it, vi } from "vitest";
import { trackEvent } from "@/lib/analytics";

// The test env is `node`, so `window` is not defined by default. Each case
// installs/removes a `window` on `globalThis` to model the browser vs SSR/no-GA
// realities the helper guards against.
const g = globalThis as { window?: { gtag?: (...args: unknown[]) => void } };

afterEach(() => {
  delete g.window;
  vi.restoreAllMocks();
});

describe("trackEvent", () => {
  it("forwards to gtag with (\"event\", name, params) when gtag is present", () => {
    const gtag = vi.fn();
    g.window = { gtag };

    trackEvent("prediction_submitted", { match_id: "abc-123" });

    expect(gtag).toHaveBeenCalledTimes(1);
    expect(gtag).toHaveBeenCalledWith("event", "prediction_submitted", {
      match_id: "abc-123",
    });
  });

  it("forwards an event with no params", () => {
    const gtag = vi.fn();
    g.window = { gtag };

    trackEvent("leaderboard_viewed");

    expect(gtag).toHaveBeenCalledWith("event", "leaderboard_viewed", undefined);
  });

  it("is a no-op and does not throw during SSR (no window)", () => {
    expect(g.window).toBeUndefined();
    expect(() => trackEvent("group_joined")).not.toThrow();
  });

  it("is a no-op when window exists but gtag is absent", () => {
    g.window = {};
    expect(() => trackEvent("share_click", { platform: "x" })).not.toThrow();
  });

  it("is a no-op when window.gtag is not a function", () => {
    g.window = { gtag: undefined };
    expect(() => trackEvent("quiz_answered", { correct: true })).not.toThrow();
  });
});
