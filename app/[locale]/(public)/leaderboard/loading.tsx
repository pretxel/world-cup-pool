import { PageSkeletonShell } from "@/components/skeletons/page-skeleton-shell";
import { TableSkeleton } from "@/components/skeletons/table-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

// Mirrors the overall leaderboard: standard header + the pitch-colored leader
// card on the right, then the 10-row ranking table.
export default function LeaderboardLoading() {
  return (
    <PageSkeletonShell
      headerRight={
        <div className="rounded-xl border border-pitch/30 bg-pitch px-4 py-3 shadow-sm">
          <Skeleton className="h-2.5 w-16 bg-pitch-foreground/20" />
          <Skeleton className="mt-1.5 h-5 w-28 bg-pitch-foreground/20" />
          <Skeleton className="mt-1.5 h-2.5 w-24 bg-pitch-foreground/20" />
        </div>
      }
    >
      <TableSkeleton rows={10} />
    </PageSkeletonShell>
  );
}
