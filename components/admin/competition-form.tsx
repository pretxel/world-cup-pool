"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SUPPORTED_LOCALES } from "@/lib/i18n";
import {
  formatConfigSchema,
  type CompetitionBranding,
  type CompetitionFormat,
  type CompetitionProviders,
  type StageConfig,
} from "@/lib/competition-schema";

const STAGE_KINDS = ["group", "knockout", "league"] as const;

type StageDraft = {
  key: string;
  kind: (typeof STAGE_KINDS)[number];
  icon: string;
  hasGroupCode: boolean;
  labels: Record<string, string>;
};

export type CompetitionFormInitial = {
  id?: string;
  slug?: string;
  kind?: string;
  name?: string;
  short_name?: string;
  season?: string;
  tournament_start_at?: string;
  tournament_end_at?: string;
  opening_home?: string;
  opening_away?: string;
  opening_venue?: string;
  format?: CompetitionFormat;
  providers?: CompetitionProviders;
  branding?: CompetitionBranding;
};

const SELECT_CLASS = "h-9 w-full rounded-md border px-3 text-sm";

function emptyStage(): StageDraft {
  return { key: "", kind: "knockout", icon: "", hasGroupCode: false, labels: {} };
}

function toDrafts(format?: CompetitionFormat): StageDraft[] {
  if (!format) return [emptyStage()];
  return [...format.stages]
    .sort((a, b) => a.order - b.order)
    .map((s) => ({
      key: s.key,
      kind: s.kind,
      icon: s.icon ?? "",
      hasGroupCode: s.hasGroupCode ?? false,
      labels: { ...s.labels },
    }));
}

// `datetime-local` wants "YYYY-MM-DDTHH:mm"; trim a stored ISO down to that.
function toLocalInput(iso?: string): string {
  return iso ? iso.slice(0, 16) : "";
}

