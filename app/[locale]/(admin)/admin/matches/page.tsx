import { getTranslations, setRequestLocale } from "next-intl/server";
import Link from "next/link";
import {
  ArrowRightIcon,
  CalendarClockIcon,
  RefreshCwIcon,
  SparklesIcon,
} from "lucide-react";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { LocalTime } from "@/components/local-time";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { FormSection } from "@/components/admin/form-section";
import { EmptyState } from "@/components/admin/empty-state";
import { ActionStatus } from "@/components/admin/action-status";
import { LiveRegion } from "@/components/admin/live-region";
import { SubmitButton } from "@/components/admin/submit-button";
import {
  saveFixture,
  setMatchResult,
  forceRecompute,
  deleteMatch,
  syncNow,
} from "./actions";
import { isLocale, localePath, DEFAULT_LOCALE, type Locale } from "@/lib/i18n";
import { isConfirmedMatch } from "@/lib/match-utils";
import { isStaleMatch } from "@/lib/result-sync/staleness";
import { getManagedCompetition } from "@/lib/admin/managed-competition";
import { ResendResultEmailsButton } from "@/components/admin/resend-emails-button";
import { SummarizeMatchButton } from "@/components/admin/summarize-match-button";
import {
  getStageLabel,
  hasGroupStage,
  sortedStages,
} from "@/lib/competition-schema";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin" });
  return { title: t("title") };
}

// Shared column template so the desktop header row and each fixture row stay
// aligned. Below `lg` each row collapses to a stacked card.
const ROW_COLS =
  "lg:grid lg:grid-cols-[7rem_minmax(0,1fr)_minmax(7rem,auto)_minmax(0,22rem)] lg:items-start lg:gap-4";

// The syncNow action reports back via query params (server-rendered page, no
// client state). Non-numeric values render as 0 rather than erroring.
function parseSyncSummaryParams(params: {
  [key: string]: string | string[] | undefined;
}): { source: string; counts: Record<string, number> } | null {
  const source = params.syncSource;
  if (typeof source !== "string" || source.length === 0) return null;
  const count = (key: string) => {
    const raw = params[key];
    const n = typeof raw === "string" ? Number(raw) : NaN;
    return Number.isInteger(n) && n >= 0 ? n : 0;
  };
  return {
    source,
    counts: {
      fetched: count("syncFetched"),
      matched: count("syncMatched"),
      final: count("syncFinal"),
      stale: count("syncStale"),
      staleResolved: count("syncStaleResolved"),
      errors: count("syncErrors"),
    },
  };
}

// The resendResultEmails action reports back per-match via query params (same
// server-rendered pattern as syncNow). Returns the target match id plus either
// an error code or the emailed/failed/skipped counts.
function parseResendSummaryParams(params: {
  [key: string]: string | string[] | undefined;
}):
  | { matchId: string; error: string | null; emailed: number; failed: number; skipped: number }
  | null {
  const matchId = params.resendMatchId;
  if (typeof matchId !== "string" || matchId.length === 0) return null;
  const error = typeof params.resendError === "string" ? params.resendError : null;
  const count = (key: string) => {
    const raw = params[key];
    const n = typeof raw === "string" ? Number(raw) : NaN;
    return Number.isInteger(n) && n >= 0 ? n : 0;
  };
  return {
    matchId,
    error,
    emailed: count("resendEmailed"),
    failed: count("resendFailed"),
    skipped: count("resendSkipped"),
  };
}

// The summarizeMatch action reports back per-match via query params (same
// server-rendered pattern as resendResultEmails): the target match id plus the
// outcome reason ("generated" or a generator skip reason).
function parseSummaryResultParams(params: {
  [key: string]: string | string[] | undefined;
}): { matchId: string; reason: string } | null {
  const matchId = params.summaryMatchId;
  if (typeof matchId !== "string" || matchId.length === 0) return null;
  const reason =
    typeof params.summaryReason === "string" ? params.summaryReason : "error";
  return { matchId, reason };
}

// Map a summary outcome reason to its `admin` message key and panel variant.
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

