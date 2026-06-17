import { notFound } from "next/navigation";
import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import {
  ArrowLeftIcon,
  CalendarClockIcon,
  MapPinIcon,
  SparklesIcon,
} from "lucide-react";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { LocalTime } from "@/components/local-time";
import { TeamFlag } from "@/components/team-flag";
import { VenueImage } from "@/components/venue-image";
import { MatchStateBadge } from "@/components/match-state-badge";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { FormSection } from "@/components/admin/form-section";
import { EmptyState } from "@/components/admin/empty-state";
import { ActionStatus } from "@/components/admin/action-status";
import { LiveRegion } from "@/components/admin/live-region";
import { SubmitButton } from "@/components/admin/submit-button";
import { ResendResultEmailsButton } from "@/components/admin/resend-emails-button";
import { SummarizeMatchButton } from "@/components/admin/summarize-match-button";
import {
  RegenerateSummaryForm,
  type RegenerateLabels,
} from "@/components/admin/regenerate-summary-form";
import {
  regenerateMatchSummary,
  setActiveSummaryVersion,
  deleteSummaryVersion,
  generateMatchImagePromptAction,
  renderMatchImageAction,
  syncMatchImageRenderAction,
  generateAndRenderImageAction,
  saveFixtureDetail,
  setMatchResultDetail,
  forceRecomputeDetail,
  deleteMatchDetail,
} from "../actions";
import { getManagedCompetition } from "@/lib/admin/managed-competition";
import {
  getStageLabel,
  hasGroupStage,
  sortedStages,
} from "@/lib/competition-schema";
import { isLocale, localePath, DEFAULT_LOCALE, type Locale } from "@/lib/i18n";

type BadgeStatus = "scheduled" | "live" | "final" | "cancelled";

// Map a generator/action outcome code (carried back via query params) to its
// `admin.detail` message key + panel variant. Only one outcome renders per load.
const OUTCOME: Record<string, { key: string; variant: "success" | "error" | "info" }> = {
  generated: { key: "outcomeGenerated", variant: "success" },
  "no-events": { key: "outcomeNoEvents", variant: "info" },
  "not-final": { key: "outcomeNotFinal", variant: "info" },
  "no-key": { key: "outcomeNoKey", variant: "info" },
  missing: { key: "outcomeError", variant: "error" },
  error: { key: "outcomeError", variant: "error" },
  activated: { key: "outcomeActivated", variant: "success" },
  deleted: { key: "outcomeDeleted", variant: "success" },
  "active-blocked": { key: "outcomeActiveBlocked", variant: "error" },
};

// Map a one-shot summarize reason (carried back via `summaryReason`) to its
// top-level `admin` message key, shared with the relocated Summarize control.
const SUMMARY_REASON_KEY: Record<string, string> = {
  generated: "summaryDoneGenerated",
  exists: "summaryDoneExists",
  "no-events": "summaryDoneNoEvents",
  "not-final": "summaryDoneNotFinal",
  "no-key": "summaryDoneNoKey",
  missing: "summaryDoneError",
  error: "summaryDoneError",
};

function summaryVariant(reason: string): "success" | "error" | "info" {
  if (reason === "generated") return "success";
  if (reason === "error" || reason === "missing") return "error";
  return "info";
}

type Outcome = { message: string; variant: "success" | "error" | "info" };

