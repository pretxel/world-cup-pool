"use client";

import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

// Shared URL-rewrite primitive for the /matches filter controls (team chips,
// status stats, needs-pick toggle). Applies a batch of query-param updates
// (null deletes the key) while preserving the locale path prefix and any
// unrelated params. Mirrors the navigation pattern in language-switcher.tsx.
export function useQueryParamWriter() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = React.useTransition();

  return React.useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null) params.delete(key);
        else params.set(key, value);
      }
      const qs = params.toString();
      startTransition(() => {
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      });
    },
    [router, pathname, searchParams],
  );
}
