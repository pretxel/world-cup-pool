import { Skeleton } from "@/components/ui/skeleton";

// Mirrors the admin competitions list: page header with a "New" action, then
// the stack of competition status cards.
export default function AdminCompetitionsLoading() {
  return (
    <main
      role="status"
      aria-busy="true"
      aria-live="off"
      className="mx-auto max-w-4xl px-4 py-10"
    >
      <span className="sr-only">Loading</span>
      <div className="space-y-8">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-72 max-w-full" />
          </div>
          <Skeleton className="h-9 w-24 shrink-0" />
        </div>

        <ul className="grid gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <li
              key={i}
              className="rounded-xl bg-card p-4 ring-1 ring-foreground/10"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-2">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <div className="flex gap-2">
                  <Skeleton className="h-8 w-20" />
                  <Skeleton className="h-8 w-16" />
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
