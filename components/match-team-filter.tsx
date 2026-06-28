"use client";

import * as React from "react";
import { ChevronDownIcon } from "lucide-react";
import { TeamFlag } from "@/components/team-flag";
import { useQueryParamWriter } from "@/components/use-query-param-writer";
import { cn } from "@/lib/utils";

// Interactive chip row for the public /matches list. The active selection is
// owned by the URL (`?team=`), read server-side; this component only writes it.
//
// On mobile the full team list (40+ chips) is collapsed behind a disclosure so
// it never buries the match list; on >=sm screens it is always expanded inline.
// The active selection is summarized on the toggle so a collapsed filter is
// still discoverable.
export function MatchTeamFilter({
  teams,
  selected,
  allLabel,
  label,
}: {
  teams: string[];
  selected: string[];
  allLabel: string;
  label: string;
}) {
  const writeParams = useQueryParamWriter();
  // Open by default if a filter is already active (deep link), so the user sees
  // which teams are selected without having to expand.
  const [open, setOpen] = React.useState(selected.length > 0);
  const listId = React.useId();

  const selectedKeys = React.useMemo(
    () => new Set(selected.map((team) => team.toLowerCase())),
    [selected],
  );

  // Rewrite only the `team` key; an empty selection drops the param entirely.
  const apply = React.useCallback(
    (next: string[]) => {
      writeParams({ team: next.length === 0 ? null : next.join(",") });
    },
    [writeParams],
  );

  const toggle = (team: string) => {
    const key = team.toLowerCase();
    const next = selectedKeys.has(key)
      ? selected.filter((t) => t.toLowerCase() !== key)
      : [...selected, team];
    apply(next);
  };

  const isAll = selected.length === 0;

  return (
    <div className="mb-8">
      {/* Desktop eyebrow — the toggle carries the label on mobile. */}
      <p className="mb-2 hidden font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground sm:block">
        {label}
      </p>

      {/* Mobile-only disclosure toggle. */}
      <button
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((v) => !v)}
        className="mb-3 inline-flex min-h-11 items-center gap-2 rounded-lg border border-border bg-card px-4 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:hidden"
      >
        <span>{label}</span>
        {!isAll ? (
          <span className="rounded-full bg-pitch px-1.5 py-0.5 text-[10px] font-semibold text-pitch-foreground tabular-nums">
            {selected.length}
          </span>
        ) : null}
        <ChevronDownIcon
          className={cn("size-4 transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>

      <div
        id={listId}
        role="group"
        aria-label={label}
        className={cn("flex-wrap gap-1.5", open ? "flex" : "hidden", "sm:flex")}
      >
        <Chip active={isAll} onClick={() => apply([])}>
          {allLabel}
        </Chip>
        {teams.map((team) => (
          <Chip
            key={team}
            active={selectedKeys.has(team.toLowerCase())}
            onClick={() => toggle(team)}
          >
            <TeamFlag team={team} size="sm" />
            <span>{team}</span>
          </Chip>
        ))}
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
        "inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 font-heading text-xs font-medium tracking-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        active
          ? "border-pitch/50 bg-pitch/10 text-pitch"
          : "border-border bg-card text-muted-foreground hover:bg-muted/50 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
