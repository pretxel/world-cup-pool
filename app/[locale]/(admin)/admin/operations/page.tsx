import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { isLocale, localePath, DEFAULT_LOCALE, type Locale } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Overview } from "./overview";
import { RunsView } from "./runs-view";
import { EmailsTab } from "./emails-tab";
import { ActivityView } from "./activity-view";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin.operations" });
  return { title: t("title") };
}

const VIEWS = ["overview", "runs", "emails", "activity"] as const;
type View = (typeof VIEWS)[number];

export default async function AdminOperationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  setRequestLocale(locale);

  const t = await getTranslations("admin.operations");
  const sp = await searchParams;
  const rawView = typeof sp.view === "string" ? sp.view : undefined;
  const view: View = VIEWS.includes(rawView as View)
    ? (rawView as View)
    : "overview";

  // Tabs preserve only `view`; entering a tab drops the previous tab's filters.
  const tabHref = (v: View) =>
    v === "overview"
      ? localePath(locale, "/admin/operations")
      : localePath(locale, `/admin/operations?view=${v}`);

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <div className="admin-reveal space-y-8">
        <AdminPageHeader
          eyebrow={t("eyebrow")}
          title={t("title")}
          description={t("description")}
        />

        <nav
          aria-label={t("title")}
          className="flex min-w-0 items-center gap-0.5 overflow-x-auto border-b border-border"
        >
          {VIEWS.map((v) => {
            const active = v === view;
            return (
              <Link
                key={v}
                href={tabHref(v)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "shrink-0 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {t(`tabs.${v}`)}
              </Link>
            );
          })}
        </nav>

        {view === "overview" ? (
          <Overview locale={locale} searchParams={sp} />
        ) : null}
        {view === "runs" ? (
          <RunsView locale={locale} searchParams={sp} />
        ) : null}
        {view === "emails" ? (
          <EmailsTab locale={locale} searchParams={sp} />
        ) : null}
        {view === "activity" ? <ActivityView /> : null}
      </div>
    </main>
  );
}
