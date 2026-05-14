"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { MinusIcon, PlusIcon, Loader2Icon, CheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { KickoffCountdown } from "@/components/kickoff-countdown";
import { cn } from "@/lib/utils";
import { submitPrediction } from "./actions";

const MAX_GOALS = 20;

export function PredictionForm({
  matchId,
  homeTeam,
  awayTeam,
  kickoffAt,
  initial,
}: {
  matchId: string;
  homeTeam: string;
  awayTeam: string;
  kickoffAt: string;
  initial: { home_goals: number; away_goals: number } | null;
}) {
  const [home, setHome] = useState<number>(initial?.home_goals ?? 0);
  const [away, setAway] = useState<number>(initial?.away_goals ?? 0);
  const [touched, setTouched] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [lockedNow, setLockedNow] = useState(false);

  useEffect(() => {
    const kickoff = new Date(kickoffAt).getTime();
    const tick = () => setLockedNow(Date.now() >= kickoff);
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [kickoffAt]);

  const initialPick = initial?.home_goals !== undefined && initial?.away_goals !== undefined;
  const isDirty =
    !initialPick ||
    touched ||
    home !== initial?.home_goals ||
    away !== initial?.away_goals;

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (home < 0 || away < 0 || home > MAX_GOALS || away > MAX_GOALS) {
      toast.error(`Scores must be between 0 and ${MAX_GOALS}`);
      return;
    }
    startTransition(async () => {
      const result = await submitPrediction({
        matchId,
        homeGoals: home,
        awayGoals: away,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Pick locked in");
      setTouched(false);
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-xl border border-border bg-card p-5 shadow-sm"
    >
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-5">
        <ScoreStepper
          id={`home-${matchId}`}
          label="Home"
          team={homeTeam}
          value={home}
          onChange={(v) => {
            setHome(v);
            setTouched(true);
          }}
          disabled={lockedNow || isPending}
        />

        <div className="flex flex-col items-center gap-1">
          <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
            vs
          </span>
          <span className="font-mono text-2xl font-semibold text-muted-foreground">
            –
          </span>
        </div>

        <ScoreStepper
          id={`away-${matchId}`}
          label="Away"
          team={awayTeam}
          value={away}
          onChange={(v) => {
            setAway(v);
            setTouched(true);
          }}
          disabled={lockedNow || isPending}
          align="end"
        />
      </div>

      <div className="mt-5 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
          {lockedNow ? (
            <span className="font-mono uppercase tracking-[0.2em]">
              Locked at kickoff
            </span>
          ) : (
            <>
              <KickoffCountdown kickoffAt={kickoffAt} />
              <span>
                {initialPick
                  ? "Edit any time before kickoff — last save wins."
                  : "Submit before kickoff. You can update freely until then."}
              </span>
            </>
          )}
        </div>

        <Button
          type="submit"
          disabled={lockedNow || isPending || (initialPick && !isDirty)}
          className={cn(
            "h-10 gap-2 px-5 text-sm font-semibold uppercase tracking-[0.16em]",
          )}
        >
          {isPending ? (
            <>
              <Loader2Icon className="size-4 animate-spin" /> Saving
            </>
          ) : initialPick ? (
            isDirty ? (
              <>
                <CheckIcon className="size-4" /> Update pick
              </>
            ) : (
              <>
                <CheckIcon className="size-4" /> Saved
              </>
            )
          ) : (
            <>
              <CheckIcon className="size-4" /> Submit pick
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

function ScoreStepper({
  id,
  label,
  team,
  value,
  onChange,
  disabled,
  align = "start",
}: {
  id: string;
  label: string;
  team: string;
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  align?: "start" | "end";
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2",
        align === "end" && "items-end text-right",
      )}
    >
      <div className="min-w-0">
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          {label}
        </span>
        <div className="mt-0.5 truncate font-heading text-sm font-semibold tracking-tight sm:text-base">
          {team}
        </div>
      </div>
      <div
        className={cn(
          "inline-flex w-full items-center justify-between gap-1 rounded-xl border border-border bg-muted/30 p-1",
          align === "end" ? "flex-row" : "flex-row",
        )}
      >
        <Button
          type="button"
          size="icon-sm"
          variant="outline"
          disabled={disabled || value <= 0}
          aria-label={`Decrease ${team} score`}
          onClick={() => onChange(Math.max(0, value - 1))}
          className="size-9 shrink-0 bg-background"
        >
          <MinusIcon />
        </Button>
        <input
          id={id}
          type="number"
          inputMode="numeric"
          min={0}
          max={MAX_GOALS}
          value={value}
          onChange={(e) => {
            const next = Number(e.target.value);
            if (Number.isFinite(next)) {
              onChange(Math.min(MAX_GOALS, Math.max(0, Math.floor(next))));
            }
          }}
          disabled={disabled}
          aria-label={`${team} score`}
          className={cn(
            "min-w-0 flex-1 bg-transparent text-center font-mono text-3xl font-semibold tabular-nums leading-none text-foreground outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none disabled:opacity-50 sm:text-4xl",
          )}
        />
        <Button
          type="button"
          size="icon-sm"
          variant="outline"
          disabled={disabled || value >= MAX_GOALS}
          aria-label={`Increase ${team} score`}
          onClick={() => onChange(Math.min(MAX_GOALS, value + 1))}
          className="size-9 shrink-0 bg-background"
        >
          <PlusIcon />
        </Button>
      </div>
    </div>
  );
}
