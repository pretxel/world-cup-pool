"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  CheckIcon,
  CopyIcon,
  LogOutIcon,
  MailIcon,
  SendIcon,
  Trash2Icon,
  UserMinusIcon,
} from "lucide-react";
import {
  deleteGroupAction,
  inviteToGroupByEmailAction,
  leaveGroupAction,
  removeMemberAction,
  renameGroupAction,
  type InviteByEmailState,
} from "../actions";

export function InviteShare({
  code,
  locale,
  currentUserId,
}: {
  code: string;
  locale: string;
  currentUserId?: string | null;
}) {
  const t = useTranslations("groups");
  const [copied, setCopied] = useState<"code" | "link" | null>(null);

  function copy(value: string, which: "code" | "link") {
    void navigator.clipboard.writeText(value).then(() => {
      setCopied(which);
      toast.success(t("copied"));
      window.setTimeout(() => setCopied(null), 1500);
    });
  }

  // Tag the invite link with the sharer as inviter (`?ref=`) so the join flow
  // can credit a referral. The RPC drops a ref that is not a real member.
  const link =
    typeof window !== "undefined"
      ? `${window.location.origin}/${locale}/groups/join/${code}${
          currentUserId ? `?ref=${currentUserId}` : ""
        }`
      : "";

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          {t("inviteLabel")}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">{t("inviteHint")}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-md bg-muted px-3 py-1.5 font-mono text-base font-semibold tracking-[0.2em]">
          {code}
        </span>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="gap-1.5"
          onClick={() => copy(code, "code")}
        >
          {copied === "code" ? (
            <CheckIcon className="size-3.5" />
          ) : (
            <CopyIcon className="size-3.5" />
          )}
          {t("copyCode")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="gap-1.5"
          onClick={() => copy(link, "link")}
        >
          {copied === "link" ? (
            <CheckIcon className="size-3.5" />
          ) : (
            <CopyIcon className="size-3.5" />
          )}
          {t("copyLink")}
        </Button>
      </div>
    </div>
  );
}

export function InviteByEmail({
  groupId,
  locale,
}: {
  groupId: string;
  locale: string;
}) {
  const t = useTranslations("groupInvite");
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState<InviteByEmailState, FormData>(
    inviteToGroupByEmailAction,
    {},
  );

  // Surface the outcome of the last submission. On a clean success, reset the
  // textarea so the inviter can send another batch.
  useEffect(() => {
    if (state.error) {
      toast.error(t(state.error));
      return;
    }
    if (state.sent !== undefined) {
      if (state.sent > 0) {
        toast.success(t("sentSuccess", { count: state.sent }));
        formRef.current?.reset();
      }
      if (state.failed) {
        toast.error(t("sentFailed", { count: state.failed }));
      }
      if (state.invalid && state.invalid.length > 0) {
        toast.error(t("invalidAddresses", { addresses: state.invalid.join(", ") }));
      }
    }
  }, [state, t]);

  return (
    <div className="mt-3 flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          {t("inviteLabel")}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">{t("inviteHint")}</p>
      </div>
      <form ref={formRef} action={action} className="flex flex-col gap-2">
        <input type="hidden" name="group_id" value={groupId} />
        <input type="hidden" name="locale" value={locale} />
        <Label htmlFor="invite-recipients" className="sr-only">
          {t("recipientsLabel")}
        </Label>
        <textarea
          id="invite-recipients"
          name="recipients"
          required
          rows={2}
          placeholder={t("recipientsPlaceholder")}
          className="w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-base outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
        />
        <Button
          type="submit"
          size="sm"
          variant="outline"
          disabled={pending}
          className="gap-1.5 self-start"
        >
          {pending ? (
            <MailIcon className="size-3.5" />
          ) : (
            <SendIcon className="size-3.5" />
          )}
          {pending ? t("sending") : t("sendInvite")}
        </Button>
      </form>
    </div>
  );
}

export function RenameGroupForm({
  groupId,
  currentName,
}: {
  groupId: string;
  currentName: string;
}) {
  const t = useTranslations("groups");
  return (
    <form action={renameGroupAction} className="flex flex-col gap-2">
      <input type="hidden" name="group_id" value={groupId} />
      <Label
        htmlFor="rename"
        className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground"
      >
        {t("renameLabel")}
      </Label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          id="rename"
          name="name"
          required
          minLength={2}
          maxLength={40}
          defaultValue={currentName}
          className="h-10"
        />
        <Button type="submit" variant="outline" className="h-10 whitespace-nowrap">
          {t("renameSubmit")}
        </Button>
      </div>
    </form>
  );
}

export function RemoveMemberButton({
  groupId,
  userId,
  memberName,
}: {
  groupId: string;
  userId: string;
  memberName: string;
}) {
  const t = useTranslations("groups");
  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label={t("removeMember")}
          />
        }
      >
        <UserMinusIcon className="size-4 text-muted-foreground" />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("removeMemberTitle")}</DialogTitle>
          <DialogDescription>
            {t("removeMemberBody", { name: memberName })}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            {t("cancel")}
          </DialogClose>
          <form action={removeMemberAction}>
            <input type="hidden" name="group_id" value={groupId} />
            <input type="hidden" name="user_id" value={userId} />
            <Button type="submit" variant="destructive" className="w-full gap-1.5">
              <UserMinusIcon className="size-4" />
              {t("removeMember")}
            </Button>
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function LeaveGroupButton({
  groupId,
  locale,
}: {
  groupId: string;
  locale: string;
}) {
  const t = useTranslations("groups");
  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button type="button" variant="outline" size="sm" className="gap-1.5" />
        }
      >
        <LogOutIcon className="size-3.5" />
        {t("leave")}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("leaveTitle")}</DialogTitle>
          <DialogDescription>{t("leaveBody")}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            {t("cancel")}
          </DialogClose>
          <form action={leaveGroupAction}>
            <input type="hidden" name="group_id" value={groupId} />
            <input type="hidden" name="locale" value={locale} />
            <Button type="submit" variant="destructive" className="w-full gap-1.5">
              <LogOutIcon className="size-4" />
              {t("leave")}
            </Button>
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteGroupButton({
  groupId,
  locale,
}: {
  groupId: string;
  locale: string;
}) {
  const t = useTranslations("groups");
  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-1.5 text-destructive hover:text-destructive"
          />
        }
      >
        <Trash2Icon className="size-3.5" />
        {t("deleteGroup")}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("deleteTitle")}</DialogTitle>
          <DialogDescription>{t("deleteBody")}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            {t("cancel")}
          </DialogClose>
          <form action={deleteGroupAction}>
            <input type="hidden" name="group_id" value={groupId} />
            <input type="hidden" name="locale" value={locale} />
            <Button type="submit" variant="destructive" className="w-full gap-1.5">
              <Trash2Icon className="size-4" />
              {t("deleteGroup")}
            </Button>
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
