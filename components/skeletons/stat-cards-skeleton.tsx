import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

// Compact grid of stat-card placeholders (label line + large number) matching
// the quiz stats grid and the my-picks header stat cards.
export function StatCardsSkeleton({
  count = 3,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid gap-3",
        count === 2 ? "grid-cols-2" : "grid-cols-3",
        className,
      )}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-border bg-card px-4 py-3"
        >
          <Skeleton className="h-2.5 w-12" />
          <Skeleton className="mt-2 h-7 w-10" />
        </div>
      ))}
    </div>
  );
}
