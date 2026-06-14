import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// record-run.ts pulls in the service-role admin client (→ lib/env), which
// throws at import when real env vars are absent. Every test here injects a
// fake writer, so the admin client is never actually constructed; this mock
// just lets the module graph import cleanly under the node test env.
vi.mock("@/lib/env", () => ({
  env: { supabaseUrl: "https://example.supabase.co" },
  requireServiceRoleKey: () => "service-role-key",
}));

import {
  deriveStatus,
  recordRun,
  type RunRecord,
  type RunWriter,
} from "@/lib/operations/record-run";

// ---------------------------------------------------------------------------
// deriveStatus — pure classifier
// ---------------------------------------------------------------------------

describe("deriveStatus", () => {
  it("is success when no failure counts are present", () => {
    expect(deriveStatus({ matched: 3, final: 1 })).toBe("success");
  });

  it("is success when failure counts are zero", () => {
    expect(deriveStatus({ errors: 0, failed: 0, emailed: 5 })).toBe("success");
  });

  it("is partial when `errors` is non-zero", () => {
    expect(deriveStatus({ matched: 3, errors: 2 })).toBe("partial");
  });

  it("is partial when `failed` is non-zero", () => {
    expect(deriveStatus({ emailed: 4, failed: 1, skipped: 0 })).toBe("partial");
  });

  it("ignores non-numeric failure values", () => {
    expect(deriveStatus({ errors: "nope" as unknown as number })).toBe("success");
  });
});

// ---------------------------------------------------------------------------
// recordRun — instrumentation wrapper
// ---------------------------------------------------------------------------

// A capturing fake writer that records the run and hands back a fixed id.
function captureWriter(): { writer: RunWriter; records: RunRecord[] } {
  const records: RunRecord[] = [];
  const writer: RunWriter = async (record) => {
    records.push(record);
    return "run-id";
  };
  return { writer, records };
}

describe("recordRun", () => {
  beforeEach(() => {
    // recordRun's writer-failure path logs to console.error; keep tests quiet.
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("records a success run and returns the job summary", async () => {
    const { writer, records } = captureWriter();
    const summary = { matched: 3, final: 1, errors: 0 };

    const result = await recordRun("sync_matches", "cron", async () => summary, writer);

    expect(result).toEqual({ summary, status: "success", runId: "run-id" });
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      kind: "sync_matches",
      trigger: "cron",
      status: "success",
      summary,
      error: null,
    });
    expect(records[0].durationMs).toBeGreaterThanOrEqual(0);
    expect(records[0].finishedAt.getTime()).toBeGreaterThanOrEqual(
      records[0].startedAt.getTime(),
    );
  });

  it("records a partial run when the summary reports failures", async () => {
    const { writer, records } = captureWriter();
    const summary = { emailed: 4, failed: 2, skipped: 0 };

    const result = await recordRun("quiz_reminders", "manual", async () => summary, writer);

    expect(result.status).toBe("partial");
    expect(records[0]).toMatchObject({ trigger: "manual", status: "partial", summary });
  });

  it("records an error run and re-throws the job's error", async () => {
    const { writer, records } = captureWriter();
    const boom = new Error("provider exploded");

    await expect(
      recordRun("sync_news", "cron", async () => {
        throw boom;
      }, writer),
    ).rejects.toThrow("provider exploded");

    // The failure is still recorded for observability.
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      kind: "sync_news",
      status: "error",
      error: "provider exploded",
      summary: {},
    });
  });

  it("does not let a ledger-write failure mask a successful job", async () => {
    const failingWriter: RunWriter = async () => {
      throw new Error("insert failed");
    };
    const summary = { inserted: 2, errors: 0 };

    const result = await recordRun("sync_news", "cron", async () => summary, failingWriter);

    // Job result is preserved; the un-writable row just yields a null id.
    expect(result).toEqual({ summary, status: "success", runId: null });
  });

  it("re-throws the job error even when the ledger write also fails", async () => {
    const failingWriter: RunWriter = async () => {
      throw new Error("insert failed");
    };

    await expect(
      recordRun("prediction_reminders", "cron", async () => {
        throw new Error("dispatch failed");
      }, failingWriter),
    ).rejects.toThrow("dispatch failed");
  });
});
