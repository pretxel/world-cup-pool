"use client";

import * as React from "react";
import { CircleDashedIcon } from "lucide-react";
import { useQueryParamWriter } from "@/components/use-query-param-writer";
import { cn } from "@/lib/utils";

// Signed-in-only toggle that narrows /matches to fixtures the user has not
// predicted and that are still open for picks. State is owned by the URL
// (`?picks=needed`); the count is computed server-side from the team-filtered
// set so the badge always matches what toggling would show.
export function NeedsPickToggle({
  count,
  active,
  label,
}: {
  count: number;
  active: boolean;
  label: string;
}) {
  const writeParams = useQueryParamWriter();

  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={() => writeParams({ picks: active ? null : "needed" })}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-heading text-xs font-medium tracking-tight transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "border-pitch/50 bg-pitch/10 text-pitch"
          : "border-border bg-card text-muted-foreground hover:bg-muted/50 hover:text-foreground",
      )}
    >
      <CircleDashedIcon className="size-3.5" aria-hidden />
      <span>{label}</span>
      <span className="font-mono tabular-nums">{count}</span>
    </button>
  );
}
