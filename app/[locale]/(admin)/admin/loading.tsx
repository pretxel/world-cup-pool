import { CardGridSkeleton } from "@/components/skeletons/card-grid-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

// Mirrors the admin dashboard: page header, the 2-up status cards, then the
// 3-up quick-link cards. Renders after the (admin) is_admin gate resolves.
export default function AdminDashboardLoading() {
  return (
    <main
      role="status"
      aria-busy="true"
      aria-live="off"
      className="mx-auto max-w-4xl px-4 py-10"
    >
      <span className="sr-only">Loading</span>
      <div className="space-y-8">
        <div className="space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl bg-card p-4 ring-1 ring-foreground/10"
            >
              <Skeleton className="h-3 w-20" />
              <Skeleton className="mt-2 h-6 w-40" />
              <Skeleton className="mt-3 h-3 w-32" />
            </div>
          ))}
        </div>

        <section className="space-y-3">
          <Skeleton className="h-3 w-28" />
          <CardGridSkeleton count={3} cols={3} bodyLines={2} />
        </section>
      </div>
    </main>
  );
}
