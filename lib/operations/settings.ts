import "server-only";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { OPERATION_KINDS, type OperationKind } from "./record-run";

// Per-job cron kill switch, backed by public.operation_settings. An ABSENT row
// means enabled, so the reads below overlay stored rows onto an all-enabled
// default. Only cron routes consult these switches — manual "Run now" bypasses
// them by design (pausing stops the schedule, not the admin's hand).

// One settings row, as stored. `kind` is a plain string here because the read
// seam below returns raw rows; unknown kinds are ignored on overlay.
export interface OperationSettingRow {
  kind: string;
  enabled: boolean;
}

// Fetches all stored settings rows. Pulled out as a seam so tests can inject a
// fake without a database (same pattern as record-run's RunWriter). Throws on
// query failure; the readers below catch and fail OPEN.
export type SettingsReader = () => Promise<OperationSettingRow[]>;

const defaultReader: SettingsReader = async () => {
  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("operation_settings")
    .select("kind, enabled");
  if (error) throw new Error(error.message);
  return data ?? [];
};

// Enablement for every job kind: stored rows overlaid on an all-enabled
// default. Fails OPEN — if the read throws, every job is reported enabled and
// the failure is logged. A broken settings lookup must not silently halt all
// scheduled work; the switch is a convenience control, not a safety interlock.
export async function getOperationSettings(
  reader: SettingsReader = defaultReader,
): Promise<Record<OperationKind, boolean>> {
  const settings = Object.fromEntries(
    OPERATION_KINDS.map((kind) => [kind, true]),
  ) as Record<OperationKind, boolean>;
  try {
    for (const row of await reader()) {
      if ((OPERATION_KINDS as readonly string[]).includes(row.kind)) {
        settings[row.kind as OperationKind] = row.enabled;
      }
    }
  } catch (err) {
    console.error(
      "[operation-settings] read failed; treating all jobs as enabled:",
      err,
    );
  }
  return settings;
}

// Whether one job's cron should run. Same fail-open semantics as
// getOperationSettings (the table holds at most one row per kind, so reading
// all rows costs the same as a point lookup).
export async function isOperationEnabled(
  kind: OperationKind,
  reader: SettingsReader = defaultReader,
): Promise<boolean> {
  const settings = await getOperationSettings(reader);
  return settings[kind];
}

// Persists one switch (upsert: first toggle for a kind creates its row).
// Unlike the reads this THROWS on failure — a pause that didn't stick must
// surface to the admin, not pretend success.
export async function setOperationEnabled(
  kind: OperationKind,
  enabled: boolean,
): Promise<void> {
  const admin = createAdminSupabaseClient();
  const { error } = await admin
    .from("operation_settings")
    .upsert({ kind, enabled, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
}
