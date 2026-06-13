"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { setActiveCompetition } from "@/app/[locale]/(admin)/admin/competitions/actions";

// Confirmation-gated activation — the ONLY path that flips the public flag.
// Names the outgoing/incoming competition, lists consequences, and warns when
// the target has no fixtures. The confirm control is not auto-focused.
export function SetActiveDialog({
  id,
  name,
  currentActiveName,
  hasFixtures,
}: {
  id: string;
  name: string;
  currentActiveName: string | null;
  hasFixtures: boolean;
}) {
  return (
    <Dialog>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        Set active
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Make “{name}” the live competition?</DialogTitle>
          <DialogDescription>
            {currentActiveName
              ? `This replaces “${currentActiveName}” as the active competition.`
              : "This becomes the active competition."}{" "}
            Public pages, leaderboards, emails, result sync, and RLS all
            re-point to it. In-progress predictions on the previous competition
            become locked.
          </DialogDescription>
        </DialogHeader>

        {!hasFixtures ? (
          <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            Warning: this competition has no fixtures yet. Visitors will see an
            empty schedule and leaderboard.
          </p>
        ) : null}

        <DialogFooter>
          <DialogClose render={<Button variant="ghost" autoFocus />}>
            Cancel
          </DialogClose>
          <form action={setActiveCompetition}>
            <input type="hidden" name="id" value={id} />
            <Button type="submit" variant="destructive">
              Set active
            </Button>
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
