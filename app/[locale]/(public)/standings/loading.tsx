import { PageSkeletonShell } from "@/components/skeletons/page-skeleton-shell";
import { Skeleton } from "@/components/ui/skeleton";

// Mirrors /standings: the standard eyebrow/headline/lede header, then a
// responsive grid (1 col → 2 cols at lg) of group tables. Each card is a
// titled header row plus four team rows at the real `px-3 py-2` rhythm.
const GROUP_CARDS = 6;
const TEAM_ROWS = 4;

export default function StandingsLoading() {
  return (
    <PageSkeletonShell>
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: GROUP_CARDS }).map((_, c) => (
          <div
            key={c}
            className="overflow-hidden rounded-xl border border-border bg-card"
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-3 w-16" />
            </div>
            <div className="divide-y divide-border/60">
              {Array.from({ length: TEAM_ROWS }).map((_, r) => (
                <div
                  key={r}
                  className="flex items-center gap-2 px-3 py-2"
                >
                  <Skeleton className="size-4 shrink-0 rounded-full" />
                  <Skeleton className="h-4 w-28 max-w-[40%]" />
                  <div className="ml-auto flex items-center gap-3">
                    <Skeleton className="h-4 w-4" />
                    <Skeleton className="h-4 w-6" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </PageSkeletonShell>
  );
}
