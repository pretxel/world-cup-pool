import { PageSkeletonShell } from "@/components/skeletons/page-skeleton-shell";
import { CardGridSkeleton } from "@/components/skeletons/card-grid-skeleton";

// Mirrors the news index (max-w-6xl): header + the first page of the article
// card grid (1/2/3 columns). Infinite-scroll loading is client-side and not
// part of this fallback.
export default function NewsLoading() {
  return (
    <PageSkeletonShell className="max-w-6xl">
      <CardGridSkeleton count={6} cols={3} withImage withFooter />
    </PageSkeletonShell>
  );
}
