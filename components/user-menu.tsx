"use client";

import * as React from "react";
import { Popover } from "@base-ui/react/popover";
import { Switch } from "@base-ui/react/switch";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { CheckIcon, LogOutIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateDisplayName, updateEmailPrefs } from "@/app/[locale]/profile-actions";
import {
  EMAIL_PREF_KEYS,
  normalizeEmailPrefs,
  type EmailPrefKey,
  type EmailPrefs,
} from "@/lib/email-prefs";
import { cn } from "@/lib/utils";

function initialOf(name: string | null, email: string): string {
  const src = (name?.trim() || email).trim();
  return (src[0] ?? "?").toUpperCase();
}

// Top-right account menu for signed-in users: shows identity, lets them edit
// their display name inline (saved without leaving the page), and sign out.
export function UserMenu({
  displayName,
  email,
  emailPrefs,
  signOutPath,
}: {
  displayName: string | null;
  email: string;
  emailPrefs: EmailPrefs;
  signOutPath: string;
}) {
  const t = useTranslations("profileMenu");
  const tCommon = useTranslations("common");
  const tPrefs = useTranslations("emailPrefs");
  const [name, setName] = React.useState(displayName ?? "");
  const [value, setValue] = React.useState(displayName ?? "");
  const [pending, startTransition] = React.useTransition();
  const [prefs, setPrefs] = React.useState<EmailPrefs>(() =>
    normalizeEmailPrefs(emailPrefs),
  );
  const [prefsPending, startPrefsTransition] = React.useTransition();
  const fieldId = React.useId();
  const prefsId = React.useId();

  function onTogglePref(key: EmailPrefKey, next: boolean) {
    const previous = prefs;
    // Optimistic flip; revert to the last persisted value on failure.
    setPrefs((p) => ({ ...p, [key]: next }));
    startPrefsTransition(async () => {
      const res = await updateEmailPrefs({ [key]: next });
      if (res.ok) {
        setPrefs(res.prefs);
        toast.success(tPrefs("saved"));
      } else {
        setPrefs(previous);
        toast.error(tPrefs("error"));
      }
    });
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await updateDisplayName(fd);
      if (res.ok) {
        setName(res.displayName);
        setValue(res.displayName);
        toast.success(t("saved"));
      } else {
        toast.error(t(res.error === "invalid" ? "invalid" : "error"));
      }
    });
  }

  const dirty = value.trim() !== name.trim();

  return (
    <Popover.Root>
      <Popover.Trigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("openMenu")}
            className="rounded-full"
          />
        }
      >
        <span
          aria-hidden
          className="flex size-6 items-center justify-center rounded-full bg-pitch/15 font-heading text-xs font-semibold text-pitch"
        >
          {initialOf(name, email)}
        </span>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Positioner side="bottom" align="end" sideOffset={8} className="z-50">
          <Popover.Popup className="w-72 rounded-xl bg-popover p-4 text-sm text-popover-foreground shadow-lg ring-1 ring-foreground/10 outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95">
            <div className="flex items-center gap-3 border-b border-border pb-3">
              <span
                aria-hidden
                className="flex size-9 shrink-0 items-center justify-center rounded-full bg-pitch/15 font-heading text-sm font-semibold text-pitch"
              >
                {initialOf(name, email)}
              </span>
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">
                  {name.trim() || t("account")}
                </p>
                <p className="truncate text-xs text-muted-foreground">{email}</p>
              </div>
            </div>

            <form onSubmit={onSubmit} className="mt-3 space-y-2">
              <Label htmlFor={fieldId} className="text-xs text-muted-foreground">
                {t("nameLabel")}
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id={fieldId}
                  name="display_name"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  minLength={2}
                  maxLength={32}
                  autoComplete="off"
                  className="h-8"
                />
                <Button
                  type="submit"
                  size="sm"
                  disabled={pending || !dirty || value.trim().length < 2}
                >
                  <CheckIcon className={cn(pending && "animate-pulse")} />
                  {t("save")}
                </Button>
              </div>
            </form>

            <div className="mt-3 space-y-2 border-t border-border pt-3">
              <p className="text-xs text-muted-foreground">{tPrefs("heading")}</p>
              <ul className="space-y-1.5">
                {EMAIL_PREF_KEYS.map((key) => {
                  const id = `${prefsId}-${key}`;
                  return (
                    <li key={key} className="flex items-center justify-between gap-2">
                      <Label htmlFor={id} className="text-sm font-normal text-foreground">
                        {tPrefs(key)}
                      </Label>
                      <Switch.Root
                        id={id}
                        checked={prefs[key]}
                        disabled={prefsPending}
                        onCheckedChange={(checked) => onTogglePref(key, checked)}
                        className="relative h-5 w-9 shrink-0 cursor-pointer rounded-full bg-foreground/20 p-0.5 transition-colors outline-none data-checked:bg-pitch focus-visible:ring-2 focus-visible:ring-pitch/40 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Switch.Thumb className="block size-4 rounded-full bg-background shadow-sm transition-transform data-checked:translate-x-4" />
                      </Switch.Root>
                    </li>
                  );
                })}
              </ul>
            </div>

            <form action={signOutPath} method="post" className="mt-3 border-t border-border pt-3">
              <Button type="submit" variant="outline" size="sm" className="w-full">
                <LogOutIcon />
                {tCommon("signOut")}
              </Button>
            </form>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
