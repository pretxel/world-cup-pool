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
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { FormSection } from "@/components/admin/form-section";
import { EmptyState } from "@/components/admin/empty-state";
import { ActionStatus } from "@/components/admin/action-status";
import { LiveRegion } from "@/components/admin/live-region";
import { SubmitButton } from "@/components/admin/submit-button";
import {
  RegenerateSummaryForm,
  type RegenerateLabels,
} from "@/components/admin/regenerate-summary-form";
import {
  regenerateMatchSummary,
  setActiveSummaryVersion,
  deleteSummaryVersion,
} from "../actions";
import { getManagedCompetition } from "@/lib/admin/managed-competition";
import { getStageLabel } from "@/lib/competition-schema";
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

function pickOutcome(sp: { [k: string]: string | string[] | undefined }): string | null {
  for (const k of ["regenResult", "activateResult", "deleteResult"]) {
    const v = sp[k];
    if (typeof v === "string" && v.length > 0) return v;
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

  const [{ data: eventRows }, { data: versionRows }] = await Promise.all([
    admin
      .from("match_events")
      .select("id, type, team, minute, extra_minute, player, detail, sequence")
      .eq("match_id", matchId)
      .order("sequence", { ascending: true }),
    admin
      .from("match_summaries")
      .select("id, content, style_key, style_instruction, model, generated_at, is_active")
      .eq("match_id", matchId)
      .order("generated_at", { ascending: false }),
  ]);
  const events = eventRows ?? [];
  const versions = versionRows ?? [];

  const sp = await searchParams;
  const outcomeCode = pickOutcome(sp);
  const outcome = outcomeCode ? OUTCOME[outcomeCode] : null;
  const outcomeMessage = outcome ? t(`detail.${outcome.key}`) : undefined;
  const outcomeAnnounce =
    outcome && outcome.variant !== "error" ? outcomeMessage : undefined;
  const outcomeAlert = outcome?.variant === "error" ? outcomeMessage : undefined;

  const status = match.status as BadgeStatus;
  const stageLabel = getStageLabel(managed.format, match.stage, locale);
  const isFinal =
    match.status === "final" && match.home_score != null && match.away_score != null;

  // Regenerate preconditions: a recap is only ever generated for a final match
  // that has event data, and only when the generator key is configured. Disable
  // the form (with the most relevant reason) when any precondition fails.
  const hasEvents = events.length > 0;
  const hasKey = Boolean(env.openrouterApiKey);
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

          {outcome ? (
            <ActionStatus variant={outcome.variant} live={false}>
              {outcomeMessage}
            </ActionStatus>
          ) : null}

          {versions.length === 0 ? (
            <EmptyState icon={<SparklesIcon />} title={t("detail.recapEmpty")} />
          ) : (
            <ul className="space-y-3">
              {versions.map((v) => (
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
              ))}
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
