import { PageSkeletonShell } from "@/components/skeletons/page-skeleton-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// Mirrors the matches list: header with a status-filter pill row, a team-filter
// row, then 2 day sections of match rows (time | stage/status badges | teams |
// chevron) at the real `px-4 py-3.5` row rhythm.
const DAY_SECTIONS = [5, 4];

export default function MatchesLoading() {
  return (
    <PageSkeletonShell
      headerRight={
        <div className="flex flex-wrap gap-1.5">
          <Skeleton className="h-7 w-20 rounded-full" />
          <Skeleton className="h-7 w-16 rounded-full" />
          <Skeleton className="h-7 w-16 rounded-full" />
        </div>
      }
    >
      <div className="mb-6 flex flex-wrap gap-1.5">
        <Skeleton className="h-7 w-14 rounded-full" />
        <Skeleton className="h-7 w-20 rounded-full" />
        <Skeleton className="h-7 w-24 rounded-full" />
        <Skeleton className="h-7 w-16 rounded-full" />
      </div>

      <div className="space-y-12">
        {DAY_SECTIONS.map((count, s) => (
          <div key={s} className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-28" />
              </div>
              <Skeleton className="h-4 w-16" />
            </div>
            <ul className="overflow-hidden rounded-xl border border-border bg-card">
              {Array.from({ length: count }).map((_, i) => (
                <li
                  key={i}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3.5 sm:gap-4",
                    i !== 0 && "border-t border-border",
                  )}
                >
                  <Skeleton className="h-5 w-10 shrink-0" />
                  <div
                    aria-hidden
                    className="hidden h-10 w-px bg-border sm:block"
                  />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <Skeleton className="h-3.5 w-32" />
                    <div className="flex items-center gap-2">
                      <Skeleton className="size-4 shrink-0 rounded-full" />
                      <Skeleton className="h-5 w-24 max-w-[30%]" />
                      <Skeleton className="size-4 shrink-0 rounded-full" />
                      <Skeleton className="h-5 w-24 max-w-[30%]" />
                    </div>
                  </div>
                  <Skeleton className="size-4 shrink-0" />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </PageSkeletonShell>
  );
}
