"use client";

import * as React from "react";
import { BellRingIcon, ChevronRightIcon, XIcon } from "lucide-react";
import { useQueryParamWriter } from "@/components/use-query-param-writer";

// Signed-in-only nudge shown at the top of /matches when the user still has
// upcoming fixtures needing a pick. The count is computed server-side from the
// team-filtered set (the same value that feeds NeedsPickToggle), so the banner
// and the toggle never disagree. The CTA writes `?picks=needed` — identical to
// the toggle's write — so activating it narrows the list to those fixtures.
// Dismissal is session-scoped client state: once closed the banner stays hidden
// until the next full page load, nudging once without nagging.
export function PendingPicksNudge({
  count,
  message,
  actionLabel,
  dismissLabel,
}: {
  count: number;
  message: string;
  actionLabel: string;
  dismissLabel: string;
}) {
  const writeParams = useQueryParamWriter();
  const [dismissed, setDismissed] = React.useState(false);

  // Defensive: never render an empty nudge even if the server passes 0.
  if (count <= 0 || dismissed) return null;

  return (
    <div className="flex items-center gap-3 rounded-xl border border-pitch/40 bg-pitch/10 px-4 py-3 text-pitch">
      <BellRingIcon className="size-4 shrink-0" aria-hidden />
      <p className="min-w-0 flex-1 font-heading text-sm font-medium tracking-tight">
        {message}
      </p>
      <button
        type="button"
        onClick={() => writeParams({ picks: "needed" })}
        className="inline-flex shrink-0 items-center gap-1 rounded-full border border-pitch/50 bg-card px-3 py-1 font-heading text-xs font-medium tracking-tight text-pitch transition-colors hover:bg-pitch/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span>{actionLabel}</span>
        <ChevronRightIcon className="size-3.5" aria-hidden />
      </button>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label={dismissLabel}
        className="inline-flex shrink-0 items-center justify-center rounded-full p-1 text-pitch/70 transition-colors hover:bg-pitch/10 hover:text-pitch focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <XIcon className="size-4" aria-hidden />
      </button>
    </div>
  );
}
