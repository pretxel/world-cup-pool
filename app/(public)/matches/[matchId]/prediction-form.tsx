"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { submitPrediction } from "./actions";

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
  const [home, setHome] = useState<number | "">(initial?.home_goals ?? "");
  const [away, setAway] = useState<number | "">(initial?.away_goals ?? "");
  const [isPending, startTransition] = useTransition();
  const [lockedNow, setLockedNow] = useState(false);

  useEffect(() => {
    const kickoff = new Date(kickoffAt).getTime();
    const tick = () => setLockedNow(Date.now() >= kickoff);
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [kickoffAt]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (typeof home !== "number" || typeof away !== "number") {
      toast.error("Enter both scores");
      return;
    }
    if (home < 0 || away < 0 || home > 20 || away > 20) {
      toast.error("Scores must be between 0 and 20");
      return;
    }
    startTransition(async () => {
      const result = await submitPrediction({ matchId, homeGoals: home, awayGoals: away });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Prediction saved");
    });
  }

  return (
    <form onSubmit={onSubmit} className="rounded-md border p-4">
      <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor={`home-${matchId}`}>{homeTeam}</Label>
          <Input
            id={`home-${matchId}`}
            type="number"
            min={0}
            max={20}
            inputMode="numeric"
            value={home}
            onChange={(e) => setHome(e.target.value === "" ? "" : Number(e.target.value))}
            disabled={lockedNow || isPending}
            required
          />
        </div>
        <span className="pb-3 text-muted-foreground">–</span>
        <div className="space-y-1.5">
          <Label htmlFor={`away-${matchId}`}>{awayTeam}</Label>
          <Input
            id={`away-${matchId}`}
            type="number"
            min={0}
            max={20}
            inputMode="numeric"
            value={away}
            onChange={(e) => setAway(e.target.value === "" ? "" : Number(e.target.value))}
            disabled={lockedNow || isPending}
            required
          />
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {lockedNow ? "Locked at kickoff" : initial ? "Update your pick anytime before kickoff" : "Submit before kickoff"}
        </span>
        <Button type="submit" disabled={lockedNow || isPending}>
          {isPending ? "Saving…" : initial ? "Update pick" : "Submit pick"}
        </Button>
      </div>
    </form>
  );
}