export default async function AdminMatchesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  setRequestLocale(locale);

  const t = await getTranslations("admin");
  const tStatus = await getTranslations("matchStatus");

  const sp = await searchParams;
  const syncSummary = parseSyncSummaryParams(sp);
  const resendSummary = parseResendSummaryParams(sp);
  const summaryResult = parseSummaryResultParams(sp);
  const now = new Date();

  // Everything on this page is scoped to the MANAGED competition (the admin's
  // editing context), which may differ from the public active competition.
  const managed = await getManagedCompetition();
  const stageOptions = managed
    ? sortedStages(managed.format).map((s) => ({
        value: s.key,
        label: getStageLabel(managed.format, s.key, locale),
      }))
    : [];
  const showGroupCode = managed ? hasGroupStage(managed.format) : true;
  const stageText = (stage: string) =>
    managed ? getStageLabel(managed.format, stage, locale) : stage;

  const supabase = await createServerSupabaseClient();
  let matchesQuery = supabase
    .from("matches")
    .select("*")
    .order("kickoff_at", { ascending: true });
  if (managed) matchesQuery = matchesQuery.eq("competition_id", managed.id);
  const { data: matches } = await matchesQuery;
  const list = matches ?? [];

  // Per-match summarize preconditions, batched over the visible match ids (both
  // queries are index-backed): which matches already have a recap, and which
  // have at least one event to summarize. Drives the button vs. "recap ready"
  // vs. "no events" affordance without an N+1.
  const matchIds = list.map((m) => m.id);
  const summarizedIds = new Set<string>();
  const eventedIds = new Set<string>();
  if (matchIds.length > 0) {
    const [{ data: summaryRows }, { data: eventRows }] = await Promise.all([
      supabase.from("match_summaries").select("match_id").in("match_id", matchIds),
      supabase.from("match_events").select("match_id").in("match_id", matchIds),
    ]);
    for (const r of summaryRows ?? []) summarizedIds.add(r.match_id);
    for (const r of eventRows ?? []) eventedIds.add(r.match_id);
  }

  // Outcome text for the always-mounted live regions (see <LiveRegion>): the
  // visible panels mount only after the action's redirect, so the persistent
  // region is what actually gets announced.
  const syncAnnounce =
    syncSummary && syncSummary.source !== "none"
      ? `${t("syncMatched")} ${syncSummary.counts.matched} · ${t("syncFinalized")} ${syncSummary.counts.final} · ${t("syncStale")} ${syncSummary.counts.stale} · ${t("syncErrors")} ${syncSummary.counts.errors}`
      : undefined;
  const syncAlert =
    syncSummary?.source === "none"
      ? t("syncFailed", { errors: syncSummary.counts.errors })
      : undefined;
  const resendAnnounce =
    resendSummary && resendSummary.error !== "notFinal"
      ? t("resendSummary", {
          emailed: resendSummary.emailed,
          failed: resendSummary.failed,
          skipped: resendSummary.skipped,
        })
      : undefined;
  const resendAlert =
    resendSummary?.error === "notFinal" ? t("resendNotFinal") : undefined;
  const summaryMessage = summaryResult
    ? t(SUMMARY_REASON_KEY[summaryResult.reason] ?? "summaryDoneError")
    : undefined;
  const summaryIsError =
    summaryResult != null && summaryVariant(summaryResult.reason) === "error";
  const summaryAnnounce =
    summaryResult && !summaryIsError ? summaryMessage : undefined;
  const summaryAlert = summaryIsError ? summaryMessage : undefined;

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <LiveRegion
        status={syncAnnounce ?? resendAnnounce ?? summaryAnnounce}
        alert={syncAlert ?? resendAlert ?? summaryAlert}
      />
      <div className="admin-reveal space-y-8">
        <AdminPageHeader
          eyebrow={managed?.name}
          title={t("headline")}
          description={t("lede")}
        />

        {/* Result sync */}
        <Card className="gap-3 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-0.5">
              <h2 className="font-heading text-base font-semibold">
                {t("syncTitle")}
              </h2>
              <p className="text-sm text-muted-foreground">{t("syncLede")}</p>
            </div>
            <form action={syncNow}>
              <input type="hidden" name="locale" value={locale} />
              <SubmitButton variant="outline">
                <RefreshCwIcon aria-hidden />
                {t("syncNow")}
              </SubmitButton>
            </form>
          </div>
          {syncSummary ? (
            syncSummary.source === "none" ? (
              <ActionStatus variant="error" live={false}>
                {t("syncFailed", { errors: syncSummary.counts.errors })}
              </ActionStatus>
            ) : (
              <ActionStatus variant="success" live={false}>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-3">
                  <SyncStat label={t("syncSource")} value={syncSummary.source} mono />
                  <SyncStat label={t("syncMatched")} value={syncSummary.counts.matched} />
                  <SyncStat label={t("syncFinalized")} value={syncSummary.counts.final} />
                  <SyncStat
                    label={t("syncStaleResolved")}
                    value={syncSummary.counts.staleResolved}
                  />
                  <SyncStat label={t("syncStale")} value={syncSummary.counts.stale} />
                  <SyncStat label={t("syncErrors")} value={syncSummary.counts.errors} />
                </dl>
              </ActionStatus>
            )
          ) : null}
        </Card>

        {/* New fixture */}
        <Card className="p-5">
          <FormSection title={t("newFixture")}>
            <form
              action={saveFixture}
              className="grid grid-cols-1 gap-3 sm:grid-cols-2"
            >
              <div className="space-y-1.5">
                <Label htmlFor="stage">{t("stage")}</Label>
                <NativeSelect id="stage" name="stage">
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
                  <Input id="group_code" name="group_code" maxLength={1} />
                </div>
              ) : null}
              <div className="space-y-1.5">
                <Label htmlFor="home_team">{t("homeTeam")}</Label>
                <Input id="home_team" name="home_team" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="away_team">{t("awayTeam")}</Label>
                <Input id="away_team" name="away_team" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="kickoff_at">{t("kickoff")}</Label>
                <Input id="kickoff_at" name="kickoff_at" type="datetime-local" required step="60" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="venue">{t("venue")}</Label>
                <Input id="venue" name="venue" />
              </div>
              <div className="sm:col-span-2">
                <SubmitButton>{t("createFixture")}</SubmitButton>
              </div>
            </form>
          </FormSection>
        </Card>

        {/* Fixtures list */}
        <section className="space-y-3">
          <h2 className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {t("allFixtures", { count: list.length })}
          </h2>

          {list.length === 0 ? (
            <EmptyState
              icon={<CalendarClockIcon />}
              title={t("fixturesEmptyTitle")}
              description={t("fixturesEmptyBody")}
            />
          ) : (
            <div className="overflow-hidden rounded-xl border border-border">
              {/* Desktop column header */}
              <div
                className={`hidden border-b border-border bg-muted/40 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground ${ROW_COLS}`}
              >
                <span>{t("colKickoff")}</span>
                <span>{t("colMatch")}</span>
                <span>{t("colStatus")}</span>
                <span>{t("colManage")}</span>
              </div>

              <ul>
                {list.map((m) => {
                  const confirmed = isConfirmedMatch(m);
                  const stale = isStaleMatch(m, now);
                  const hasScore =
                    m.status === "final" &&
                    m.home_score != null &&
                    m.away_score != null;
                  return (
                    <li
                      key={m.id}
                      className={`flex flex-col gap-3 border-b border-border p-4 last:border-b-0 even:bg-muted/20 lg:p-3 ${ROW_COLS}`}
                    >
                      {/* Kickoff */}
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <CalendarClockIcon
                          className="size-3.5 lg:hidden"
                          aria-hidden
                        />
                        <LocalTime iso={m.kickoff_at} />
                      </div>

                      {/* Match */}
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline">
                            {stageText(m.stage)}
                            {m.group_code ? ` · ${m.group_code}` : ""}
                          </Badge>
                        </div>
                        <div className="text-base font-medium">
                          {m.home_team}{" "}
                          <span className="text-muted-foreground">{t("versus")}</span>{" "}
                          {m.away_team}
                          {hasScore ? (
                            <span className="ml-2 font-mono tabular-nums text-muted-foreground">
                              ({m.home_score}–{m.away_score})
                            </span>
                          ) : null}
                        </div>
                        {m.venue ? (
                          <div className="text-xs text-muted-foreground">
                            {m.venue}
                          </div>
                        ) : null}
                      </div>

                      {/* Status */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        {m.status === "final" ? (
                          <Badge>{tStatus("final")}</Badge>
                        ) : m.status === "live" ? (
                          <Badge
                            variant="outline"
                            className="live-pulse border-live/40 text-live"
                          >
                            {tStatus("live")}
                          </Badge>
                        ) : m.status === "cancelled" ? (
                          <Badge variant="outline">{tStatus("cancelled")}</Badge>
                        ) : (
                          <Badge variant="secondary">{tStatus("scheduled")}</Badge>
                        )}
                        {!confirmed ? (
                          <Badge variant="destructive">{t("unconfirmed")}</Badge>
                        ) : null}
                        {stale ? (
                          <Badge className="border-transparent bg-accent text-accent-foreground">
                            {t("staleBadge")}
                          </Badge>
                        ) : null}
                      </div>

                      {/* Manage: inline result entry + grouped actions */}
                      <div className="space-y-3">
                        <form
                          action={setMatchResult}
                          className="rounded-lg border border-border bg-card p-3"
                        >
                          <input type="hidden" name="match_id" value={m.id} />
                          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                            {t("result")}
                          </div>
                          <div className="mt-2 flex items-end gap-2">
                            <div className="min-w-0 flex-1">
                              <Label
                                htmlFor={`hs-${m.id}`}
                                className="block truncate text-xs"
                              >
                                {m.home_team}
                              </Label>
                              <Input
                                id={`hs-${m.id}`}
                                name="home_score"
                                type="number"
                                min={0}
                                max={30}
                                defaultValue={m.home_score ?? ""}
                                className="tabular-nums"
                              />
                            </div>
                            <span className="pb-2 text-muted-foreground">–</span>
                            <div className="min-w-0 flex-1">
                              <Label
                                htmlFor={`as-${m.id}`}
                                className="block truncate text-xs"
                              >
                                {m.away_team}
                              </Label>
                              <Input
                                id={`as-${m.id}`}
                                name="away_score"
                                type="number"
                                min={0}
                                max={30}
                                defaultValue={m.away_score ?? ""}
                                className="tabular-nums"
                              />
                            </div>
                          </div>
                          <div className="mt-2 space-y-1.5">
                            <Label htmlFor={`st-${m.id}`} className="text-xs">
                              {t("status")}
                            </Label>
                            <NativeSelect
                              id={`st-${m.id}`}
                              name="status"
                              defaultValue={m.status}
                            >
                              <option value="scheduled">{t("statusScheduled")}</option>
                              <option value="live">{t("statusLive")}</option>
                              <option value="final">{t("statusFinal")}</option>
                              <option value="cancelled">{t("statusCancelled")}</option>
                            </NativeSelect>
                          </div>
                          <div className="mt-3">
                            <SubmitButton size="sm">{t("saveResult")}</SubmitButton>
                          </div>
                        </form>

                        <div className="flex flex-wrap items-center gap-1.5">
                          <Link
                            href={localePath(locale, `/admin/matches/${m.id}`)}
                            className={buttonVariants({
                              size: "sm",
                              variant: "outline",
                              className: "gap-1.5",
                            })}
                          >
                            {t("detail.open")}
                            <ArrowRightIcon className="size-3.5" aria-hidden />
                          </Link>
                          <form action={forceRecompute}>
                            <input type="hidden" name="match_id" value={m.id} />
                            <SubmitButton size="sm" variant="ghost">
                              {t("forceRecompute")}
                            </SubmitButton>
                          </form>
                          {m.status === "final" ? (
                            <ResendResultEmailsButton
                              matchId={m.id}
                              locale={locale}
                              label={t("resendEmails")}
                              confirmText={t("resendConfirm")}
                            />
                          ) : null}
                          {/* AI recap: button when there is event data and no
                              recap yet; "ready" badge once a recap exists; a
                              hint when there are no events to summarize. */}
                          {m.status === "final" ? (
                            summarizedIds.has(m.id) ? (
                              <Link
                                href={localePath(locale, `/admin/matches/${m.id}`)}
                                className="transition-opacity hover:opacity-80"
                              >
                                <Badge variant="outline" className="gap-1">
                                  <SparklesIcon className="size-3" aria-hidden />
                                  {t("summaryReady")}
                                </Badge>
                              </Link>
                            ) : eventedIds.has(m.id) ? (
                              <SummarizeMatchButton
                                matchId={m.id}
                                locale={locale}
                                label={t("summarize")}
                                pendingLabel={t("summarizePending")}
                              />
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                {t("summarizeNoEvents")}
                              </span>
                            )
                          ) : null}
                          {/* Destructive action separated from primary/secondary */}
                          <form
                            action={deleteMatch}
                            className="ml-auto border-l border-border pl-1.5"
                          >
                            <input type="hidden" name="id" value={m.id} />
                            <SubmitButton
                              size="sm"
                              variant="destructive"
                              confirmText={t("deleteFixtureConfirm")}
                            >
                              {t("deleteFixture")}
                            </SubmitButton>
                          </form>
                        </div>

                        {resendSummary?.matchId === m.id ? (
                          resendSummary.error === "notFinal" ? (
                            <ActionStatus variant="error" live={false}>
                              {t("resendNotFinal")}
                            </ActionStatus>
                          ) : (
                            <ActionStatus variant="success" live={false}>
                              {t("resendSummary", {
                                emailed: resendSummary.emailed,
                                failed: resendSummary.failed,
                                skipped: resendSummary.skipped,
                              })}
                            </ActionStatus>
                          )
                        ) : null}

                        {summaryResult?.matchId === m.id ? (
                          <ActionStatus
                            variant={summaryVariant(summaryResult.reason)}
                            live={false}
                          >
                            {t(
                              SUMMARY_REASON_KEY[summaryResult.reason] ??
                                "summaryDoneError",
                            )}
                          </ActionStatus>
                        ) : null}
                      </div>

                      {/* Full edit form (secondary) */}
                      <details className="rounded-lg border border-border p-3 lg:col-span-full">
                        <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                          {t("editFixture")}
                        </summary>
                        <form
                          action={saveFixture}
                          className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2"
                        >
                          <input type="hidden" name="id" value={m.id} />
                          <div className="space-y-1.5">
                            <Label htmlFor={`stage-${m.id}`}>{t("stage")}</Label>
                            <NativeSelect
                              id={`stage-${m.id}`}
                              name="stage"
                              defaultValue={m.stage}
                            >
                              {stageOptions.map((o) => (
                                <option key={o.value} value={o.value}>
                                  {o.label}
                                </option>
                              ))}
                            </NativeSelect>
                          </div>
                          {showGroupCode ? (
                            <div className="space-y-1.5">
                              <Label htmlFor={`gc-${m.id}`}>{t("groupCode")}</Label>
                              <Input
                                id={`gc-${m.id}`}
                                name="group_code"
                                maxLength={1}
                                defaultValue={m.group_code ?? ""}
                              />
                            </div>
                          ) : null}
                          <div className="space-y-1.5">
                            <Label htmlFor={`ht-${m.id}`}>{t("homeTeam")}</Label>
                            <Input
                              id={`ht-${m.id}`}
                              name="home_team"
                              defaultValue={m.home_team}
                              required
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor={`at-${m.id}`}>{t("awayTeam")}</Label>
                            <Input
                              id={`at-${m.id}`}
                              name="away_team"
                              defaultValue={m.away_team}
                              required
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor={`ko-${m.id}`}>{t("kickoff")}</Label>
                            <Input
                              id={`ko-${m.id}`}
                              name="kickoff_at"
                              type="datetime-local"
                              step="60"
                              defaultValue={m.kickoff_at.slice(0, 16)}
                              required
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor={`vn-${m.id}`}>{t("venue")}</Label>
                            <Input
                              id={`vn-${m.id}`}
                              name="venue"
                              defaultValue={m.venue ?? ""}
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <SubmitButton size="sm">{t("saveEdit")}</SubmitButton>
                          </div>
                        </form>
                      </details>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function SyncStat({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex justify-between gap-2 sm:block">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={mono ? "font-mono" : "font-mono tabular-nums"}>{value}</dd>
    </div>
  );
}
