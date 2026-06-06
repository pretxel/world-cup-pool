"use client";

import { useActionState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Loader2Icon, TicketIcon } from "lucide-react";
import { joinGroupAction, type GroupActionState } from "../../actions";

const INITIAL: GroupActionState = {};

export function JoinConfirmForm({
  code,
  locale,
}: {
  code: string;
  locale: string;
}) {
  const t = useTranslations("groups");
  const [state, formAction, pending] = useActionState(joinGroupAction, INITIAL);

  useEffect(() => {
    if (state.error) toast.error(t(state.error));
  }, [state, t]);

  return (
    <form action={formAction}>
      <input type="hidden" name="code" value={code} />
      <input type="hidden" name="locale" value={locale} />
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
