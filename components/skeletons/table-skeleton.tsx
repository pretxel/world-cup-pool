import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

// Mirrors LeaderboardTable's container, columns and responsive `hidden
// sm:table-cell` behavior so the skeleton occupies the same width at every
// breakpoint. `rows` should match the real board's default count (10 overall /
// quiz, 4 group board) to avoid a height jump.
export function TableSkeleton({
  rows = 10,
  className,
}: {
  rows?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-card",
        className,
      )}
    >
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead className="w-14 pl-4">
              <Skeleton className="h-2.5 w-8" />
            </TableHead>
            <TableHead>
              <Skeleton className="h-2.5 w-16" />
            </TableHead>
            <TableHead className="text-right">
              <Skeleton className="ml-auto h-2.5 w-12" />
            </TableHead>
            <TableHead className="hidden text-right sm:table-cell">
              <Skeleton className="ml-auto h-2.5 w-10" />
            </TableHead>
            <TableHead className="hidden pr-4 text-right sm:table-cell">
              <Skeleton className="ml-auto h-2.5 w-10" />
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: rows }).map((_, i) => (
            <TableRow key={i} className="hover:bg-transparent">
              <TableCell className="pl-4">
                <Skeleton className="h-7 w-8 rounded-md" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-4 w-32 max-w-[55%]" />
              </TableCell>
              <TableCell className="text-right">
                <Skeleton className="ml-auto h-4 w-8" />
              </TableCell>
              <TableCell className="hidden text-right sm:table-cell">
                <Skeleton className="ml-auto h-4 w-6" />
              </TableCell>
              <TableCell className="hidden pr-4 text-right sm:table-cell">
                <Skeleton className="ml-auto h-4 w-6" />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
