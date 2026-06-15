## 1. Foundation primitives

- [x] 1.1 Create `components/ui/skeleton.tsx`: base `<Skeleton>` (div, `bg-muted`, `rounded-md`, `motion-safe:animate-pulse`, `aria-hidden`, `className` passthrough via `cn`).
- [x] 1.2 Create `components/skeletons/page-skeleton-shell.tsx`: `<main className="mx-auto max-w-4xl px-4 py-10">` wrapper + standard header (eyebrow/h1/lede bars) wrapped in a single `role="status"` / `aria-busy="true"` region with an sr-only "Loading" label; accept `children` and an optional right-slot prop for the header.
- [x] 1.3 Create `components/skeletons/text-lines-skeleton.tsx`: N stacked lines with an optional decreasing-width (shorter last line) option.
- [x] 1.4 Manually verify pulse + reduced-motion behavior (confirm `globals.css` reduced-motion suppresses the `motion-safe` pulse).

## 2. Composed shared skeletons

- [x] 2.1 Create `components/skeletons/table-skeleton.tsx` mirroring `LeaderboardTable` container + columns (incl. `hidden sm:table-cell`), configurable `rowCount`.
- [x] 2.2 Create `components/skeletons/list-rows-skeleton.tsx`: bordered rounded container with divided rows; configurable leading-slot/primary/trailing geometry and `rowCount`.
- [x] 2.3 Create `components/skeletons/card-grid-skeleton.tsx`: responsive grid (`cols` prop), configurable `count`, optional image-area/footer.
- [x] 2.4 Create `components/skeletons/scoreboard-skeleton.tsx`: pitch-colored card with `variant="match-vs" | "single-stat"`.
- [x] 2.5 Create `components/skeletons/stat-cards-skeleton.tsx`: 3-col stat grid composition.

## 3. High-priority public routes

- [x] 3.1 Add `app/[locale]/(public)/leaderboard/loading.tsx` (PageSkeletonShell + right-aligned pitch leader-card slot + TableSkeleton rows=10).
- [x] 3.2 Add `app/[locale]/(public)/matches/loading.tsx` (shell + filter-bar placeholder + 2–3 day sections of ListRowsSkeleton).
- [x] 3.3 Add `app/[locale]/(public)/matches/[matchId]/loading.tsx` (back-link bar + ScoreboardSkeleton `match-vs` + prediction block placeholder).
- [x] 3.4 Add `app/[locale]/(public)/quiz/loading.tsx` (shell + StatCardsSkeleton(3) + question card with 4 option-button placeholders + 10-row board).

## 4. High-priority app routes (render after the (app) auth gate)

- [x] 4.1 Add `app/[locale]/(app)/groups/loading.tsx` (shell + 2-col form CardGridSkeleton + ListRowsSkeleton rows=4).
- [x] 4.2 Add `app/[locale]/(app)/groups/[id]/loading.tsx` (back-link + header + TableSkeleton rows=4 + members ListRowsSkeleton rows=5 + controls placeholder).
- [x] 4.3 Add `app/[locale]/(app)/my-picks/loading.tsx` (shell + StatCardsSkeleton(3) + predictions ListRowsSkeleton rows=5 + pagination placeholder).

## 5. Medium-priority routes

- [x] 5.1 Add `app/[locale]/(public)/news/loading.tsx` (shell + CardGridSkeleton cols 1/2/3, count=6, withImage).
- [x] 5.2 Add `app/[locale]/(public)/share/pick/[matchId]/loading.tsx` (centered max-w-3xl + ScoreboardSkeleton `match-vs` + CTA placeholder).
- [x] 5.3 Add `app/[locale]/(public)/share/quiz/[userId]/loading.tsx` (centered + ScoreboardSkeleton `single-stat` streak + 2-col stat grid + CTA).
- [x] 5.4 Add `app/[locale]/(public)/share/rank/[userId]/loading.tsx` (centered + ScoreboardSkeleton `single-stat` rank + 2-col stat grid + CTA).
- [x] 5.5 Add `app/[locale]/(app)/groups/join/[code]/loading.tsx` (back-link + centered narrow card placeholder).
- [x] 5.6 Add `app/[locale]/(admin)/admin/loading.tsx` (header + 2-col status CardGridSkeleton + 3-col link CardGridSkeleton).
- [x] 5.7 Add `app/[locale]/(admin)/admin/competitions/loading.tsx` (header + New-button slot + 6 status-card list rows).

## 6. Low-priority admin routes (optional)

- [x] 6.1 Add `app/[locale]/(admin)/admin/matches/loading.tsx` (header + sync card + new-fixture form + 8 fixture rows).
- [x] 6.2 Add `app/[locale]/(admin)/admin/quiz/loading.tsx` (header + resend card + new-question form + 5 question cards).

## 7. Verification & polish

- [x] 7.1 For each route, compare skeleton vs resolved page at mobile/sm/lg to confirm negligible layout shift (header rhythm, table column widths, scoreboard geometry, row counts).
- [x] 7.2 Confirm reduced-motion: skeletons render static under `prefers-reduced-motion: reduce`.
- [x] 7.3 Confirm a11y: each fallback exposes one `role="status"`/`aria-busy` region with an sr-only label and that individual `Skeleton` bars are `aria-hidden`.
- [x] 7.4 Confirm no `loading.tsx` imports `getTranslations` / reads `params`; verify the `[locale]` shell stays visible during the fallback.
- [x] 7.5 Run lint + build to ensure all `loading.tsx` are valid server components with no client-only imports.
