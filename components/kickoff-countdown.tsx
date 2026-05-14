"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "inline" | "stacked";

export function KickoffCountdown({
  kickoffAt,
  variant = "inline",
  className,
  lockedLabel = "Locked at kickoff",
}: {
  kickoffAt: string;
  variant?: Variant;
  className?: string;
  lockedLabel?: string;
}) {
  const [remaining, setRemaining] = React.useState<number>(() =>
    Math.max(0, new Date(kickoffAt).getTime() - Date.now()),
  );

  React.useEffect(() => {
    const target = new Date(kickoffAt).getTime();
    const tick = () => setRemaining(Math.max(0, target - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [kickoffAt]);

  if (remaining <= 0) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground",
          className,
        )}
      >
        <span aria-hidden className="size-1.5 rounded-full bg-muted-foreground/60" />
        {lockedLabel}
      </span>
    );
  }

  const days = Math.floor(remaining / 86_400_000);
  const hours = Math.floor((remaining % 86_400_000) / 3_600_000);
  const mins = Math.floor((remaining % 3_600_000) / 60_000);
  const secs = Math.floor((remaining % 60_000) / 1_000);

  if (variant === "stacked") {
    return (
      <div
        className={cn(
          "inline-grid grid-cols-4 gap-2 text-center font-mono",
          className,
        )}
        aria-label={`${days}d ${hours}h ${mins}m ${secs}s until kickoff`}
      >
        {[
          { value: days, label: "days" },
          { value: hours, label: "hrs" },
          { value: mins, label: "min" },
          { value: secs, label: "sec" },
        ].map((u) => (
          <div
            key={u.label}
            className="flex flex-col items-center rounded-md bg-card px-3 py-2 ring-1 ring-border"
          >
            <span className="text-2xl font-semibold leading-none tabular-nums">
              {pad(u.value)}
            </span>
            <span className="mt-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              {u.label}
            </span>
          </div>
        ))}
      </div>
    );
  }

  const parts = days > 0
    ? `${days}d ${pad(hours)}h ${pad(mins)}m`
    : hours > 0
      ? `${pad(hours)}:${pad(mins)}:${pad(secs)}`
      : `${pad(mins)}:${pad(secs)}`;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground",
        className,
      )}
      aria-live="polite"
    >
      <span aria-hidden className="size-1.5 rounded-full bg-flag" />
      <span>{parts}</span>
      <span className="text-muted-foreground/70">to kickoff</span>
    </span>
  );
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}
