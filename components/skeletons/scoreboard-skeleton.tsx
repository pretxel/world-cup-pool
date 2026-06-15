import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

// Bars sit on the dark pitch-colored scoreboard, so they use a light tint
// instead of the default `bg-muted` (cn/twMerge lets the later bg utility win).
const bar = "bg-pitch-foreground/15";

// Mirrors the dark scoreboard card shared by the match-detail page (variant
// "match-vs": stage badge, 3-column home/score/away, kickoff+venue footer) and
// the share/rank + share/quiz pages (variant "single-stat": label, big number,
// name, and a 2-column stat footer). Param-agnostic — usable from any dynamic
// route's loading.tsx.
export function ScoreboardSkeleton({
  variant = "match-vs",
  className,
}: {
  variant?: "match-vs" | "single-stat";
  className?: string;
}) {
  return (
    <section
      aria-hidden
      className={cn(
        "bg-scoreboard relative overflow-hidden rounded-2xl text-pitch-foreground ring-1 ring-pitch/30 shadow-[0_30px_70px_-30px_rgba(0,0,0,0.45)]",
        className,
      )}
    >
      <div className="bg-pitch-stripes pointer-events-none absolute inset-0 opacity-[0.12]" />
      <div className="bg-grain pointer-events-none absolute inset-0" />

      {variant === "match-vs" ? (
        <>
          <div className="relative px-6 pt-5 pb-2">
            <Skeleton className={cn("h-5 w-44", bar)} />
          </div>
          <div className="relative flex flex-col gap-3 px-6 pt-3 pb-6 sm:grid sm:grid-cols-[1fr_auto_1fr] sm:items-center sm:gap-6 sm:px-8">
            <div className="flex items-center gap-2 sm:gap-3">
              <Skeleton className={cn("size-8 shrink-0 rounded-full", bar)} />
              <Skeleton className={cn("h-8 w-28 sm:h-10 sm:w-36", bar)} />
            </div>
            <Skeleton className={cn("h-9 w-10 sm:h-12 sm:w-14", bar)} />
            <div className="flex items-center gap-2 sm:justify-end sm:gap-3">
              <Skeleton className={cn("h-8 w-28 sm:h-10 sm:w-36", bar)} />
              <Skeleton className={cn("size-8 shrink-0 rounded-full", bar)} />
            </div>
          </div>
          <div className="relative flex items-center justify-between gap-2 border-t border-pitch-foreground/15 bg-black/10 px-6 py-3">
            <Skeleton className={cn("h-3 w-44", bar)} />
            <Skeleton className={cn("h-3 w-24", bar)} />
          </div>
        </>
      ) : (
        <>
          <div className="relative flex flex-col items-center gap-2 px-6 pt-7 pb-3 sm:pt-9">
            <Skeleton className={cn("h-3 w-16", bar)} />
            <Skeleton className={cn("h-14 w-28 sm:h-16 sm:w-32", bar)} />
            <Skeleton className={cn("mt-1 h-7 w-40", bar)} />
            <Skeleton className={cn("h-3 w-24", bar)} />
          </div>
          <div className="relative grid grid-cols-2 border-t border-pitch-foreground/15 bg-black/10">
            <div className="flex flex-col items-center gap-2 px-6 py-4">
              <Skeleton className={cn("h-8 w-12", bar)} />
              <Skeleton className={cn("h-3 w-14", bar)} />
            </div>
            <div className="flex flex-col items-center gap-2 border-l border-pitch-foreground/15 px-6 py-4">
              <Skeleton className={cn("h-8 w-12", bar)} />
              <Skeleton className={cn("h-3 w-14", bar)} />
            </div>
          </div>
        </>
      )}
    </section>
  );
}
