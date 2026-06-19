"use client";

import { useActionState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Loader2Icon, TicketIcon } from "lucide-react";
import { trackEvent } from "@/lib/analytics";
import { joinGroupAction, type GroupActionState } from "../../actions";

const INITIAL: GroupActionState = {};

export function JoinConfirmForm({
  code,
  locale,
  invitedBy,
}: {
  code: string;
  locale: string;
  invitedBy?: string;
}) {
  const t = useTranslations("groups");
  const [state, formAction, pending] = useActionState(joinGroupAction, INITIAL);

  useEffect(() => {
    if (state.error) toast.error(t(state.error));
  }, [state, t]);

  // A successful join `redirect`s, so fire `group_joined` when a submit settles
  // without an error. When the invite link carried an inviter (`?ref=`), also
  // fire `group_referral` so the viral loop is measurable. `wasPending` keys off
  // an actual submit (never initial mount); no raw join code or PII is included.
  const wasPending = useRef(false);
  useEffect(() => {
    if (wasPending.current && !pending && !state.error) {
      trackEvent("group_joined");
      if (invitedBy) trackEvent("group_referral");
    }
    wasPending.current = pending;
  }, [pending, state.error, invitedBy]);

  return (
    <form action={formAction}>
      <input type="hidden" name="code" value={code} />
      <input type="hidden" name="locale" value={locale} />
      {invitedBy ? (
        <input type="hidden" name="invited_by" value={invitedBy} />
      ) : null}
      <Button type="submit" disabled={pending} className="h-11 w-full gap-2">
        {pending ? (
          <Loader2Icon className="size-4 animate-spin" />
        ) : (
          <TicketIcon className="size-4" />
        )}
        {t("joinConfirmSubmit")}
      </Button>
    </form>
  );
}
