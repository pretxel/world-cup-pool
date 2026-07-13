import { afterEach, describe, expect, it, vi } from "vitest";

// settings.ts pulls in the service-role admin client (→ lib/env), which throws
// at import when real env vars are absent. Every test here injects a fake
// reader, so the admin client is never actually constructed; this mock just
// lets the module graph import cleanly under the node test env.
vi.mock("@/lib/env", () => ({
  env: { supabaseUrl: "https://example.supabase.co" },
  requireServiceRoleKey: () => "service-role-key",
}));

import { OPERATION_KINDS } from "@/lib/operations/record-run";
import {
  getOperationSettings,
  isOperationEnabled,
  type SettingsReader,
} from "@/lib/operations/settings";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getOperationSettings", () => {
  it("defaults every kind to enabled when no rows exist", async () => {
    const reader: SettingsReader = async () => [];
    const settings = await getOperationSettings(reader);
    expect(Object.keys(settings).sort()).toEqual([...OPERATION_KINDS].sort());
    for (const kind of OPERATION_KINDS) {
      expect(settings[kind]).toBe(true);
    }
  });

  it("overlays stored rows onto the all-enabled default", async () => {
    const reader: SettingsReader = async () => [
      { kind: "sync_news", enabled: false },
      { kind: "sync_matches", enabled: true },
    ];
    const settings = await getOperationSettings(reader);
    expect(settings.sync_news).toBe(false);
    expect(settings.sync_matches).toBe(true);
    expect(settings.results_digest).toBe(true);
  });

  it("ignores rows for unknown kinds", async () => {
    const reader: SettingsReader = async () => [
      { kind: "not_a_job", enabled: false },
    ];
    const settings = await getOperationSettings(reader);
    for (const kind of OPERATION_KINDS) {
      expect(settings[kind]).toBe(true);
    }
  });

  it("fails open (all enabled) and logs when the read throws", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const reader: SettingsReader = async () => {
      throw new Error("connection refused");
    };
    const settings = await getOperationSettings(reader);
    for (const kind of OPERATION_KINDS) {
      expect(settings[kind]).toBe(true);
    }
    expect(error).toHaveBeenCalled();
  });
});

describe("isOperationEnabled", () => {
  it("is false for a kind stored as disabled", async () => {
    const reader: SettingsReader = async () => [
      { kind: "quiz_reminders", enabled: false },
    ];
    await expect(isOperationEnabled("quiz_reminders", reader)).resolves.toBe(
      false,
    );
  });

  it("is true for a kind with no stored row", async () => {
    const reader: SettingsReader = async () => [];
    await expect(isOperationEnabled("sync_matches", reader)).resolves.toBe(
      true,
    );
  });

  it("fails open when the read throws", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const reader: SettingsReader = async () => {
      throw new Error("boom");
    };
    await expect(isOperationEnabled("sync_news", reader)).resolves.toBe(true);
  });
});