// Resolve the single inline outcome for this page load. Each per-match action
// redirects back with its own query-param family (recap, edit, result,
// recompute, resend, summarize); only one is present per navigation.
function resolveOutcome(
  sp: { [k: string]: string | string[] | undefined },
  t: (key: string, values?: Record<string, string | number>) => string,
): Outcome | null {
  // Recap actions share a code -> message map.
  for (const k of ["regenResult", "activateResult", "deleteResult"]) {
    const v = sp[k];
    if (typeof v === "string" && v.length > 0) {
      const o = OUTCOME[v];
      if (o) return { message: t(`detail.${o.key}`), variant: o.variant };
    }
  }
  // Image-prompt generation carries its own code family + dedicated messages.
  const imagePrompt = sp.imagePromptResult;
  if (typeof imagePrompt === "string" && imagePrompt.length > 0) {
    if (imagePrompt === "generated")
      return { message: t("detail.outcomeImagePromptGenerated"), variant: "success" };
    if (imagePrompt === "no-key")
      return { message: t("detail.outcomeImagePromptNoKey"), variant: "info" };
    return { message: t("detail.outcomeImagePromptError"), variant: "error" };
  }
  // Image render request + poll-sync carry their own code families.
  const render = sp.renderResult;
  if (typeof render === "string" && render.length > 0) {
    if (render === "requested")
      return { message: t("detail.outcomeRenderRequested"), variant: "success" };
    if (render === "no-key")
      return { message: t("detail.outcomeRenderNoKey"), variant: "info" };
    if (render === "no-prompt")
      return { message: t("detail.outcomeRenderNoPrompt"), variant: "info" };
    return { message: t("detail.outcomeRenderError"), variant: "error" };
  }
  const syncRender = sp.syncRenderResult;
  if (typeof syncRender === "string" && syncRender.length > 0) {
    if (syncRender === "synced")
      return { message: t("detail.outcomeSyncSynced"), variant: "success" };
    if (syncRender === "pending")
      return { message: t("detail.outcomeSyncPending"), variant: "info" };
    if (syncRender === "already-complete")
      return { message: t("detail.outcomeSyncAlreadyComplete"), variant: "info" };
    if (syncRender === "no-key")
      return { message: t("detail.outcomeRenderNoKey"), variant: "info" };
    return { message: t("detail.outcomeRenderError"), variant: "error" };
  }
  // One-click generate-prompt-and-render combined outcome.
  const combo = sp.comboResult;
  if (typeof combo === "string" && combo.length > 0) {
    if (combo === "rendered")
      return { message: t("detail.outcomeComboRendered"), variant: "success" };
    if (combo === "prompt-only")
      return { message: t("detail.outcomeComboPromptOnly"), variant: "info" };
    if (combo === "no-key")
      return { message: t("detail.outcomeImagePromptNoKey"), variant: "info" };
    return { message: t("detail.outcomeComboError"), variant: "error" };
  }
  const edit = sp.editResult;
  if (typeof edit === "string" && edit.length > 0) {
    return edit === "saved"
      ? { message: t("detail.outcomeFixtureSaved"), variant: "success" }
      : { message: t("detail.outcomeFixtureInvalid"), variant: "error" };
  }
  const result = sp.resultResult;
  if (typeof result === "string" && result.length > 0) {
    return result === "saved"
      ? { message: t("detail.outcomeResultSaved"), variant: "success" }
      : { message: t("detail.outcomeResultInvalid"), variant: "error" };
  }
  const recompute = sp.recomputeResult;
  if (typeof recompute === "string" && recompute.length > 0) {
    return recompute === "recomputed"
      ? { message: t("detail.outcomeRecomputed"), variant: "success" }
      : { message: t("detail.outcomeRecomputeError"), variant: "error" };
  }
  const resendId = sp.resendMatchId;
  if (typeof resendId === "string" && resendId.length > 0) {
    if (sp.resendError === "notFinal") {
      return { message: t("resendNotFinal"), variant: "error" };
    }
    const n = (key: string) => {
      const raw = sp[key];
      const x = typeof raw === "string" ? Number(raw) : NaN;
      return Number.isInteger(x) && x >= 0 ? x : 0;
    };
    return {
      message: t("resendSummary", {
        emailed: n("resendEmailed"),
        failed: n("resendFailed"),
        skipped: n("resendSkipped"),
      }),
      variant: "success",
    };
  }
  const reason = sp.summaryReason;
  if (typeof reason === "string" && reason.length > 0) {
    return {
      message: t(SUMMARY_REASON_KEY[reason] ?? "summaryDoneError"),
      variant: summaryVariant(reason),
    };
  }
  return null;
}

