import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

// Bordered, rounded container of divided placeholder rows. Covers match-day
// lists, group lists, members lists, admin lists and the my-picks predictions
// list. Row padding matches the app's `px-4 py-3.5` row rhythm.
export function ListRowsSkeleton({
  rows = 5,
  leading = true,
  twoLine = true,
  trailing = true,
  className,
}: {
  rows?: number;
  leading?: boolean;
  twoLine?: boolean;
  trailing?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "divide-y divide-border overflow-hidden rounded-xl border border-border bg-card",
        className,
      )}
    >
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3.5">
          {leading ? (
            <Skeleton className="size-9 shrink-0 rounded-full" />
          ) : null}
          <div className="min-w-0 flex-1 space-y-1.5">
            <Skeleton className="h-4 w-40 max-w-[60%]" />
            {twoLine ? <Skeleton className="h-3 w-24 max-w-[40%]" /> : null}
          </div>
          {trailing ? <Skeleton className="h-4 w-12 shrink-0" /> : null}
        </div>
      ))}
    </div>
  );
}
