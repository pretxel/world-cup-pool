"use client";

import * as React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MatchCard, type Labels } from "@/components/bracket-match-card";
import type { BracketRound } from "@/lib/bracket-core";

// Small-screen bracket: a scrollable round strip (only the thin strip scrolls
// horizontally, never the match content) over the selected round's matches
// stacked full-width. Renders the same MatchCard as the desktop columns, so
// content/behavior is identical between layouts. Client island for the
// active-round state; the rest of the bracket page stays server-rendered.
export function BracketRoundsMobile({
  rounds,
  labels,
  className,
}: {
  rounds: BracketRound[];
  labels: Labels;
  className?: string;
}) {
  const [active, setActive] = React.useState<string>(rounds[0]?.stage ?? "");

  if (rounds.length === 0) return null;

  const roundLabel = (stage: string) =>
    stage === "third" ? labels.thirdPlace : (labels.stage[stage] ?? stage);

  return (
    <div className={className}>
      <Tabs value={active} onValueChange={(v) => setActive(String(v))}>
        <TabsList
          aria-label={labels.selectorLabel}
          className="w-full max-w-full justify-start overflow-x-auto"
        >
          {rounds.map((round) => (
            <TabsTrigger
              key={round.stage}
              value={round.stage}
              className="flex-none px-3 whitespace-nowrap"
            >
              {roundLabel(round.stage)}
            </TabsTrigger>
          ))}
        </TabsList>

        {rounds.map((round) => (
          <TabsContent key={round.stage} value={round.stage} className="mt-4 space-y-3">
            {round.matches.map((m) => (
              <MatchCard key={m.id} match={m} provisionalLabel={labels.provisional} />
            ))}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
