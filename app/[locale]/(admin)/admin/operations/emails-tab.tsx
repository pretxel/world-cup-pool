import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { cn } from "@/lib/utils";
import { localePath, type Locale } from "@/lib/i18n";
import { EmailsView } from "./emails-view";
import { EmailPreviewsView } from "./email-previews-view";

const MODES = ["log", "previews"] as const;
type Mode = (typeof MODES)[number];

// Emails tab shell: Log (send history, default) vs Previews (template
// rendering with sample data). Mode lives in the `mode` search param so the
// whole tab stays a server component.
export async function EmailsTab({
  locale,
  searchParams: sp,
}: {
  locale: Locale;
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const t = await getTranslations("admin.operations");

  const rawMode = typeof sp.mode === "string" ? sp.mode : undefined;
  const mode: Mode = MODES.includes(rawMode as Mode) ? (rawMode as Mode) : "log";

  const modeHref = (m: Mode) =>
    localePath(
      locale,
      m === "log"
        ? "/admin/operations?view=emails"
        : "/admin/operations?view=emails&mode=previews",
    );

  return (
    <div className="space-y-5">
      <div
        role="group"
        aria-label={t("tabs.emails")}
        className="inline-flex rounded-lg border border-border p-0.5"
      >
        {MODES.map((m) => {
          const active = m === mode;
          return (
            <Link
              key={m}
              href={modeHref(m)}
              aria-current={active ? "true" : undefined}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                active
                  ? "bg-primary/10 text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t(`emails.mode.${m}`)}
            </Link>
          );
        })}
      </div>

      {mode === "log" ? (
        <EmailsView />
      ) : (
        <EmailPreviewsView locale={locale} searchParams={sp} />
      )}
    </div>
  );
}
