import { PageSkeletonShell } from "@/components/skeletons/page-skeleton-shell";
import { StatCardsSkeleton } from "@/components/skeletons/stat-cards-skeleton";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// Mirrors my-picks: header with 3 stat cards, the paginated predictions list
// (PAGE_SIZE = 5 rows), then the pagination controls.
export default function MyPicksLoading() {
  return (
    <PageSkeletonShell
      headerRight={<StatCardsSkeleton count={3} className="gap-2 sm:gap-3" />}
    >
      <ul className="overflow-hidden rounded-xl border border-border bg-card">
        {Array.from({ length: 5 }).map((_, i) => (
          <li
            key={i}
            className={cn(
              "grid items-center gap-3 px-4 py-3.5 sm:grid-cols-[1fr_auto] sm:gap-4",
              i !== 0 && "border-t border-border",
            )}
          >
            <div className="min-w-0 space-y-1.5">
              <Skeleton className="h-3 w-28" />
              <div className="flex items-center gap-1.5">
                <Skeleton className="size-4 shrink-0 rounded-full" />
                <Skeleton className="h-5 w-20 max-w-[28%]" />
                <Skeleton className="size-4 shrink-0 rounded-full" />
                <Skeleton className="h-5 w-20 max-w-[28%]" />
              </div>
              <Skeleton className="h-3 w-24" />
            </div>
            <div className="flex items-center gap-3 justify-self-end">
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-4 w-10" />
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-6 flex items-center justify-between">
        <Skeleton className="h-9 w-20" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-9 w-20" />
      </div>
    </PageSkeletonShell>
  );
}
