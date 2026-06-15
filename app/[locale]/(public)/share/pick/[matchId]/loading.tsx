import { ScoreboardSkeleton } from "@/components/skeletons/scoreboard-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

// Param-agnostic shared-pick fallback (max-w-3xl): eyebrow + heading, the
// match-vs scoreboard, then the CTA button.
export default function SharePickLoading() {
  return (
    <main
      role="status"
      aria-busy="true"
      aria-live="off"
      className="mx-auto max-w-3xl px-4 py-8 sm:py-10"
    >
      <span className="sr-only">Loading</span>
      <Skeleton className="h-3 w-40" />
      <Skeleton className="mt-2 h-8 w-3/4 sm:h-9" />
      <ScoreboardSkeleton variant="match-vs" className="mt-5" />
      <Skeleton className="mt-8 h-10 w-40" />
    </main>
  );
}
