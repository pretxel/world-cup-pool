"use client";

import { Children, cloneElement, isValidElement, useId, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDownIcon, ChevronUpIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { FormSection } from "@/components/admin/form-section";
import { ActionStatus } from "@/components/admin/action-status";
import { SubmitButton } from "@/components/admin/submit-button";
import { SUPPORTED_LOCALES } from "@/lib/i18n";
import {
  formatConfigSchema,
  type CompetitionBranding,
  type CompetitionFormat,
  type CompetitionProviders,
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

const CHECKBOX_CLASS = "size-4 accent-primary";

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
  const t = useTranslations("admin");
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
    <form action={action} className="space-y-10">
      {initial?.id ? <input type="hidden" name="id" value={initial.id} /> : null}
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="format_config" value={formatJson} />

      <FormSection
        title={t("form.sectionIdentity")}
        description={t("form.sectionIdentityDesc")}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("form.slug")}>
            <Input
              name="slug"
              defaultValue={initial?.slug ?? ""}
              readOnly={slugLocked}
              aria-describedby={slugLocked ? "slug-locked" : undefined}
              required
              placeholder="champions-league-2027"
            />
            {slugLocked ? (
              <p id="slug-locked" className="text-xs text-muted-foreground">
                {t("form.slugLocked")}
              </p>
            ) : null}
          </Field>
          <Field label={t("form.kind")}>
            <Input name="kind" defaultValue={initial?.kind ?? "custom"} required />
          </Field>
          <Field label={t("form.name")}>
            <Input name="name" defaultValue={initial?.name ?? ""} required />
          </Field>
          <Field label={t("form.shortName")}>
            <Input
              name="short_name"
              defaultValue={initial?.short_name ?? ""}
              required
            />
          </Field>
          <Field label={t("form.season")}>
            <Input name="season" defaultValue={initial?.season ?? ""} />
          </Field>
        </div>
      </FormSection>

      <FormSection
        title={t("form.sectionDates")}
        description={t("form.sectionDatesDesc")}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("form.tournamentStart")}>
            <Input
              type="datetime-local"
              name="tournament_start_at"
              defaultValue={toLocalInput(initial?.tournament_start_at)}
              required
            />
          </Field>
          <Field label={t("form.openingHome")}>
            <Input name="opening_home" defaultValue={initial?.opening_home ?? ""} />
          </Field>
          <Field label={t("form.openingAway")}>
            <Input name="opening_away" defaultValue={initial?.opening_away ?? ""} />
          </Field>
          <Field label={t("form.openingVenue")}>
            <Input
              name="opening_venue"
              defaultValue={initial?.opening_venue ?? ""}
            />
          </Field>
        </div>
      </FormSection>

      <FormSection
        title={t("form.sectionFormat")}
        description={t("form.sectionFormatDesc")}
        action={
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setStages((p) => [...p, emptyStage()])}
          >
            <PlusIcon aria-hidden />
            {t("form.addStage")}
          </Button>
        }
      >
        <ul className="space-y-3">
          {stages.map((s, i) => (
            <li key={i} className="rounded-lg border border-border p-3">
              <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                <Field label={t("form.stageKey")}>
                  <Input
                    value={s.key}
                    onChange={(e) => patch(i, { key: e.target.value })}
                    placeholder="group / r16 / league"
                  />
                </Field>
                <Field label={t("form.stageKind")}>
                  <NativeSelect
                    value={s.kind}
                    onChange={(e) =>
                      patch(i, { kind: e.target.value as StageDraft["kind"] })
                    }
                  >
                    {STAGE_KINDS.map((k) => (
                      <option key={k} value={k}>
                        {t(`form.stageKind_${k}`)}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
                <div className="flex items-end gap-1">
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    aria-label={t("form.moveUp")}
                    disabled={i === 0}
                    onClick={() => move(i, -1)}
                  >
                    <ChevronUpIcon aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    aria-label={t("form.moveDown")}
                    disabled={i === stages.length - 1}
                    onClick={() => move(i, 1)}
                  >
                    <ChevronDownIcon aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    aria-label={t("form.removeStage")}
                    onClick={() => setStages((p) => p.filter((_, idx) => idx !== i))}
                  >
                    <Trash2Icon aria-hidden />
                  </Button>
                </div>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                {SUPPORTED_LOCALES.map((loc) => (
                  <Field key={loc} label={t("form.stageLabel", { locale: loc })}>
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
                <Field label={t("form.stageIcon")}>
                  <Input
                    value={s.icon}
                    onChange={(e) => patch(i, { icon: e.target.value })}
                    placeholder="group / final"
                  />
                </Field>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className={CHECKBOX_CLASS}
                    checked={s.hasGroupCode}
                    onChange={(e) => patch(i, { hasGroupCode: e.target.checked })}
                  />
                  {t("form.stageHasGroupCode")}
                </label>
              </div>
            </li>
          ))}
        </ul>

        <div className="rounded-lg border border-border p-3">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              className={CHECKBOX_CLASS}
              checked={groupsEnabled}
              onChange={(e) => setGroupsEnabled(e.target.checked)}
            />
            {t("form.groupsEnabled")}
          </label>
          {groupsEnabled ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label={t("form.groupPattern")}>
                <Input
                  value={groupPattern}
                  onChange={(e) => setGroupPattern(e.target.value)}
                />
              </Field>
              <Field label={t("form.groupCount")}>
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
          <ActionStatus variant="error">
            <ul className="space-y-1">
              {validation.error.issues.map((issue, idx) => (
                <li key={idx}>
                  {issue.path.join(".") || "format"}: {issue.message}
                </li>
              ))}
            </ul>
          </ActionStatus>
        ) : null}
      </FormSection>

      <FormSection
        title={t("form.sectionProviders")}
        description={t("form.sectionProvidersDesc")}
      >
        <ProvidersFields initial={initial?.providers} />
      </FormSection>

      <FormSection
        title={t("form.sectionBranding")}
        description={t("form.sectionBrandingDesc")}
      >
        <BrandingFields initial={initial?.branding} />
      </FormSection>

      <div className="flex gap-3">
        <SubmitButton
          disabled={!validation.success}
          pendingLabel={initial?.id ? t("form.saving") : t("form.creating")}
        >
          {initial?.id ? t("form.save") : t("form.create")}
        </SubmitButton>
      </div>
    </form>
  );
}

// Associates the label with the control it wraps: a generated id is set as the
// Label's `htmlFor` and cloned onto the first element child (the Input /
// NativeSelect), giving every field an accessible name. Extra children (e.g.
// the slug-locked helper <p>) are left untouched, and an explicit id on the
// control is preserved.
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const id = useId();
  const items = Children.toArray(children);
  const controlIndex = items.findIndex((child) => isValidElement(child));
  const labelled = items.map((child, i) =>
    i === controlIndex && isValidElement<{ id?: string }>(child)
      ? cloneElement(child, { id: child.props.id ?? id })
      : child,
  );
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      {labelled}
    </div>
  );
}

// Providers + branding assemble their own hidden JSON inputs from local state so
// the server action receives one parseable value per column.
function ProvidersFields({ initial }: { initial?: CompetitionProviders }) {
  const t = useTranslations("admin");
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
        <Field label={t("form.fdCode")}>
          <Input value={fdCode} onChange={(e) => setFdCode(e.target.value)} placeholder="WC" />
        </Field>
        <Field label={t("form.fdSeason")}>
          <Input value={fdSeason} onChange={(e) => setFdSeason(e.target.value)} placeholder="2026" />
        </Field>
        <Field label={t("form.espnPath")}>
          <Input value={espnPath} onChange={(e) => setEspnPath(e.target.value)} placeholder="fifa.world" />
        </Field>
      </div>
    </>
  );
}

function BrandingFields({ initial }: { initial?: CompetitionBranding }) {
  const t = useTranslations("admin");
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
        <Field label={t("form.brandCode")}>
          <Input value={brandCode} onChange={(e) => setBrandCode(e.target.value)} placeholder="WC26" />
        </Field>
        <Field label={t("form.joinCodePrefix")}>
          <Input value={joinCodePrefix} onChange={(e) => setJoinCodePrefix(e.target.value)} placeholder="WC" />
        </Field>
        <Field label={t("form.newsQuery")}>
          <Input value={newsQuery} onChange={(e) => setNewsQuery(e.target.value)} />
        </Field>
        <Field label={t("form.emailFromName")}>
          <Input value={emailFromName} onChange={(e) => setEmailFromName(e.target.value)} />
        </Field>
        <Field label={t("form.hosts")}>
          <Input value={hosts} onChange={(e) => setHosts(e.target.value)} />
        </Field>
      </div>
    </>
  );
}
