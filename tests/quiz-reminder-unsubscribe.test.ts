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

describe("GET /api/quiz-reminders/unsubscribe", () => {
  const TOKEN = "11111111-2222-4333-8444-555555555555";

  it("opts the user out by token", async () => {
    const { GET } = await import("@/app/api/quiz-reminders/unsubscribe/route");
    const res = await GET(req(`http://localhost/api/quiz-reminders/unsubscribe?token=${TOKEN}`));
    expect(res.status).toBe(200);
    expect(updateMock).toHaveBeenCalledWith({ quiz_reminder_opt_out: true });
    expect(eqMock).toHaveBeenCalledWith("unsubscribe_token", TOKEN);
  });

  it("is idempotent across repeated calls", async () => {
    const { GET } = await import("@/app/api/quiz-reminders/unsubscribe/route");
    const a = await GET(req(`http://localhost/api/quiz-reminders/unsubscribe?token=${TOKEN}`));
    const b = await GET(req(`http://localhost/api/quiz-reminders/unsubscribe?token=${TOKEN}`));
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(updateMock).toHaveBeenCalledTimes(2);
  });

  it("ignores a malformed (non-UUID) token without touching the DB", async () => {
    const { GET } = await import("@/app/api/quiz-reminders/unsubscribe/route");
    const res = await GET(req("http://localhost/api/quiz-reminders/unsubscribe?token=not-a-uuid"));
    expect(res.status).toBe(200);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("handles a missing token gracefully without touching the DB", async () => {
    const { GET } = await import("@/app/api/quiz-reminders/unsubscribe/route");
    const res = await GET(req("http://localhost/api/quiz-reminders/unsubscribe"));
    expect(res.status).toBe(200);
    expect(updateMock).not.toHaveBeenCalled();
  });
});

describe("POST /api/quiz-reminders/unsubscribe", () => {
  const TOKEN = "11111111-2222-4333-8444-555555555555";

  it("opts the user out (RFC 8058 one-click)", async () => {
    const { POST } = await import("@/app/api/quiz-reminders/unsubscribe/route");
    const res = await POST(req(`http://localhost/api/quiz-reminders/unsubscribe?token=${TOKEN}`));
    expect(res.status).toBe(200);
    expect(updateMock).toHaveBeenCalledWith({ quiz_reminder_opt_out: true });
    expect(eqMock).toHaveBeenCalledWith("unsubscribe_token", TOKEN);
  });
});
