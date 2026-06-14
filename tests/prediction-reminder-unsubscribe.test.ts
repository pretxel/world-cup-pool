import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const updateMock = vi.fn();
const eqMock = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createAdminSupabaseClient: vi.fn(() => ({
    from: (table: string) => {
      if (table === "profiles") return { update: updateMock };
      throw new Error(`unexpected from(${table})`);
    },
  })),
}));

function req(url: string): NextRequest {
  return new NextRequest(url);
}

beforeEach(() => {
  eqMock.mockReset().mockResolvedValue({ error: null });
  updateMock.mockReset().mockImplementation(() => ({ eq: eqMock }));
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/prediction-reminders/unsubscribe", () => {
  const TOKEN = "11111111-2222-4333-8444-555555555555";

  it("opts the player out by token, touching only the prediction flag", async () => {
    const { GET } = await import("@/app/api/prediction-reminders/unsubscribe/route");
    const res = await GET(
      req(`http://localhost/api/prediction-reminders/unsubscribe?token=${TOKEN}`),
    );
    expect(res.status).toBe(200);
    expect(updateMock).toHaveBeenCalledWith({ prediction_reminder_opt_out: true });
    expect(eqMock).toHaveBeenCalledWith("unsubscribe_token", TOKEN);
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
});

describe("POST /api/prediction-reminders/unsubscribe", () => {
  const TOKEN = "11111111-2222-4333-8444-555555555555";

  it("opts the player out (RFC 8058 one-click)", async () => {
    const { POST } = await import("@/app/api/prediction-reminders/unsubscribe/route");
    const res = await POST(
      req(`http://localhost/api/prediction-reminders/unsubscribe?token=${TOKEN}`),
    );
    expect(res.status).toBe(200);
    expect(updateMock).toHaveBeenCalledWith({ prediction_reminder_opt_out: true });
    expect(eqMock).toHaveBeenCalledWith("unsubscribe_token", TOKEN);
  });
});
