import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { listMyGroups } from "@/lib/groups";
import { CreateGroupForm, JoinGroupForm } from "./group-forms";
import { isLocale, localePath, DEFAULT_LOCALE, type Locale } from "@/lib/i18n";
import { ChevronRightIcon, CrownIcon, UsersIcon } from "lucide-react";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "groups" });
  return {
    title: t("title"),
    description: t("description"),
    alternates: { canonical: "/groups" },
  };
}

export default async function GroupsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  setRequestLocale(locale);

  const t = await getTranslations("groups");
  const groups = await listMyGroups();

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <header className="mb-6 border-b border-border pb-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
          {t("eyebrow")}
        </p>
        <h1
          className="mt-1 font-heading text-4xl font-semibold tracking-tight sm:text-5xl"
          style={{ fontStretch: "condensed" }}
        >
          {t("headline")}
        </h1>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">{t("lede")}</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="mb-3 font-heading text-base font-semibold">
            {t("createTitle")}
          </h2>
          <CreateGroupForm locale={locale} />
        </section>
        <section className="rounded-xl border border-border bg-card p-4">
          <h2 className="mb-3 font-heading text-base font-semibold">
            {t("joinTitle")}
          </h2>
          <JoinGroupForm locale={locale} />
        </section>
      </div>

      <section className="mt-8">
        <h2 className="mb-3 font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
          {t("yourGroups")}
        </h2>

        {groups.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/30 p-10 text-center">
            <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
              {t("emptyTitle")}
            </p>
            <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
              {t("emptyBody")}
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {groups.map((g) => (
              <li key={g.id}>
                <Link
                  href={localePath(locale, `/groups/${g.id}`)}
                  className="group flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 transition-colors hover:border-pitch/40 hover:bg-muted/40"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{g.name}</span>
                      {g.isOwner ? (
                        <CrownIcon className="size-3.5 shrink-0 text-flag" />
                      ) : null}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
                      <UsersIcon className="size-3" />
                      {t("memberCount", { count: g.memberCount })}
                    </div>
                  </div>
                  <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
