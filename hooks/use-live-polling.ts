"use client";

import * as React from "react";

export type UseLivePollingOptions<T> = {
  // Seed value, typically server-rendered, so the first paint has data.
  initialData: T;
  // Endpoint to poll. Changing it is picked up without restarting the loop.
  url: string;
  intervalMs: number;
  // Stop scheduling further polls when this returns true for the latest data
  // (e.g. a match reached `final`). Re-evaluated on every fetch and re-armed
  // when the tab regains focus.
  stopWhen: (data: T) => boolean;
  // When false, the loop never runs (still returns `initialData`).
  enabled?: boolean;
  // Side effect on each successful poll, after state is updated.
  onData?: (data: T) => void;
};

// Shared smart-polling loop: visibility pause/resume, immediate refetch when
// the tab regains focus, idle stop via `stopWhen`, and in-flight cancel on
// unmount. Used by both the landing <LiveMatchList/> and the match-detail
// <LiveEventsFeed/> so there is exactly one polling implementation.
export function useLivePolling<T>({
  initialData,
  url,
  intervalMs,
  stopWhen,
  enabled = true,
  onData,
}: UseLivePollingOptions<T>): T {
  const [data, setData] = React.useState<T>(initialData);
  // Latest payload for the scheduler, which lives in a once-created effect and
  // would otherwise close over stale state.
  const latest = React.useRef<T>(initialData);
  // Keep callbacks + url in refs so the run-once effect always reads fresh
  // values without restarting the loop on every render.
  const stopWhenRef = React.useRef(stopWhen);
  const onDataRef = React.useRef(onData);
  const urlRef = React.useRef(url);
  React.useEffect(() => {
    stopWhenRef.current = stopWhen;
  }, [stopWhen]);
  React.useEffect(() => {
    onDataRef.current = onData;
  }, [onData]);
  React.useEffect(() => {
    urlRef.current = url;
  }, [url]);

  React.useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let controller: AbortController | null = null;

    const schedule = (p: T) => {
      if (timer) clearTimeout(timer);
      timer = null;
      if (cancelled) return;
      if (document.visibilityState === "hidden") return;
      if (stopWhenRef.current(p)) return;
      timer = setTimeout(fetchOnce, intervalMs);
    };

    const fetchOnce = async () => {
      controller?.abort();
      controller = new AbortController();
      try {
        const res = await fetch(urlRef.current, {
          signal: controller.signal,
          cache: "no-store",
        });
        if (cancelled) return;
        if (!res.ok) {
          schedule(latest.current);
          return;
        }
        const payload = (await res.json()) as T;
        if (cancelled) return;
        latest.current = payload;
        setData(payload);
        onDataRef.current?.(payload);
        schedule(payload);
      } catch {
        // Aborts land here too; only reschedule when still mounted.
        if (!cancelled) schedule(latest.current);
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void fetchOnce();
      } else if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    };

    schedule(latest.current);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      controller?.abort();
      document.removeEventListener("visibilitychange", onVisibility);
    };
    // Restarts only on enabled/interval changes; fresh values come through refs.
  }, [enabled, intervalMs]);

  return data;
}
