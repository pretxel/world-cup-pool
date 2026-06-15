import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

// N stacked shimmer lines for ledes, summaries and descriptions. The last line
// is shortened by default to read like a paragraph rather than a block.
export function TextLinesSkeleton({
  lines = 3,
  className,
  lineClassName,
  shrinkLast = true,
}: {
  lines?: number;
  className?: string;
  lineClassName?: string;
  shrinkLast?: boolean;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn(
            "h-4 w-full",
            shrinkLast && i === lines - 1 && "w-2/3",
            lineClassName,
          )}
        />
      ))}
    </div>
  );
}
