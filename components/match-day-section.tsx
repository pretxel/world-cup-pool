"use client";

import * as React from "react";
import { ChevronDownIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// Client shell that makes one matchday section on /matches collapsible. The
// match rows are rendered on the server and handed in as `children`, so the
// only client-side concern here is the open/closed state, its persistence, and
// the disclosure semantics on the day header.
//
// Initial render uses `defaultOpen` (derived server-side from match statuses)
// so SSR and the first client render agree — no hydration mismatch. After
// mount we reconcile to any per-day choice the user previously stored.

const STORAGE_PREFIX = "matches:day-collapsed:";

function storageKey(dayKey: string) {
  return `${STORAGE_PREFIX}${dayKey}`;
}

// All storage access is best-effort: private mode / disabled storage must not
// break the list, it just means the choice doesn't persist.
function readStoredCollapsed(dayKey: string): boolean | null {
  try {
    const raw = window.localStorage.getItem(storageKey(dayKey));
    if (raw === "1") return true;
    if (raw === "0") return false;
    return null;
  } catch {
    return null;
  }
}

function writeStoredCollapsed(dayKey: string, collapsed: boolean) {
  try {
    window.localStorage.setItem(storageKey(dayKey), collapsed ? "1" : "0");
  } catch {
    // ignore — feature degrades to per-session
  }
}

export function MatchDaySection({
  dayKey,
  defaultOpen,
  matchday,
  dateNode,
  countLabel,
  expandLabel,
  collapseLabel,
  children,
}: {
  dayKey: string;
  defaultOpen: boolean;
  matchday: string;
  dateNode: React.ReactNode;
  countLabel: string;
  expandLabel: string;
  collapseLabel: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  const regionId = React.useId();

  // One-shot post-mount reconcile: the server renders the status-derived
  // default (so SSR and first client render agree, no hydration mismatch),
  // then we swap in the visitor's stored per-day choice if there is one.
  React.useEffect(() => {
    const stored = readStoredCollapsed(dayKey);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored !== null) setOpen(!stored);
  }, [dayKey]);

  function toggle() {
    setOpen((prev) => {
      const next = !prev;
      writeStoredCollapsed(dayKey, !next);
      return next;
    });
  }

  return (
    <section>
      <h2 className="border-border bg-background/85 supports-[backdrop-filter]:bg-background/70 sticky top-[3.3rem] z-10 -mx-4 mb-3 border-b backdrop-blur md:top-[3.55rem]">
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-controls={regionId}
          className="hover:bg-muted/40 focus-visible:ring-ring flex w-full items-baseline gap-3 px-4 py-2 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset"
        >
          <span className="text-muted-foreground font-mono text-[10px] font-semibold tracking-[0.24em] uppercase">
            {matchday}
          </span>
          <span aria-hidden className="bg-border h-px flex-1 self-center" />
          <span className="font-heading text-foreground min-w-0 truncate text-sm font-semibold tracking-tight">
            {dateNode}
          </span>
          <span className="text-muted-foreground shrink-0 font-mono text-[10px] tabular-nums">
            {countLabel}
          </span>
          <ChevronDownIcon
            aria-hidden
            className={cn(
              "text-muted-foreground/70 size-4 shrink-0 self-center transition-transform duration-200 motion-reduce:transition-none",
              open ? "" : "-rotate-90",
            )}
          />
          <span className="sr-only">{open ? collapseLabel : expandLabel}</span>
        </button>
      </h2>
      <div id={regionId} hidden={!open}>
        {children}
      </div>
    </section>
  );
}
