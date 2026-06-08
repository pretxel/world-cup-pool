// Pure, DB-free pagination math. Kept here so the clamp/boundary logic is
// unit-testable away from the page that uses it (mirrors lib/scoring.ts etc).

export const PAGE_SIZE = 5;

export interface PageInfo {
  page: number;
  totalPages: number;
  start: number;
  end: number;
}

// Clamp a requested page into 1…totalPages (always ≥ 1, even for 0 items) and
// return the slice bounds. A page below 1, above the last page, or non-finite
// resolves to the nearest valid page rather than erroring.
export function paginate(
  totalItems: number,
  requestedPage: number,
  pageSize: number = PAGE_SIZE,
): PageInfo {
  const items = Math.max(0, Math.floor(totalItems));
  const totalPages = Math.max(1, Math.ceil(items / pageSize));
  const safe = Number.isFinite(requestedPage) ? Math.floor(requestedPage) : 1;
  const page = Math.min(Math.max(1, safe), totalPages);
  const start = (page - 1) * pageSize;
  const end = Math.min(start + pageSize, items);
  return { page, totalPages, start, end };
}

// Parse a raw query value (string | string[] | undefined) to a positive page
// integer. Missing / non-numeric / ≤ 0 → 1; the upper bound is clamped later in
// paginate() once the item count is known.
export function parsePageParam(raw: string | string[] | undefined): number {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const n = Number.parseInt(value ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}
