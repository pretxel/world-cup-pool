import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// Presentational prev/next + "Page X of Y" pager. Server component (link-based,
// no client JS). Renders nothing when there is one page or fewer. Labels are
// passed in already-translated so the component stays i18n-agnostic.
export function PaginationControls({
  page,
  totalPages,
  basePath,
  navLabel,
  positionLabel,
  prevLabel,
  nextLabel,
}: {
  page: number;
  totalPages: number;
  basePath: string;
  navLabel: string;
  positionLabel: string;
  prevLabel: string;
  nextLabel: string;
}) {
  if (totalPages <= 1) return null;

  const hasPrev = page > 1;
  const hasNext = page < totalPages;
  const hrefFor = (n: number) => `${basePath}?page=${n}`;

  return (
    <nav
      aria-label={navLabel}
      className="mt-4 flex items-center justify-between gap-3"
    >
      <PagerLink
        href={hasPrev ? hrefFor(page - 1) : undefined}
        label={prevLabel}
        direction="prev"
      />
      <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground tabular-nums">
        {positionLabel}
      </span>
      <PagerLink
        href={hasNext ? hrefFor(page + 1) : undefined}
        label={nextLabel}
        direction="next"
      />
    </nav>
  );
}

function PagerLink({
  href,
  label,
  direction,
}: {
  href: string | undefined;
  label: string;
  direction: "prev" | "next";
}) {
  const Icon = direction === "prev" ? ChevronLeftIcon : ChevronRightIcon;
  const content = (
    <>
      {direction === "prev" ? <Icon className="size-3.5" aria-hidden /> : null}
      {label}
      {direction === "next" ? <Icon className="size-3.5" aria-hidden /> : null}
    </>
  );
  const base =
    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-heading text-xs font-medium tracking-tight transition-colors";

  if (!href) {
    return (
      <span
        aria-disabled="true"
        className={cn(
          base,
          "cursor-not-allowed border-border bg-muted/40 text-muted-foreground/50",
        )}
      >
        {content}
      </span>
    );
  }

  return (
    <Link
      href={href}
      aria-label={label}
      className={cn(
        base,
        "border-border bg-card text-foreground hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      {content}
    </Link>
  );
}
