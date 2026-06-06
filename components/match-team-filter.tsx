"use client";

import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { TeamFlag } from "@/components/team-flag";
import { cn } from "@/lib/utils";

// Interactive chip row for the public /matches list. The active selection is
// owned by the URL (`?team=`), read server-side; this component only writes it.
// Mirrors the locale-preserving navigation pattern in language-switcher.tsx.
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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = React.useTransition();

  const selectedKeys = React.useMemo(
    () => new Set(selected.map((team) => team.toLowerCase())),
    [selected],
  );

  // Rewrite only the `team` key, preserving the locale path prefix and any
  // unrelated query params. An empty selection drops the param entirely.
  const apply = React.useCallback(
    (next: string[]) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next.length === 0) params.delete("team");
      else params.set("team", next.join(","));
      const qs = params.toString();
      startTransition(() => {
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      });
    },
    [router, pathname, searchParams],
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
      <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
        {label}
      </p>
      <div
        role="group"
        aria-label={label}
        className="flex flex-wrap gap-1.5"
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