function formatMinute(minute: number | null, extra: number | null): string {
  if (minute == null) return "—";
  return extra != null && extra > 0 ? `${minute}+${extra}'` : `${minute}'`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; matchId: string }>;
}) {
  const { locale, matchId } = await params;
  const t = await getTranslations({ locale, namespace: "admin" });
  const admin = createAdminSupabaseClient();
  const { data: match } = await admin
    .from("matches")
    .select("home_team, away_team")
    .eq("id", matchId)
    .maybeSingle();
  const title = match ? `${match.home_team} vs ${match.away_team}` : t("title");
  return { title };
}

export default async function AdminMatchDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; matchId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { locale: raw, matchId } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  setRequestLocale(locale);

  const t = await getTranslations("admin");
  const tFeed = await getTranslations("liveFeed");

  const managed = await getManagedCompetition();
  if (!managed) notFound();

  // Service-role reads: the page must see every recap version (drafts are hidden
  // from public reads by RLS). The match query is scoped to the managed
  // competition, doubling as the membership fence — an out-of-scope id 404s.
  const admin = createAdminSupabaseClient();
  const { data: match } = await admin
    .from("matches")
    .select("*")
    .eq("id", matchId)
    .eq("competition_id", managed.id)
    .maybeSingle();
  if (!match) notFound();

  const [{ data: eventRows }, { data: versionRows }, { data: renderRows }] =
    await Promise.all([
      admin
        .from("match_events")
        .select("id, type, team, minute, extra_minute, player, detail, sequence")
        .eq("match_id", matchId)
        .order("sequence", { ascending: true }),
      admin
        .from("match_summaries")
        .select(
          "id, content, style_key, style_instruction, model, generated_at, is_active, image_prompt",
        )
        .eq("match_id", matchId)
        .order("generated_at", { ascending: false }),
      admin
        .from("match_summary_images")
        .select("summary_id, status, storage_path, error")
        .eq("match_id", matchId),
    ]);
  const events = eventRows ?? [];
  const versions = versionRows ?? [];
  // Render state keyed by recap-version id (one render row per version).
  const renders = new Map((renderRows ?? []).map((r) => [r.summary_id, r]));

  const sp = await searchParams;
  const outcome = resolveOutcome(sp, t);
  const outcomeAnnounce =
    outcome && outcome.variant !== "error" ? outcome.message : undefined;
  const outcomeAlert = outcome?.variant === "error" ? outcome.message : undefined;

  const status = match.status as BadgeStatus;
  const stageLabel = getStageLabel(managed.format, match.stage, locale);
  const stageOptions = sortedStages(managed.format).map((s) => ({
    value: s.key,
    label: getStageLabel(managed.format, s.key, locale),
  }));
  const showGroupCode = hasGroupStage(managed.format);
  const isFinal =
    match.status === "final" && match.home_score != null && match.away_score != null;

  // Regenerate preconditions: a recap is only ever generated for a final match
  // that has event data, and only when the generator key is configured. Disable
  // the form (with the most relevant reason) when any precondition fails.
  const hasEvents = events.length > 0;
  const hasKey = Boolean(env.openrouterApiKey);
  const hasLeonardoKey = Boolean(env.leonardoApiKey);
  // Build the browser-facing public URL for a stored render. Use the PUBLIC
  // Supabase origin (server env.supabaseUrl may be an in-network host).
  const publicBase = process.env.NEXT_PUBLIC_SUPABASE_URL ?? env.supabaseUrl;
  const renderImageUrl = (path: string) =>
    `${publicBase}/storage/v1/object/public/match-recap-images/${path}`;
  const regenDisabled = match.status !== "final" || !hasEvents || !hasKey;
  const regenNotice =
    match.status !== "final"
      ? t("detail.regenerateDisabledNotFinal")
      : !hasKey
        ? t("detail.regenerateDisabledNoKey")
        : t("detail.regenerateDisabledNoEvents");

  const styleLabel = (key: string) => {
    const map: Record<string, string> = {
      neutral: t("detail.styleNeutral"),
      dramatic: t("detail.styleDramatic"),
      tactical: t("detail.styleTactical"),
      concise: t("detail.styleConcise"),
      custom: t("detail.styleCustom"),
    };
    return map[key] ?? key;
  };

  const regenLabels: RegenerateLabels = {
    styleLegend: t("detail.styleLegend"),
    presets: {
      neutral: t("detail.styleNeutral"),
      dramatic: t("detail.styleDramatic"),
      tactical: t("detail.styleTactical"),
      concise: t("detail.styleConcise"),
    },
    custom: t("detail.styleCustom"),
    customPlaceholder: t("detail.customPlaceholder"),
    submit: t("detail.regenerate"),
    pending: t("detail.regeneratePending"),
  };

  const teamLabel = (team: string | null) =>
    team === "home" ? match.home_team : team === "away" ? match.away_team : "—";

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <LiveRegion status={outcomeAnnounce} alert={outcomeAlert} />
      <div className="admin-reveal space-y-8">
        <Link
          href={localePath(locale, "/admin/matches")}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeftIcon className="size-3.5" />
          {t("detail.back")}
        </Link>

        <AdminPageHeader
          eyebrow={managed.name}
          title={
            <span className="flex flex-wrap items-center gap-2">
              {match.home_team}
              <span className="text-muted-foreground">{t("versus")}</span>
              {match.away_team}
              {isFinal ? (
                <span className="font-mono tabular-nums text-muted-foreground">
                  ({match.home_score}–{match.away_score})
                </span>
              ) : null}
            </span>
          }
          description={
            <span className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">
                {stageLabel}
                {match.group_code ? ` · ${match.group_code}` : ""}
              </Badge>
              <MatchStateBadge status={status} size="sm" />
            </span>
          }
        />

        {/* Outcome of the last per-match action (edit, result, recompute,
            resend, summarize, recap). One renders per load. */}
        {outcome ? (
          <ActionStatus variant={outcome.variant} live={false}>
            {outcome.message}
          </ActionStatus>
        ) : null}

        {/* Fixture info */}
        <Card className="overflow-hidden p-0">
          <div className="relative">
            <VenueImage venue={match.venue} className="opacity-20" />
            <div className="relative grid gap-3 p-5 sm:grid-cols-3">
              <FixtureTeam label={t("homeTeam")} team={match.home_team} />
              <div className="grid place-items-center">
                {isFinal ? (
                  <div className="font-mono text-3xl font-semibold tabular-nums">
                    {match.home_score}
                    <span className="px-1 text-muted-foreground">–</span>
                    {match.away_score}
                  </div>
                ) : (
                  <span className="font-heading text-2xl text-muted-foreground">—</span>
                )}
              </div>
              <FixtureTeam label={t("awayTeam")} team={match.away_team} align="end" />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border px-5 py-3 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <CalendarClockIcon className="size-3.5" aria-hidden />
              <LocalTime iso={match.kickoff_at} />
            </span>
            {match.venue ? (
              <span className="flex items-center gap-1.5">
                <MapPinIcon className="size-3.5" aria-hidden />
                {match.venue}
              </span>
            ) : null}
          </div>
        </Card>

        {/* Edit fixture */}
        <Card className="p-5">
          <FormSection title={t("editFixture")}>
            <form
              action={saveFixtureDetail}
              className="grid grid-cols-1 gap-3 sm:grid-cols-2"
            >
              <input type="hidden" name="id" value={match.id} />
              <input type="hidden" name="locale" value={locale} />
              <div className="space-y-1.5">
                <Label htmlFor="stage">{t("stage")}</Label>
                <NativeSelect id="stage" name="stage" defaultValue={match.stage}>
                  {stageOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              {showGroupCode ? (
                <div className="space-y-1.5">
                  <Label htmlFor="group_code">{t("groupCode")}</Label>
                  <Input
                    id="group_code"
                    name="group_code"
                    maxLength={1}
                    defaultValue={match.group_code ?? ""}
                  />
                </div>
              ) : null}
              <div className="space-y-1.5">
                <Label htmlFor="home_team">{t("homeTeam")}</Label>
                <Input
                  id="home_team"
                  name="home_team"
                  defaultValue={match.home_team}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="away_team">{t("awayTeam")}</Label>
                <Input
                  id="away_team"
                  name="away_team"
                  defaultValue={match.away_team}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="kickoff_at">{t("kickoff")}</Label>
                <Input
                  id="kickoff_at"
                  name="kickoff_at"
                  type="datetime-local"
                  step="60"
                  defaultValue={match.kickoff_at.slice(0, 16)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="venue">{t("venue")}</Label>
                <Input id="venue" name="venue" defaultValue={match.venue ?? ""} />
              </div>
              <div className="sm:col-span-2">
                <SubmitButton size="sm">{t("saveEdit")}</SubmitButton>
              </div>
            </form>
          </FormSection>
        </Card>

        {/* Result entry */}
        <Card className="p-5">
          <FormSection title={t("result")}>
            <form action={setMatchResultDetail} className="space-y-3">
              <input type="hidden" name="match_id" value={match.id} />
              <input type="hidden" name="locale" value={locale} />
              <div className="flex items-end gap-2">
                <div className="min-w-0 flex-1">
                  <Label htmlFor="home_score" className="block truncate text-xs">
                    {match.home_team}
                  </Label>
                  <Input
                    id="home_score"
                    name="home_score"
                    type="number"
                    min={0}
                    max={30}
                    defaultValue={match.home_score ?? ""}
                    className="tabular-nums"
                  />
                </div>
                <span className="pb-2 text-muted-foreground">–</span>
                <div className="min-w-0 flex-1">
                  <Label htmlFor="away_score" className="block truncate text-xs">
                    {match.away_team}
                  </Label>
                  <Input
                    id="away_score"
                    name="away_score"
                    type="number"
                    min={0}
                    max={30}
                    defaultValue={match.away_score ?? ""}
                    className="tabular-nums"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="status" className="text-xs">
                  {t("status")}
                </Label>
                <NativeSelect id="status" name="status" defaultValue={match.status}>
                  <option value="scheduled">{t("statusScheduled")}</option>
                  <option value="live">{t("statusLive")}</option>
                  <option value="final">{t("statusFinal")}</option>
                  <option value="cancelled">{t("statusCancelled")}</option>
                </NativeSelect>
              </div>
              <SubmitButton size="sm">{t("saveResult")}</SubmitButton>
            </form>
          </FormSection>
        </Card>

        {/* Maintenance */}
        <Card className="p-5">
          <FormSection title={t("detail.maintenanceSection")}>
            <div className="flex flex-wrap items-center gap-1.5">
              <form action={forceRecomputeDetail}>
                <input type="hidden" name="match_id" value={match.id} />
                <input type="hidden" name="locale" value={locale} />
                <SubmitButton size="sm" variant="ghost">
                  {t("forceRecompute")}
                </SubmitButton>
              </form>
              {match.status === "final" ? (
                <ResendResultEmailsButton
                  matchId={match.id}
                  locale={locale}
                  label={t("resendEmails")}
                  confirmText={t("resendConfirm")}
                />
              ) : null}
              <form
                action={deleteMatchDetail}
                className="ml-auto border-l border-border pl-1.5"
              >
                <input type="hidden" name="id" value={match.id} />
                <input type="hidden" name="locale" value={locale} />
                <SubmitButton
                  size="sm"
                  variant="destructive"
                  confirmText={t("deleteFixtureConfirm")}
                >
                  {t("deleteFixture")}
                </SubmitButton>
              </form>
            </div>
          </FormSection>
        </Card>

        {/* Event timeline */}
        <section className="space-y-3">
          <h2 className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {t("detail.eventsSection")}
          </h2>
          {events.length === 0 ? (
            <EmptyState
              icon={<CalendarClockIcon />}
              title={t("detail.eventsEmpty")}
            />
          ) : (
            <ul className="overflow-hidden rounded-xl border border-border">
              {events.map((e) => (
                <li
                  key={e.id}
                  className="flex items-baseline gap-3 border-b border-border px-4 py-2 text-sm last:border-b-0 even:bg-muted/20"
                >
                  <span className="w-10 shrink-0 font-mono tabular-nums text-muted-foreground">
                    {formatMinute(e.minute, e.extra_minute)}
                  </span>
                  <span className="font-medium">
                    {tFeed(`eventTypes.${e.type}`)}
                  </span>
                  {e.team ? (
                    <span className="text-muted-foreground">{teamLabel(e.team)}</span>
                  ) : null}
                  {e.player ? <span>· {e.player}</span> : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Recap versions */}
        <section className="space-y-3">
          <h2 className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {t("detail.recapSection")}
          </h2>

          {versions.length === 0 ? (
            <div className="space-y-3">
              <EmptyState icon={<SparklesIcon />} title={t("detail.recapEmpty")} />
              {match.status === "final" ? (
                <SummarizeMatchButton
                  matchId={match.id}
                  locale={locale}
                  label={t("summarize")}
                  pendingLabel={t("summarizePending")}
                />
              ) : null}
            </div>
          ) : (
            <ul className="space-y-3">
              {versions.map((v) => {
                const render = renders.get(v.id) ?? null;
                return (
                <li
                  key={v.id}
                  className="space-y-3 rounded-xl border border-border bg-card p-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    {v.is_active ? (
                      <Badge className="gap-1">
                        <SparklesIcon className="size-3" aria-hidden />
                        {t("detail.versionActive")}
                      </Badge>
                    ) : (
                      <Badge variant="secondary">{t("detail.versionDraft")}</Badge>
                    )}
                    <Badge variant="outline">
                      {t("detail.versionStyle")}: {styleLabel(v.style_key)}
                    </Badge>
                  </div>

                  <p className="text-sm leading-relaxed text-foreground/90">
                    {v.content}
                  </p>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                    <span>
                      {t("detail.versionModel")}: {v.model}
                    </span>
                    <span>
                      {t("detail.versionGenerated")}:{" "}
                      <LocalTime iso={v.generated_at} />
                    </span>
                  </div>

                  {v.image_prompt ? (
                    <details className="rounded-lg border border-border bg-muted/20 p-3">
                      <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                        {t("detail.imagePromptLabel")}
                      </summary>
                      <pre className="mt-2 whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-foreground/80">
                        {v.image_prompt}
                      </pre>
                    </details>
                  ) : null}

                  <div className="flex flex-wrap items-center gap-1.5 border-t border-border pt-3">
                    <form action={generateMatchImagePromptAction}>
                      <input type="hidden" name="summary_id" value={v.id} />
                      <input type="hidden" name="match_id" value={match.id} />
                      <input type="hidden" name="locale" value={locale} />
                      <SubmitButton
                        size="sm"
                        variant="secondary"
                        disabled={!hasKey}
                        pendingLabel={t("detail.generateImagePromptPending")}
                      >
                        {v.image_prompt
                          ? t("detail.regenerateImagePrompt")
                          : t("detail.generateImagePrompt")}
                      </SubmitButton>
                    </form>
                  </div>

                  <div className="space-y-2 border-t border-border pt-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                        {t("detail.renderLabel")}
                      </span>
                      {render ? (
                        <Badge
                          variant={
                            render.status === "complete"
                              ? "default"
                              : render.status === "failed"
                                ? "destructive"
                                : "secondary"
                          }
                        >
                          {t(`detail.renderStatus_${render.status}`)}
                        </Badge>
                      ) : (
                        <Badge variant="outline">{t("detail.renderStatusNone")}</Badge>
                      )}
                    </div>

                    {render?.status === "complete" && render.storage_path ? (
                      <a
                        href={renderImageUrl(render.storage_path)}
                        target="_blank"
                        rel="noreferrer"
                        className="block w-fit"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={renderImageUrl(render.storage_path)}
                          alt={t("detail.renderLabel")}
                          className="max-h-80 w-auto rounded-lg border border-border"
                        />
                      </a>
                    ) : null}

                    {render?.status === "failed" && render.error ? (
                      <p className="text-xs text-destructive">{render.error}</p>
                    ) : null}

                    <div className="flex flex-wrap items-center gap-1.5">
                      <form action={generateAndRenderImageAction}>
                        <input type="hidden" name="summary_id" value={v.id} />
                        <input type="hidden" name="match_id" value={match.id} />
                        <input type="hidden" name="locale" value={locale} />
                        <SubmitButton
                          size="sm"
                          disabled={!hasKey}
                          pendingLabel={t("detail.generateAndRenderPending")}
                        >
                          {t("detail.generateAndRender")}
                        </SubmitButton>
                      </form>
                      <form action={renderMatchImageAction}>
                        <input type="hidden" name="summary_id" value={v.id} />
                        <input type="hidden" name="match_id" value={match.id} />
                        <input type="hidden" name="locale" value={locale} />
                        <SubmitButton
                          size="sm"
                          variant="secondary"
                          disabled={!hasLeonardoKey || !v.image_prompt}
                          pendingLabel={t("detail.renderImagePending")}
                        >
                          {render ? t("detail.rerenderImage") : t("detail.renderImage")}
                        </SubmitButton>
                      </form>
                      {render?.status === "pending" ? (
                        <form action={syncMatchImageRenderAction}>
                          <input type="hidden" name="summary_id" value={v.id} />
                          <input type="hidden" name="match_id" value={match.id} />
                          <input type="hidden" name="locale" value={locale} />
                          <SubmitButton
                            size="sm"
                            variant="ghost"
                            pendingLabel={t("detail.syncRenderPending")}
                          >
                            {t("detail.syncRender")}
                          </SubmitButton>
                        </form>
                      ) : null}
                    </div>
                  </div>

                  {!v.is_active ? (
                    <div className="flex flex-wrap items-center gap-1.5 border-t border-border pt-3">
                      <form action={setActiveSummaryVersion}>
                        <input type="hidden" name="summary_id" value={v.id} />
                        <input type="hidden" name="match_id" value={match.id} />
                        <input type="hidden" name="locale" value={locale} />
                        <SubmitButton size="sm" pendingLabel={t("detail.setActivePending")}>
                          {t("detail.setActive")}
                        </SubmitButton>
                      </form>
                      <form action={deleteSummaryVersion} className="ml-auto">
                        <input type="hidden" name="summary_id" value={v.id} />
                        <input type="hidden" name="match_id" value={match.id} />
                        <input type="hidden" name="locale" value={locale} />
                        <SubmitButton
                          size="sm"
                          variant="destructive"
                          confirmText={t("detail.deleteVersionConfirm")}
                        >
                          {t("detail.deleteVersion")}
                        </SubmitButton>
                      </form>
                    </div>
                  ) : null}
                </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Regenerate */}
        <Card className="p-5">
          <FormSection
            title={t("detail.regenerateSection")}
            description={t("detail.regenerateLede")}
          >
            <RegenerateSummaryForm
              action={regenerateMatchSummary}
              matchId={match.id}
              locale={locale}
              labels={regenLabels}
              disabled={regenDisabled}
              disabledNotice={regenNotice}
            />
          </FormSection>
        </Card>
      </div>
    </main>
  );
}

function FixtureTeam({
  label,
  team,
  align = "start",
}: {
  label: string;
  team: string;
  align?: "start" | "end";
}) {
  return (
    <div className={align === "end" ? "text-right" : ""}>
      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </div>
      <div
        className={`mt-1 flex items-center gap-2 ${align === "end" ? "justify-end" : ""}`}
      >
        {align === "end" ? null : <TeamFlag team={team} size="md" />}
        <span className="min-w-0 truncate font-heading text-lg font-semibold">
          {team}
        </span>
        {align === "end" ? <TeamFlag team={team} size="md" /> : null}
      </div>
    </div>
  );
}