export function CompetitionForm({
  action,
  locale,
  initial,
  slugLocked = false,
}: {
  action: (formData: FormData) => void | Promise<void>;
  locale: string;
  initial?: CompetitionFormInitial;
  slugLocked?: boolean;
}) {
  const [stages, setStages] = useState<StageDraft[]>(toDrafts(initial?.format));
  const [groupsEnabled, setGroupsEnabled] = useState<boolean>(
    initial?.format?.groups.enabled ?? false,
  );
  const [groupPattern, setGroupPattern] = useState<string>(
    initial?.format?.groups.enabled ? initial.format.groups.pattern : "^[A-H]$",
  );
  const [groupCount, setGroupCount] = useState<number>(
    initial?.format?.groups.enabled ? initial.format.groups.count : 8,
  );

  function patch(i: number, next: Partial<StageDraft>) {
    setStages((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...next } : s)));
  }
  function move(i: number, dir: -1 | 1) {
    setStages((prev) => {
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  // Build the format_config object (order derived from position) and validate
  // it live so the admin sees errors before submitting.
  const formatObject = useMemo(
    () => ({
      stages: stages.map((s, i) => ({
        key: s.key,
        kind: s.kind,
        order: i + 1,
        icon: s.icon || undefined,
        hasGroupCode: s.hasGroupCode,
        labels: s.labels,
      })),
      groups: groupsEnabled
        ? { enabled: true as const, pattern: groupPattern, count: groupCount }
        : { enabled: false as const },
    }),
    [stages, groupsEnabled, groupPattern, groupCount],
  );

  const validation = formatConfigSchema.safeParse(formatObject);
  const formatJson = JSON.stringify(formatObject);

  return (
    <form action={action} className="space-y-8">
      {initial?.id ? <input type="hidden" name="id" value={initial.id} /> : null}
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="format_config" value={formatJson} />

      {/* Identity */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Identity
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Slug (kebab-case)">
            <Input
              name="slug"
              defaultValue={initial?.slug ?? ""}
              readOnly={slugLocked}
              required
              placeholder="champions-league-2027"
            />
            {slugLocked ? (
              <p className="text-xs text-muted-foreground">
                Locked — this competition already has fixtures.
              </p>
            ) : null}
          </Field>
          <Field label="Kind">
            <Input name="kind" defaultValue={initial?.kind ?? "custom"} required />
          </Field>
          <Field label="Name">
            <Input name="name" defaultValue={initial?.name ?? ""} required />
          </Field>
          <Field label="Short name (brand tag)">
            <Input
              name="short_name"
              defaultValue={initial?.short_name ?? ""}
              required
            />
          </Field>
          <Field label="Season">
            <Input name="season" defaultValue={initial?.season ?? ""} />
          </Field>
          <Field label="Tournament start (UTC)">
            <Input
              type="datetime-local"
              name="tournament_start_at"
              defaultValue={toLocalInput(initial?.tournament_start_at)}
              required
            />
          </Field>
          <Field label="Opening home (fallback)">
            <Input name="opening_home" defaultValue={initial?.opening_home ?? ""} />
          </Field>
          <Field label="Opening away (fallback)">
            <Input name="opening_away" defaultValue={initial?.opening_away ?? ""} />
          </Field>
          <Field label="Opening venue (fallback)">
            <Input name="opening_venue" defaultValue={initial?.opening_venue ?? ""} />
          </Field>
        </div>
      </section>

      {/* Format */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Format — stages
          </h2>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setStages((p) => [...p, emptyStage()])}
          >
            Add stage
          </Button>
        </div>

        <ul className="space-y-3">
          {stages.map((s, i) => (
            <li key={i} className="rounded-md border p-3">
              <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                <Field label="Key">
                  <Input
                    value={s.key}
                    onChange={(e) => patch(i, { key: e.target.value })}
                    placeholder="group / r16 / league"
                  />
                </Field>
                <Field label="Kind">
                  <select
                    className={SELECT_CLASS}
                    value={s.kind}
                    onChange={(e) =>
                      patch(i, { kind: e.target.value as StageDraft["kind"] })
                    }
                  >
                    {STAGE_KINDS.map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </select>
                </Field>
                <div className="flex items-end gap-1">
                  <Button type="button" size="sm" variant="ghost" onClick={() => move(i, -1)}>
                    ↑
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => move(i, 1)}>
                    ↓
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setStages((p) => p.filter((_, idx) => idx !== i))}
                  >
                    ✕
                  </Button>
                </div>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                {SUPPORTED_LOCALES.map((loc) => (
                  <Field key={loc} label={`Label (${loc})`}>
                    <Input
                      value={s.labels[loc] ?? ""}
                      onChange={(e) =>
                        patch(i, { labels: { ...s.labels, [loc]: e.target.value } })
                      }
                    />
                  </Field>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-4">
                <Field label="Icon">
                  <Input
                    value={s.icon}
                    onChange={(e) => patch(i, { icon: e.target.value })}
                    placeholder="group / final"
                  />
                </Field>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={s.hasGroupCode}
                    onChange={(e) => patch(i, { hasGroupCode: e.target.checked })}
                  />
                  Has group code
                </label>
              </div>
            </li>
          ))}
        </ul>

        <div className="rounded-md border p-3">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={groupsEnabled}
              onChange={(e) => setGroupsEnabled(e.target.checked)}
            />
            Groups enabled
          </label>
          {groupsEnabled ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label="Group pattern (regex)">
                <Input
                  value={groupPattern}
                  onChange={(e) => setGroupPattern(e.target.value)}
                />
              </Field>
              <Field label="Group count">
                <Input
                  type="number"
                  min={1}
                  value={groupCount}
                  onChange={(e) => setGroupCount(Number(e.target.value))}
                />
              </Field>
            </div>
          ) : null}
        </div>

        {!validation.success ? (
          <ul className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            {validation.error.issues.map((issue, idx) => (
              <li key={idx}>
                {issue.path.join(".") || "format"}: {issue.message}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {/* Providers */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Providers
        </h2>
        <ProvidersFields initial={initial?.providers} />
      </section>

      {/* Branding */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Branding
        </h2>
        <BrandingFields initial={initial?.branding} />
      </section>

      <div className="flex gap-3">
        <Button type="submit" disabled={!validation.success}>
          {initial?.id ? "Save competition" : "Create competition"}
        </Button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

// Providers + branding assemble their own hidden JSON inputs from local state so
// the server action receives one parseable value per column.
function ProvidersFields({ initial }: { initial?: CompetitionProviders }) {
  const [fdCode, setFdCode] = useState(initial?.footballData?.code ?? "");
  const [fdSeason, setFdSeason] = useState(initial?.footballData?.season ?? "");
  const [espnPath, setEspnPath] = useState(initial?.espn?.leaguePath ?? "");

  const value = JSON.stringify({
    ...(fdCode
      ? { footballData: { code: fdCode, season: fdSeason || undefined } }
      : {}),
    ...(espnPath ? { espn: { leaguePath: espnPath } } : {}),
  });

  return (
    <>
      <input type="hidden" name="providers" value={value} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="football-data code">
          <Input value={fdCode} onChange={(e) => setFdCode(e.target.value)} placeholder="WC" />
        </Field>
        <Field label="football-data season">
          <Input value={fdSeason} onChange={(e) => setFdSeason(e.target.value)} placeholder="2026" />
        </Field>
        <Field label="ESPN league path">
          <Input value={espnPath} onChange={(e) => setEspnPath(e.target.value)} placeholder="fifa.world" />
        </Field>
      </div>
    </>
  );
}

function BrandingFields({ initial }: { initial?: CompetitionBranding }) {
  const [brandCode, setBrandCode] = useState(initial?.brandCode ?? "");
  const [joinCodePrefix, setJoinCodePrefix] = useState(initial?.joinCodePrefix ?? "");
  const [newsQuery, setNewsQuery] = useState(initial?.newsQuery ?? "");
  const [emailFromName, setEmailFromName] = useState(initial?.emailFromName ?? "");
  const [hosts, setHosts] = useState((initial?.hosts ?? []).join(", "));

  const value = JSON.stringify({
    ...(brandCode ? { brandCode } : {}),
    ...(joinCodePrefix ? { joinCodePrefix } : {}),
    ...(newsQuery ? { newsQuery } : {}),
    ...(emailFromName ? { emailFromName } : {}),
    ...(hosts.trim()
      ? { hosts: hosts.split(",").map((h) => h.trim()).filter(Boolean) }
      : {}),
  });

  return (
    <>
      <input type="hidden" name="branding" value={value} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Brand code">
          <Input value={brandCode} onChange={(e) => setBrandCode(e.target.value)} placeholder="WC26" />
        </Field>
        <Field label="Join-code prefix">
          <Input value={joinCodePrefix} onChange={(e) => setJoinCodePrefix(e.target.value)} placeholder="WC" />
        </Field>
        <Field label="News query">
          <Input value={newsQuery} onChange={(e) => setNewsQuery(e.target.value)} />
        </Field>
        <Field label="Email from name">
          <Input value={emailFromName} onChange={(e) => setEmailFromName(e.target.value)} />
        </Field>
        <Field label="Hosts (comma-separated)">
          <Input value={hosts} onChange={(e) => setHosts(e.target.value)} />
        </Field>
      </div>
    </>
  );
}
