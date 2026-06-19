import { Skeleton } from "@/components/ui/skeleton";

// Param-agnostic head-to-head fallback (max-w-3xl): eyebrow + heading, the
// two-column "VS" scoreboard, then the share row and CTA. Mirrors the dark
// scoreboard styling used by the page so the swap-in is seamless.
const bar = "bg-pitch-foreground/15";

export default function H2HLoading() {
  return (
    <main
      role="status"
      aria-busy="true"
      aria-live="off"
      className="mx-auto max-w-3xl px-4 py-8 sm:py-10"
    >
      <span className="sr-only">Loading</span>
      <Skeleton className="h-3 w-40" />
      <Skeleton className="mt-2 h-8 w-3/4 sm:h-9" />

      <section className="bg-scoreboard text-pitch-foreground ring-pitch/30 relative mt-5 overflow-hidden rounded-2xl shadow-[0_30px_70px_-30px_rgba(0,0,0,0.45)] ring-1">
        <div className="bg-pitch-stripes pointer-events-none absolute inset-0 opacity-[0.12]" />
        <div className="bg-grain pointer-events-none absolute inset-0" />
        <div className="relative grid grid-cols-[1fr_auto_1fr] items-stretch">
          <div className="flex flex-col items-center gap-3 px-4 py-6">
            <Skeleton className={`h-14 w-20 ${bar}`} />
            <Skeleton className={`h-6 w-28 ${bar}`} />
            <Skeleton className={`h-8 w-32 ${bar}`} />
            <Skeleton className={`h-3 w-20 ${bar}`} />
          </div>
          <div className="flex items-center justify-center px-2">
            <Skeleton className={`h-8 w-10 ${bar}`} />
          </div>
          <div className="flex flex-col items-center gap-3 px-4 py-6">
            <Skeleton className={`h-14 w-20 ${bar}`} />
            <Skeleton className={`h-6 w-28 ${bar}`} />
            <Skeleton className={`h-8 w-32 ${bar}`} />
            <Skeleton className={`h-3 w-20 ${bar}`} />
          </div>
        </div>
      </section>

      <Skeleton className="mt-8 h-3 w-40" />
      <Skeleton className="mt-3 h-8 w-64" />
      <Skeleton className="mt-8 h-10 w-40" />
    </main>
  );
}
