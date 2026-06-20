"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { trackEvent } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { localePath, type Locale } from "@/lib/i18n";
import {
  foldCounts,
  REACTION_EMOJI,
  REACTION_TYPES,
  type ReactionType,
} from "@/lib/recap-reactions";
import { toggleRecapReaction } from "@/app/[locale]/(public)/matches/[matchId]/actions";

// Collapse a burst of reaction writes (others reacting) into a single counts
// re-fetch, mirroring components/leaderboard-live.tsx.
const REFETCH_DEBOUNCE_MS = 750;

// Reaction bar under the recap comic on the match detail page. Seeded by the SSR
// counts + the viewer's own selected types, it toggles optimistically through
// the server action (which enforces the rate limit + active/final scope and
// returns authoritative counts) and reconciles against the returned counts.
//
// For anonymous viewers it renders counts read-only with a sign-in prompt, never
// a silent failure. When live counts are available it subscribes to Realtime
// change events on public.recap_reactions and re-fetches the counts view on
// change, falling back silently to the SSR snapshot if Realtime never connects.
export function RecapReactions({
  summaryId,
  matchId,
  locale,
  isSignedIn,
  initialCounts,
  initialMine,
}: {
  summaryId: string;
  matchId: string;
  locale: Locale;
  isSignedIn: boolean;
  initialCounts: Record<ReactionType, number>;
  initialMine: ReactionType[];
}) {
  const t = useTranslations("recapReactions");
  const [counts, setCounts] = useState<Record<ReactionType, number>>(
    initialCounts,
  );
  const [mine, setMine] = useState<Set<ReactionType>>(new Set(initialMine));
  const [pendingType, setPendingType] = useState<ReactionType | null>(null);
  const [, startTransition] = useTransition();

  // Optional live counts. Best-effort: any error keeps the current snapshot.
  useEffect(() => {
    if (!isSignedIn) return; // anon clients get no RLS-scoped delivery.
    const supabase = createBrowserSupabaseClient();
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function refetch() {
      const { data, error } = await supabase
        .from("v_recap_reaction_counts")
        .select("reaction, count")
        .eq("summary_id", summaryId);
      if (cancelled || error || !data) return;
      setCounts(foldCounts(data));
    }

    function scheduleRefetch() {
      if (timer) clearTimeout(timer);
      timer = setTimeout(refetch, REFETCH_DEBOUNCE_MS);
    }

    const channel = supabase
      .channel(`recap-reactions-${summaryId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "recap_reactions",
          filter: `summary_id=eq.${summaryId}`,
        },
        scheduleRefetch,
      )
      .subscribe();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [summaryId, isSignedIn]);

  function onToggle(type: ReactionType) {
    if (pendingType) return;
    const wasOn = mine.has(type);
    const nextOn = !wasOn;

    // Optimistic update.
    const prevCounts = counts;
    const prevMine = new Set(mine);
    setCounts({
      ...counts,
      [type]: Math.max(0, counts[type] + (nextOn ? 1 : -1)),
    });
    const nextMine = new Set(mine);
    if (nextOn) nextMine.add(type);
    else nextMine.delete(type);
    setMine(nextMine);
    setPendingType(type);

    startTransition(async () => {
      const result = await toggleRecapReaction({
        summaryId,
        reaction: type,
        on: nextOn,
      });
      setPendingType(null);
      if (!result.ok) {
        // Roll back the optimistic update and surface the reason.
        setCounts(prevCounts);
        setMine(prevMine);
        toast.error(result.error);
        return;
      }
      // Reconcile against authoritative counts from the server.
      setCounts(result.counts);
      trackEvent(nextOn ? "recap_reaction_added" : "recap_reaction_removed", {
        reaction: type,
        match_id: matchId,
      });
    });
  }

  return (
    <div className="mt-4">
      <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
        {t("heading")}
      </p>
      <div className="flex flex-wrap gap-2" role="group" aria-label={t("heading")}>
        {REACTION_TYPES.map((type) => {
          const selected = mine.has(type);
          const count = counts[type] ?? 0;
          const label = t(`labels.${type}`);
          return (
            <button
              key={type}
              type="button"
              disabled={!isSignedIn || pendingType !== null}
              aria-pressed={selected}
              aria-label={t("toggleAria", { label, count })}
              onClick={() => onToggle(type)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors",
                selected
                  ? "border-pitch bg-pitch/10 text-foreground"
                  : "border-border bg-card text-foreground/90 hover:bg-muted/50",
                (!isSignedIn || pendingType !== null) &&
                  "cursor-default opacity-90",
                isSignedIn && pendingType === null && "cursor-pointer",
              )}
            >
              <span aria-hidden>{REACTION_EMOJI[type]}</span>
              <span className="font-mono text-xs tabular-nums">{count}</span>
            </button>
          );
        })}
      </div>
      {!isSignedIn ? (
        <p className="mt-3 text-sm text-muted-foreground">
          {t("signInPrompt")}{" "}
          <Link
            href={`${localePath(locale, "/sign-in")}?next=${encodeURIComponent(localePath(locale, `/matches/${matchId}`))}`}
            className={buttonVariants({
              variant: "link",
              className: "h-auto p-0 text-sm font-semibold underline",
            })}
          >
            {t("signInCta")}
          </Link>
        </p>
      ) : null}
    </div>
  );
}
