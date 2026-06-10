"use client";

import * as React from "react";
import { useQueryParamWriter } from "@/components/use-query-param-writer";
import type { MatchStatusFilter as StatusValue } from "@/lib/match-utils";
import { cn } from "@/lib/utils";

// The header stat cards for /matches, doubling as a single-select status
// filter. Counts are computed server-side from the team-filtered list (before
// status filtering) so each card shows what activating it would yield.
// Selection is owned by the URL (`?status=`); this component only writes it.
export function MatchStatusFilter({
  counts,
  active,
  labels,
  groupLabel,
}: {
  counts: Record<StatusValue, number>;
  active: StatusValue | null;
  labels: Record<StatusValue, string>;
  groupLabel: string;
}) {
  const writeParams = useQueryParamWriter();

  // Single-select toggle: activating the active card clears the filter.
  const toggle = (status: StatusValue) => {
    writeParams({ status: active === status ? null : status });
  };

  return (
    <dl
      role="group"
      aria-label={groupLabel}
      className="grid grid-cols-3 gap-2 sm:shrink-0 sm:gap-3"
    >
      {(["upcoming", "live", "final"] as const).map((status) => (
        <StatCard
          key={status}
          label={labels[status]}
          value={counts[status]}
          accent={status === "live" ? "live" : status === "final" ? "final" : undefined}
          active={active === status}
          onClick={() => toggle(status)}
        />
      ))}
    </dl>
  );
}

function StatCard({
  label,
  value,
  accent,
  active,
  onClick,
}: {
  label: string;
  value: number;
  accent?: "live" | "final";
  active: boolean;
  onClick: () => void;
}) {
  return (
    <div>
      <button
        type="button"
        aria-pressed={active}
        onClick={onClick}
        className={cn(
          "w-full rounded-md border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          active
            ? "border-pitch/50 bg-pitch/10"
            : "border-border bg-card hover:bg-muted/50",
        )}
      >
        <dt
          className={cn(
            "truncate font-mono text-[10px] uppercase tracking-[0.2em]",
            accent === "live" ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {label}
        </dt>
        <dd
          className={cn(
            "font-mono text-xl font-semibold tabular-nums",
            accent === "final" && "text-pitch",
          )}
        >
          {value}
        </dd>
      </button>
    </div>
  );
}
