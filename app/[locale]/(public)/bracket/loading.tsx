import { PageSkeletonShell } from "@/components/skeletons/page-skeleton-shell";
import { Skeleton } from "@/components/ui/skeleton";

// Mirrors /bracket: standard header, then horizontally-laid-out round columns
// (R32 → final) with shrinking match counts per column.
const COLUMNS = [8, 4, 2, 1, 1];

export default function BracketLoading() {
  return (
    <PageSkeletonShell className="max-w-6xl">
      <div className="overflow-hidden">
        <div className="flex gap-3 sm:gap-4">
          {COLUMNS.map((count, c) => (
            <div key={c} className="flex w-52 flex-col justify-around gap-3 sm:w-56">
              <Skeleton className="h-3 w-16" />
              {Array.from({ length: count }).map((_, i) => (
                <div
                  key={i}
                  className="overflow-hidden rounded-lg border border-border bg-card"
                >
                  <div className="flex items-center gap-2 px-2.5 py-2">
                    <Skeleton className="size-4 shrink-0 rounded-[2px]" />
                    <Skeleton className="h-4 w-24 max-w-[60%]" />
                  </div>
                  <div className="h-px bg-border/60" />
                  <div className="flex items-center gap-2 px-2.5 py-2">
                    <Skeleton className="size-4 shrink-0 rounded-[2px]" />
                    <Skeleton className="h-4 w-20 max-w-[55%]" />
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </PageSkeletonShell>
  );
}
