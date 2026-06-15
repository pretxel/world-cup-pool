import { ScoreboardSkeleton } from "@/components/skeletons/scoreboard-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

// Param-agnostic match-detail fallback: back-link bar, the pitch scoreboard
// (home/score/away), then the prediction block placeholder. Uses the same
// `max-w-3xl` wrapper as the real page.
export default function MatchDetailLoading() {
  return (
    <main
      role="status"
      aria-busy="true"
      aria-live="off"
      className="mx-auto max-w-3xl px-4 py-8 sm:py-10"
    >
      <span className="sr-only">Loading</span>
      <Skeleton className="h-4 w-24" />
      <ScoreboardSkeleton variant="match-vs" className="mt-5" />
      <section className="mt-8">
        <Skeleton className="mb-3 h-6 w-40" />
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="grid grid-cols-2 gap-3">
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
          </div>
          <Skeleton className="mt-4 h-10 w-full" />
        </div>
      </section>
    </main>
  );
}
