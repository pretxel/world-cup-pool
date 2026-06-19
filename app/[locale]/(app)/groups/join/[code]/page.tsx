import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getGroupPreview } from "@/lib/groups";
import { JoinConfirmForm } from "./join-confirm";
import { isLocale, localePath, DEFAULT_LOCALE, type Locale } from "@/lib/i18n";
import { ArrowLeftIcon, UsersIcon } from "lucide-react";

export const metadata: Metadata = {
  title: "Join group",
  robots: { index: false },
};

export default async function JoinGroupPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; code: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { locale: raw, code } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  setRequestLocale(locale);

  // Inviter from the invite link (`?ref=`). Forwarded as-is; the join action
  // validates it as a UUID and the RPC drops anything that is not a real,
  // distinct member of the group.
  const { ref } = await searchParams;
  const invitedBy = typeof ref === "string" ? ref : undefined;

  const t = await getTranslations("groups");
  const preview = await getGroupPreview(code);

  return (
    <main className="mx-auto flex max-w-md flex-col px-4 py-16">
      <Link
        href={localePath(locale, "/groups")}
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeftIcon className="size-3.5" /> {t("backToGroups")}
      </Link>

      {preview ? (
        <div className="rounded-2xl border border-border bg-card p-6 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-pitch/10 text-pitch">
            <UsersIcon className="size-6" />
          </div>
          <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
            {t("joinInviteEyebrow")}
          </p>
          <h1
            className="mt-1 font-heading text-2xl font-semibold tracking-tight"
            style={{ fontStretch: "condensed" }}
          >
            {preview.name}
          </h1>
          <p className="mx-auto mt-2 max-w-xs text-sm text-muted-foreground">
            {t("joinConfirmBody", { name: preview.name })}
          </p>
          <div className="mt-6">
            <JoinConfirmForm code={code} locale={locale} invitedBy={invitedBy} />
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-8 text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
            {t("joinInvalidTitle")}
          </p>
          <p className="mx-auto mt-2 max-w-xs text-sm text-muted-foreground">
            {t("joinInvalidBody")}
          </p>
          <Link
            href={localePath(locale, "/groups")}
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-foreground underline-offset-4 hover:text-pitch hover:underline"
          >
            {t("backToGroups")}
          </Link>
        </div>
      )}
    </main>
  );
}
