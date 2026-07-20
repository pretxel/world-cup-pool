import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { cn } from "@/lib/utils";
import {
  SUPPORTED_LOCALES,
  isLocale,
  localePath,
  DEFAULT_LOCALE,
  type Locale,
} from "@/lib/i18n";
import {
  EMAIL_PREVIEW_IDS,
  isEmailPreviewId,
  renderEmailPreview,
  type EmailPreviewId,
} from "@/lib/notifications/email-previews";

const BODY_MODES = ["html", "text"] as const;
type BodyMode = (typeof BODY_MODES)[number];

function str(v: string | string[] | undefined): string | undefined {
  return typeof v === "string" ? v : undefined;
}

export async function EmailPreviewsView({
  locale,
  searchParams: sp,
}: {
  locale: Locale;
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const t = await getTranslations("admin.operations");

  const rawTemplate = str(sp.template);
  const template: EmailPreviewId =
    rawTemplate && isEmailPreviewId(rawTemplate) ? rawTemplate : EMAIL_PREVIEW_IDS[0];
  const rawEmailLocale = str(sp.emailLocale);
  const emailLocale: Locale =
    rawEmailLocale && isLocale(rawEmailLocale) ? rawEmailLocale : DEFAULT_LOCALE;
  const rawBody = str(sp.body);
  const body: BodyMode = BODY_MODES.includes(rawBody as BodyMode)
    ? (rawBody as BodyMode)
    : "html";

  const preview = await renderEmailPreview(template, emailLocale);

  const href = (overrides: {
    template?: EmailPreviewId;
    emailLocale?: Locale;
    body?: BodyMode;
  }) => {
    const params = new URLSearchParams({ view: "emails", mode: "previews" });
    const next = { template, emailLocale, body, ...overrides };
    if (next.template !== EMAIL_PREVIEW_IDS[0]) params.set("template", next.template);
    if (next.emailLocale !== DEFAULT_LOCALE) params.set("emailLocale", next.emailLocale);
    if (next.body !== "html") params.set("body", next.body);
    return localePath(locale, `/admin/operations?${params.toString()}`);
  };

  const chip = (label: string, chipHref: string, active: boolean) => (
    <Link
      key={chipHref + label}
      href={chipHref}
      aria-current={active ? "true" : undefined}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "border-transparent bg-primary/10 text-foreground"
          : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {label}
    </Link>
  );

  return (
    <div className="space-y-5">
      {/* Template / locale / body selectors */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            {t("emails.previews.templateLabel")}
          </span>
          {EMAIL_PREVIEW_IDS.map((id) =>
            chip(t(`emails.previews.templates.${id}`), href({ template: id }), template === id),
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            {t("emails.previews.localeLabel")}
          </span>
          {SUPPORTED_LOCALES.map((l) =>
            chip(l.toUpperCase(), href({ emailLocale: l }), emailLocale === l),
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            {t("emails.previews.bodyLabel")}
          </span>
          {chip(t("emails.previews.bodyHtml"), href({ body: "html" }), body === "html")}
          {chip(t("emails.previews.bodyText"), href({ body: "text" }), body === "text")}
        </div>
      </div>

      {/* Envelope fields */}
      <dl className="space-y-1 rounded-xl border border-border bg-muted/20 p-4">
        <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
          <dt className="w-24 shrink-0 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            {t("emails.previews.subject")}
          </dt>
          <dd className="text-sm font-medium">{preview.subject}</dd>
        </div>
        <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
          <dt className="w-24 shrink-0 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            {t("emails.previews.preheader")}
          </dt>
          <dd className="text-sm text-muted-foreground">{preview.preheader}</dd>
        </div>
      </dl>

      <p className="text-xs text-muted-foreground">{t("emails.previews.sampleNote")}</p>

      {/* Sandboxed body: email styles stay inside the frame, admin styles stay out */}
      {body === "html" ? (
        <iframe
          sandbox=""
          srcDoc={preview.html}
          title={t(`emails.previews.templates.${template}`)}
          className="h-[65vh] min-h-96 w-full rounded-xl border border-border bg-white"
        />
      ) : (
        <pre className="max-h-[65vh] overflow-auto whitespace-pre-wrap rounded-xl border border-border bg-muted/20 p-4 font-mono text-xs">
          {preview.text}
        </pre>
      )}
    </div>
  );
}
