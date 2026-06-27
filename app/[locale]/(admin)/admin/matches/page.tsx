import { getTranslations, setRequestLocale } from "next-intl/server";
import Link from "next/link";
import { ArrowRightIcon, CalendarClockIcon, RefreshCwIcon } from "lucide-react";
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
  confirmKnockoutTeams,
  saveFixture,
  syncNow,
  toggleKnockoutRoundReveal,
} from "./actions";
import { isLocale, localePath, DEFAULT_LOCALE, type Locale } from "@/lib/i18n";
import { isConfirmedMatch } from "@/lib/match-utils";
import { cn } from "@/lib/utils";
import { isStaleMatch } from "@/lib/result-sync/staleness";
import { getManagedCompetition } from "@/lib/admin/managed-competition";
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
  // The confirmKnockoutTeams action reports the number of fixtures stamped.
  const confirmUpdated =
    typeof sp.confirmUpdated === "string" && /^\d+$/.test(sp.confirmUpdated)
      ? Number(sp.confirmUpdated)
      : null;
  // The detail page's delete redirects here with `deleteResult=deleted`.
  const fixtureDeleted = sp.deleteResult === "deleted";
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
  // Knockout rounds the admin can reveal/hide on the public matches list.
  const knockoutStages = managed
    ? sortedStages(managed.format).filter((s) => s.kind === "knockout")
    : [];
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
  const deletedAnnounce = fixtureDeleted ? t("fixtureDeleted") : undefined;

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <LiveRegion status={syncAnnounce ?? deletedAnnounce} alert={syncAlert} />
      <div className="admin-reveal space-y-8">
        <AdminPageHeader
          eyebrow={managed?.name}
          title={t("headline")}
          description={t("lede")}
        />

        {fixtureDeleted ? (
          <ActionStatus variant="success" live={false}>
            {t("fixtureDeleted")}
          </ActionStatus>
        ) : null}

        {/* Result sync */}
        <Card className="gap-3 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-0.5">
              <h2 className="font-heading text-base font-semibold">
                {t("syncTitle")}
              </h2>
              <p className="text-sm text-muted-foreground">{t("syncLede")}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <form action={confirmKnockoutTeams}>
                <input type="hidden" name="locale" value={locale} />
                <SubmitButton
                  variant="outline"
                  pendingLabel={t("confirmKnockoutRunning")}
                >
                  {t("confirmKnockout")}
                </SubmitButton>
              </form>
              <form action={syncNow}>
                <input type="hidden" name="locale" value={locale} />
                <SubmitButton variant="outline">
                  <RefreshCwIcon aria-hidden />
                  {t("syncNow")}
                </SubmitButton>
              </form>
            </div>
          </div>
          {confirmUpdated != null ? (
            <ActionStatus variant="success" live={false}>
              {confirmUpdated > 0
                ? t("confirmKnockoutResult", { count: confirmUpdated })
                : t("confirmKnockoutNone")}
            </ActionStatus>
          ) : null}
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

        {/* Knockout round reveal */}
        {knockoutStages.length > 0 ? (
          <Card className="gap-3 p-5">
            <div className="space-y-0.5">
              <h2 className="font-heading text-base font-semibold">
                {t("revealTitle")}
              </h2>
              <p className="text-sm text-muted-foreground">{t("revealLede")}</p>
            </div>
            <ul className="divide-border divide-y">
              {knockoutStages.map((s) => {
                const revealed = s.revealed === true;
                return (
                  <li
                    key={s.key}
                    className="flex items-center justify-between gap-3 py-2"
                  >
                    <span className="flex items-center gap-2 text-sm">
                      <span className="font-medium">
                        {getStageLabel(managed!.format, s.key, locale)}
                      </span>
                      <span
                        className={cn(
                          "rounded-sm border px-1.5 py-0.5 font-mono text-[10px] tracking-[0.16em] uppercase",
                          revealed
                            ? "border-pitch/40 bg-pitch/10 text-pitch"
                            : "border-border bg-secondary text-muted-foreground",
                        )}
                      >
                        {revealed ? t("revealStateOn") : t("revealStateOff")}
                      </span>
                    </span>
                    <form action={toggleKnockoutRoundReveal}>
                      <input type="hidden" name="locale" value={locale} />
                      <input type="hidden" name="stage" value={s.key} />
                      <input
                        type="hidden"
                        name="reveal"
                        value={revealed ? "false" : "true"}
                      />
                      <SubmitButton size="sm" variant="outline">
                        {revealed ? t("revealHide") : t("revealShow")}
                      </SubmitButton>
                    </form>
                  </li>
                );
              })}
            </ul>
          </Card>
        ) : null}

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

                      {/* Manage: open the per-match detail workspace */}
                      <div className="flex items-start lg:justify-end">
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
                      </div>
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
