"use client";

import { useTranslations } from "next-intl";
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
import { ActionStatus } from "@/components/admin/action-status";
import { SubmitButton } from "@/components/admin/submit-button";
import { setActiveCompetition } from "@/app/[locale]/(admin)/admin/competitions/actions";

// Confirmation-gated activation — the ONLY path that flips the public flag.
// Names the outgoing/incoming competition, lists consequences, and warns when
// the target has no fixtures. Base UI Dialog handles focus trap + restore; the
// confirm control is not auto-focused (Cancel is).
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
  const t = useTranslations("admin");
  return (
    <Dialog>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        {t("setActive.trigger")}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("setActive.title", { name })}</DialogTitle>
          <DialogDescription>
            {currentActiveName
              ? t("setActive.replaceBody", { current: currentActiveName })
              : t("setActive.freshBody")}{" "}
            {t("setActive.consequences")}
          </DialogDescription>
        </DialogHeader>

        {!hasFixtures ? (
          <ActionStatus variant="error">
            {t("setActive.noFixturesWarning")}
          </ActionStatus>
        ) : null}

        <DialogFooter>
          <DialogClose render={<Button variant="ghost" autoFocus />}>
            {t("setActive.cancel")}
          </DialogClose>
          <form action={setActiveCompetition}>
            <input type="hidden" name="id" value={id} />
            <SubmitButton variant="destructive">
              {t("setActive.confirm")}
            </SubmitButton>
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
