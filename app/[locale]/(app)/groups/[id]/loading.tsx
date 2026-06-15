import { TableSkeleton } from "@/components/skeletons/table-skeleton";
import { ListRowsSkeleton } from "@/components/skeletons/list-rows-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

// Param-agnostic group-detail fallback (max-w-3xl): back-link, group header,
// invite-share bar, the 4-row board table, the members list, and the controls.
export default function GroupDetailLoading() {
  return (
    <main
      role="status"
      aria-busy="true"
      aria-live="off"
      className="mx-auto max-w-3xl px-4 py-10"
    >
      <span className="sr-only">Loading</span>
      <Skeleton className="mb-4 h-4 w-28" />

      <header className="mb-6 flex flex-col gap-2 border-b border-border pb-6">
        <Skeleton className="h-8 w-48 sm:h-9 sm:w-56" />
        <Skeleton className="h-4 w-24" />
      </header>

      <Skeleton className="h-10 w-full rounded-xl" />

      <section className="mt-8">
        <Skeleton className="mb-3 h-3 w-24" />
        <TableSkeleton rows={4} />
      </section>

      <section className="mt-8">
        <Skeleton className="mb-3 h-3 w-24" />
        <ListRowsSkeleton rows={5} leading={false} twoLine={false} />
      </section>

      <section className="mt-8 flex flex-col gap-4 border-t border-border pt-6">
        <Skeleton className="h-10 w-full" />
        <div className="flex items-center justify-between gap-3">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-9 w-24" />
        </div>
      </section>
    </main>
  );
}
