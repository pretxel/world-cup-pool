import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const updateMock = vi.fn();
const updateEqMock = vi.fn();
const maybeSingleMock = vi.fn();

// The route reads the current email_prefs by token, then writes both the legacy
// boolean and the merged email_prefs. Mock both the read and the write chains.
vi.mock("@/lib/supabase/admin", () => ({
  createAdminSupabaseClient: vi.fn(() => ({
    from: (table: string) => {
      if (table === "profiles") {
        return {
          select: () => ({ eq: () => ({ maybeSingle: maybeSingleMock }) }),
          update: updateMock,
        };
      }
      throw new Error(`unexpected from(${table})`);
    },
  })),
}));

function req(url: string): NextRequest {
  return new NextRequest(url);
}

beforeEach(() => {
  updateEqMock.mockReset().mockResolvedValue({ error: null });
  updateMock.mockReset().mockImplementation(() => ({ eq: updateEqMock }));
  // A profile exists with all-on prefs by default.
  maybeSingleMock.mockReset().mockResolvedValue({
    data: { email_prefs: { prediction_reminder: true, result: true, quiz_reminder: true } },
    error: null,
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/prediction-reminders/unsubscribe", () => {
  const TOKEN = "11111111-2222-4333-8444-555555555555";

  it("opts the player out, setting the prediction flag and email_prefs key", async () => {
    const { GET } = await import("@/app/api/prediction-reminders/unsubscribe/route");
    const res = await GET(
      req(`http://localhost/api/prediction-reminders/unsubscribe?token=${TOKEN}`),
    );
    expect(res.status).toBe(200);
    expect(updateMock).toHaveBeenCalledWith({
      prediction_reminder_opt_out: true,
      email_prefs: {
        prediction_reminder: false,
        result: true,
        quiz_reminder: true,
        results_digest: true,
        recap_digest: true,
        comeback: true,
        push: true,
      },
    });
    expect(updateEqMock).toHaveBeenCalledWith("unsubscribe_token", TOKEN);
  });

  it("leaves the other email_prefs keys untouched", async () => {
    maybeSingleMock.mockResolvedValue({
      data: { email_prefs: { prediction_reminder: true, result: false, quiz_reminder: false } },
      error: null,
    });
    const { GET } = await import("@/app/api/prediction-reminders/unsubscribe/route");
    await GET(req(`http://localhost/api/prediction-reminders/unsubscribe?token=${TOKEN}`));
    expect(updateMock).toHaveBeenCalledWith({
      prediction_reminder_opt_out: true,
      email_prefs: {
        prediction_reminder: false,
        result: false,
        quiz_reminder: false,
        results_digest: true,
        recap_digest: true,
        comeback: true,
        push: true,
      },
    });
  });

  it("is idempotent across repeated calls", async () => {
    const { GET } = await import("@/app/api/prediction-reminders/unsubscribe/route");
    const a = await GET(req(`http://localhost/api/prediction-reminders/unsubscribe?token=${TOKEN}`));
    const b = await GET(req(`http://localhost/api/prediction-reminders/unsubscribe?token=${TOKEN}`));
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(updateMock).toHaveBeenCalledTimes(2);
  });

  it("ignores a malformed (non-UUID) token without touching the DB", async () => {
    const { GET } = await import("@/app/api/prediction-reminders/unsubscribe/route");
    const res = await GET(
      req("http://localhost/api/prediction-reminders/unsubscribe?token=not-a-uuid"),
    );
    expect(res.status).toBe(200);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("handles a missing token gracefully without touching the DB", async () => {
    const { GET } = await import("@/app/api/prediction-reminders/unsubscribe/route");
    const res = await GET(req("http://localhost/api/prediction-reminders/unsubscribe"));
    expect(res.status).toBe(200);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("no-ops when no profile matches the token", async () => {
    maybeSingleMock.mockResolvedValue({ data: null, error: null });
    const { GET } = await import("@/app/api/prediction-reminders/unsubscribe/route");
    const res = await GET(
      req(`http://localhost/api/prediction-reminders/unsubscribe?token=${TOKEN}`),
    );
    expect(res.status).toBe(200);
    expect(updateMock).not.toHaveBeenCalled();
  });
});

describe("POST /api/prediction-reminders/unsubscribe", () => {
  const TOKEN = "11111111-2222-4333-8444-555555555555";

  it("opts the player out (RFC 8058 one-click)", async () => {
    const { POST } = await import("@/app/api/prediction-reminders/unsubscribe/route");
    const res = await POST(
      req(`http://localhost/api/prediction-reminders/unsubscribe?token=${TOKEN}`),
    );
    expect(res.status).toBe(200);
    expect(updateMock).toHaveBeenCalledWith({
      prediction_reminder_opt_out: true,
      email_prefs: {
        prediction_reminder: false,
        result: true,
        quiz_reminder: true,
        results_digest: true,
        recap_digest: true,
        comeback: true,
        push: true,
      },
    });
    expect(updateEqMock).toHaveBeenCalledWith("unsubscribe_token", TOKEN);
  });
});
