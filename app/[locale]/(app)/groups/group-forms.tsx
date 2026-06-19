"use client";

import { useActionState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2Icon, PlusIcon, TicketIcon } from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import {
  createGroupAction,
  joinGroupAction,
  type GroupActionState,
} from "./actions";

const INITIAL: GroupActionState = {};

export function CreateGroupForm({ locale }: { locale: string }) {
  const t = useTranslations("groups");
  const [state, formAction, pending] = useActionState(
    createGroupAction,
    INITIAL,
  );

  useEffect(() => {
    if (state.error) toast.error(t(state.error));
  }, [state, t]);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="locale" value={locale} />
      <Label
        htmlFor="group-name"
        className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground"
      >
        {t("createNameLabel")}
      </Label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          id="group-name"
          name="name"
          required
          minLength={2}
          maxLength={40}
          placeholder={t("createNamePlaceholder")}
          className="h-11"
        />
        <Button
          type="submit"
          disabled={pending}
          className="h-11 gap-2 whitespace-nowrap"
        >
          {pending ? (
            <Loader2Icon className="size-4 animate-spin" />
          ) : (
            <PlusIcon className="size-4" />
          )}
          {t("createSubmit")}
        </Button>
      </div>
    </form>
  );
}

export function JoinGroupForm({
  locale,
  defaultCode,
}: {
  locale: string;
  defaultCode?: string;
}) {
  const t = useTranslations("groups");
  const [state, formAction, pending] = useActionState(joinGroupAction, INITIAL);

  useEffect(() => {
    if (state.error) toast.error(t(state.error));
  }, [state, t]);

  // A successful join `redirect`s, so the client never sees an explicit success
  // return. Fire `group_joined` when a submit settles without an error (the
  // inverse of the error effect above). `wasPending` ensures we key off an
  // actual submit and never fire on initial mount; the redirect-driven unmount
  // race may slightly undercount, which is acceptable.
  const wasPending = useRef(false);
  useEffect(() => {
    if (wasPending.current && !pending && !state.error) {
      trackEvent("group_joined");
    }
    wasPending.current = pending;
  }, [pending, state.error]);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="locale" value={locale} />
      <Label
        htmlFor="join-code"
        className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground"
      >
        {t("joinCodeLabel")}
      </Label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          id="join-code"
          name="code"
          required
          autoCapitalize="characters"
          defaultValue={defaultCode}
          placeholder={t("joinCodePlaceholder")}
          className="h-11 font-mono uppercase tracking-[0.18em]"
        />
        <Button
          type="submit"
          variant="outline"
          disabled={pending}
          className="h-11 gap-2 whitespace-nowrap"
        >
          {pending ? (
            <Loader2Icon className="size-4 animate-spin" />
          ) : (
            <TicketIcon className="size-4" />
          )}
          {t("joinSubmit")}
        </Button>
      </div>
    </form>
  );
}
