import { Skeleton } from "@/components/ui/skeleton";

// Param-agnostic join-invite fallback (max-w-md, centered): back-link, then the
// invite card (icon, eyebrow, group-name heading, body, confirm button).
export default function JoinGroupLoading() {
  return (
    <main
      role="status"
      aria-busy="true"
      aria-live="off"
      className="mx-auto flex max-w-md flex-col px-4 py-16"
    >
      <span className="sr-only">Loading</span>
      <Skeleton className="mb-6 h-4 w-28" />
      <div className="rounded-2xl border border-border bg-card p-6">
        <Skeleton className="mx-auto size-12 rounded-full" />
        <Skeleton className="mx-auto mt-4 h-3 w-28" />
        <Skeleton className="mx-auto mt-2 h-7 w-40" />
        <Skeleton className="mx-auto mt-2 h-4 w-48 max-w-full" />
        <Skeleton className="mt-6 h-10 w-full" />
      </div>
    </main>
  );
}
