"use client";

import * as React from "react";
import { LOCK_LEAD_WINDOW_MS } from "@/lib/match-utils";
import { cn } from "@/lib/utils";

// Closing-soon urgency badge for a still-pickable /matches row. It reuses the
// established KickoffCountdown pattern — a 1s interval over `kickoffAt`,
// second-resolution mm:ss formatting, and a swap to a locked node at
// `remaining <= 0` — but scoped to the imminent lead window:
//   - while 0 < (kickoff − now) <= leadWindowMs: shows "closes in mm:ss"
//   - at/after kickoff (remaining <= 0): renders `lockedNode` (the row's
//     existing "Locked" label), converging with a fresh server render
//   - further out than the lead window: renders `pickNode` (the row's static
//     "Pick" label)
// Owning all three states keeps the trailing affordance to a single client
// island, so a row that crosses the "enter urgency" or "lock" boundary while
// the list is open updates in place — no double label, no reload.
export function MatchLockCountdown({
  kickoffAt,
  closesInTemplate,
  lockedNode,
  pickNode,
  leadWindowMs = LOCK_LEAD_WINDOW_MS,
  className,
}: {
  kickoffAt: string;
  /**
   * Localized phrase with a literal `{time}` placeholder, e.g.
   * "closes in {time}". Passed as a serializable string from the server so the
   * client island stays prop-serializable; the mm:ss value is interpolated
   * here.
   */
  closesInTemplate: string;
  /** The row's existing locked label, shown once kickoff is reached. */
  lockedNode: React.ReactNode;
  /** The row's static "Pick" label, shown while kickoff is not yet imminent. */
  pickNode: React.ReactNode;
  leadWindowMs?: number;
  className?: string;
}) {
  const [remaining, setRemaining] = React.useState<number>(() =>
    Math.max(0, new Date(kickoffAt).getTime() - Date.now()),
  );

  React.useEffect(() => {
    const target = new Date(kickoffAt).getTime();
    const tick = () => setRemaining(Math.max(0, target - Date.now()));
    tick();
    if (target - Date.now() <= 0) return;
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [kickoffAt]);

  if (remaining <= 0) {
    return <>{lockedNode}</>;
  }

  if (remaining > leadWindowMs) {
    // Not yet imminent: the row keeps its static "Pick" label.
    return <>{pickNode}</>;
  }

  const mins = Math.floor(remaining / 60_000);
  const secs = Math.floor((remaining % 60_000) / 1_000);
  const time = `${mins}:${secs.toString().padStart(2, "0")}`;
  const label = closesInTemplate.replace("{time}", time);

  return (
    <span
      className={cn(
        "border-flag/40 bg-flag/10 text-flag hidden items-center gap-1.5 rounded-sm border px-1.5 py-0.5 font-mono text-[10px] font-medium tracking-[0.16em] uppercase sm:inline-flex",
        className,
      )}
      aria-live="polite"
    >
      <span aria-hidden className="bg-flag size-1.5 rounded-full" />
      {label}
    </span>
  );
}
