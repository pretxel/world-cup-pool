import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// Mirrors the admin fixtures page: header, the sync card (with stat grid), the
// new-fixture form, then the fixture rows.
export default function AdminMatchesLoading() {
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
          <Skeleton className="h-8 w-52" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>

        <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-3 w-56 max-w-full" />
            </div>
            <Skeleton className="h-9 w-24 shrink-0" />
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <Skeleton className="h-3 w-10" />
                <Skeleton className="h-5 w-8" />
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl bg-card p-4 ring-1 ring-foreground/10">
          <Skeleton className="h-5 w-40" />
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </div>
          <Skeleton className="mt-4 h-10 w-32" />
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-card">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "flex items-center gap-4 px-4 py-3.5",
                i !== 0 && "border-t border-border",
              )}
            >
              <Skeleton className="h-5 w-24 shrink-0" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-4 w-48 max-w-[60%]" />
              </div>
              <Skeleton className="h-8 w-16 shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
