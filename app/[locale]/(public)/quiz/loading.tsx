import { PageSkeletonShell } from "@/components/skeletons/page-skeleton-shell";
import { StatCardsSkeleton } from "@/components/skeletons/stat-cards-skeleton";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// Mirrors the daily quiz (max-w-2xl): header, 3 stat cards (signed-in
// happy-path), the question card with 4 option buttons, then the 10-row board.
export default function QuizLoading() {
  return (
    <PageSkeletonShell className="max-w-2xl">
      <StatCardsSkeleton count={3} className="mb-8" />

      <section className="mb-12">
        <div className="rounded-2xl border border-border bg-card p-5">
          <Skeleton className="h-2.5 w-28" />
          <Skeleton className="mt-2 mb-4 h-6 w-3/4" />
          <div className="space-y-2.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        </div>
      </section>

      <section>
        <Skeleton className="mb-3 h-3 w-32" />
        <ol className="overflow-hidden rounded-xl border border-border bg-card">
          {Array.from({ length: 10 }).map((_, i) => (
            <li
              key={i}
              className={cn(
                "flex items-center gap-3 px-4 py-2.5",
                i !== 0 && "border-t border-border",
              )}
            >
              <Skeleton className="h-4 w-6 shrink-0" />
              <Skeleton className="h-4 w-40 max-w-[55%] flex-1" />
              <Skeleton className="h-4 w-8 shrink-0" />
            </li>
          ))}
        </ol>
      </section>
    </PageSkeletonShell>
  );
}
