import { getTranslations } from "next-intl/server";
import { ArrowDownIcon, ArrowUpIcon, MinusIcon } from "lucide-react";
import type { StandingSummary } from "@/lib/standing-summary";
import { cn } from "@/lib/utils";

// Shared, presentational standing-cards strip. Mobile-first, accessible. Fed by
// one `StandingSummary` so the same markup serves /my-picks and the signed-in
// landing. Async server component so it can pull its own translations, matching
// the group-standings-table pattern.
export async function StandingCards({
  summary,
  className,
}: {
  summary: StandingSummary;
  className?: string;
}) {
  const t = await getTranslations("standingCards");
  const hasFinals = summary.finals.scored > 0;

  return (
    <section
      className={className}
      aria-label={t("ariaLabel")}
    >
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        <Card label={t("points")} value={summary.totalPoints} accent="pitch" />
        <Card label={t("exact")} value={summary.exactCount} accent="flag" />
        <Card label={t("picks")} value={summary.totalPicks} />
        <Card
          label={t("rank")}
          value={
            summary.rank != null ? (
              <span className="flex items-baseline gap-1.5">
                <span>#{summary.rank}</span>
                <RankDeltaBadge delta={summary.rankDelta} t={t} />
              </span>
            ) : (
              <span className="text-base text-muted-foreground">
                {t("unranked")}
              </span>
            )
          }
        />
      </dl>

      {hasFinals ? (
        <div className="mt-2 rounded-md border border-border bg-card px-3 py-2 sm:mt-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            {t("accuracyTitle")}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-sm tabular-nums">
            <AccuracyStat
              label={t("accuracyExact")}
              value={summary.finals.exact}
              className="text-flag"
            />
            <AccuracyStat
              label={t("accuracyWinner")}
              value={summary.finals.winner}
              className="text-pitch"
            />
            <AccuracyStat
              label={t("accuracyMiss")}
              value={summary.finals.miss}
              className="text-muted-foreground"
            />
          </div>
        </div>
      ) : (
        <p className="mt-2 rounded-md border border-dashed border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground sm:mt-3">
          {t("accuracyEmpty")}
        </p>
      )}
    </section>
  );
}

function Card({
  label,
  value,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  accent?: "pitch" | "flag";
}) {
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2">
      <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </dt>
      <dd
        className={cn(
          "font-mono text-xl font-semibold tabular-nums",
          accent === "pitch" && "text-pitch",
          accent === "flag" && "text-flag",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function RankDeltaBadge({
  delta,
  t,
}: {
  delta: number | null;
  t: Awaited<ReturnType<typeof getTranslations<"standingCards">>>;
}) {
  if (delta == null) {
    return (
      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        {t("deltaNew")}
      </span>
    );
  }
  if (delta === 0) {
    return (
      <span className="inline-flex items-center gap-0.5 font-mono text-[11px] text-muted-foreground">
        <MinusIcon className="size-3" aria-hidden />
        <span className="sr-only">{t("deltaSame")}</span>
      </span>
    );
  }
  const up = delta > 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 font-mono text-[11px] font-semibold tabular-nums",
        up ? "text-pitch" : "text-destructive",
      )}
    >
      {up ? (
        <ArrowUpIcon className="size-3" aria-hidden />
      ) : (
        <ArrowDownIcon className="size-3" aria-hidden />
      )}
      {Math.abs(delta)}
      <span className="sr-only">
        {up ? t("deltaUp", { n: delta }) : t("deltaDown", { n: -delta })}
      </span>
    </span>
  );
}

function AccuracyStat({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className?: string;
}) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className={cn("font-semibold", className)}>{value}</span>
      <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </span>
    </span>
  );
}
