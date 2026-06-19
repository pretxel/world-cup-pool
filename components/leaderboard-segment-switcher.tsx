import Link from "next/link";
import { cn } from "@/lib/utils";
import type { LeaderboardSegment } from "@/lib/leaderboard-segment";

export type StageOption = { key: string; label: string };

export type SegmentSwitcherLabels = {
  group: string;
  overall: string;
  week: string;
  stage: string;
};

// Server-rendered segment switcher for /leaderboard. Like the /matches filters,
// selection is owned by the URL: each control is a <Link> that sets `?segment=`
// (and `?stage=` for the by-stage options), so the page stays SSR and shareable.
// `basePath` is the locale-prefixed /leaderboard path; the active segment/stage
// is visually indicated. Renders nothing for the stage row when the competition
// exposes no stages.
export function LeaderboardSegmentSwitcher({
  basePath,
  activeSegment,
  activeStage,
  stages,
  labels,
}: {
  basePath: string;
  activeSegment: LeaderboardSegment;
  activeStage: string | null;
  stages: StageOption[];
  labels: SegmentSwitcherLabels;
}) {
  return (
    <div className="mb-8">
      <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
        {labels.group}
      </p>
      <div role="group" aria-label={labels.group} className="flex flex-wrap gap-1.5">
        <Chip href={basePath} active={activeSegment === "overall"}>
          {labels.overall}
        </Chip>
        <Chip href={`${basePath}?segment=week`} active={activeSegment === "week"}>
          {labels.week}
        </Chip>
        {stages.length > 0 ? (
          <span className="mx-1 hidden self-center font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground sm:inline">
            {labels.stage}
          </span>
        ) : null}
        {stages.map((stage) => (
          <Chip
            key={stage.key}
            href={`${basePath}?segment=stage&stage=${encodeURIComponent(stage.key)}`}
            active={activeSegment === "stage" && activeStage === stage.key}
          >
            {stage.label}
          </Chip>
        ))}
      </div>
    </div>
  );
}

function Chip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-heading text-xs font-medium tracking-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "border-pitch/50 bg-pitch/10 text-pitch"
          : "border-border bg-card text-muted-foreground hover:bg-muted/50 hover:text-foreground",
      )}
    >
      {children}
    </Link>
  );
}
