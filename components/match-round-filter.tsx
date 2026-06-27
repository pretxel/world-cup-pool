"use client";

import * as React from "react";
import { useQueryParamWriter } from "@/components/use-query-param-writer";
import { cn } from "@/lib/utils";

// Single-select round (stage) filter for the public /matches list. The active
// round is owned by the URL (`?round=`), read server-side; this component only
// writes it. Mirrors match-team-filter's chip styling, but one round at a time
// (like the status filter): selecting the active round or "All" clears it.
export function MatchRoundFilter({
  rounds,
  selected,
  allLabel,
  label,
}: {
  rounds: { key: string; label: string }[];
  selected: string | null;
  allLabel: string;
  label: string;
}) {
  const writeParams = useQueryParamWriter();

  // Rewrite only the `round` key; clearing drops the param entirely.
  const select = (round: string | null) => {
    writeParams({ round: round ?? null });
  };

  return (
    <div className="mb-8">
      <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
        {label}
      </p>
      <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
        <Chip active={selected === null} onClick={() => select(null)}>
          {allLabel}
        </Chip>
        {rounds.map((round) => {
          const active = selected === round.key;
          return (
            <Chip key={round.key} active={active} onClick={() => select(active ? null : round.key)}>
              {round.label}
            </Chip>
          );
        })}
      </div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-heading text-xs font-medium tracking-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "border-pitch/50 bg-pitch/10 text-pitch"
          : "border-border bg-card text-muted-foreground hover:bg-muted/50 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
