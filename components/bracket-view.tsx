import { BracketRoundsMobile } from "@/components/bracket-rounds-mobile";
import { MatchCard, type Labels } from "@/components/bracket-match-card";
import type { BracketRound } from "@/lib/bracket-core";

// Data-driven knockout bracket. On large screens the main rounds (R32→final)
// render as columns that scroll horizontally; `justify-around` on equal-height
// columns centers each later-round match between its two feeders, and the
// third-place play-off renders as a separate block below. On small screens a
// single-round selector (BracketRoundsMobile) replaces the columns so one
// round's matches stack full-width with no horizontal content scroll.
export function BracketView({
  rounds,
  labels,
  className,
}: {
  rounds: BracketRound[];
  labels: Labels;
  className?: string;
}) {
  const main = rounds.filter((r) => r.stage !== "third");
  const third = rounds.find((r) => r.stage === "third");

  return (
    <div className={className}>
      {/* Large screens: side-by-side columns (needs ~1100px to avoid scroll). */}
      <div className="hidden lg:block">
        <div className="overflow-x-auto pb-2">
          <div className="flex min-w-max gap-3 sm:gap-4">
            {main.map((round) => (
              <div
                key={round.stage}
                className="flex w-52 flex-col justify-around gap-3 sm:w-56"
              >
                <h2 className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  {labels.stage[round.stage] ?? round.stage}
                </h2>
                {round.matches.map((m) => (
                  <MatchCard key={m.id} match={m} provisionalLabel={labels.provisional} />
                ))}
              </div>
            ))}
          </div>
        </div>

        {third ? (
          <div className="mt-8 max-w-sm">
            <h2 className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              {labels.thirdPlace}
            </h2>
            {third.matches.map((m) => (
              <MatchCard key={m.id} match={m} provisionalLabel={labels.provisional} />
            ))}
          </div>
        ) : null}
      </div>

      {/* Small screens: single-round selector, matches stacked full-width. */}
      <BracketRoundsMobile rounds={rounds} labels={labels} className="lg:hidden" />
    </div>
  );
}
