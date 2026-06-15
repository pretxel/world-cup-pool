import { PageSkeletonShell } from "@/components/skeletons/page-skeleton-shell";
import { Skeleton } from "@/components/ui/skeleton";

// Mirrors the groups index (max-w-3xl): header, the 2-up create/join form
// cards, then the "your groups" list of rounded rows.
export default function GroupsLoading() {
  return (
    <PageSkeletonShell className="max-w-3xl">
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <section
            key={i}
            className="rounded-xl border border-border bg-card p-4"
          >
            <Skeleton className="mb-3 h-5 w-28" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="mt-2 h-9 w-full" />
          </section>
        ))}
      </div>

      <section className="mt-8">
        <Skeleton className="mb-3 h-3 w-28" />
        <ul className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <li
              key={i}
              className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3"
            >
              <div className="min-w-0 space-y-1.5">
                <Skeleton className="h-4 w-40 max-w-[60%]" />
                <Skeleton className="h-3 w-20" />
              </div>
              <Skeleton className="size-4 shrink-0" />
            </li>
          ))}
        </ul>
      </section>
    </PageSkeletonShell>
  );
}
