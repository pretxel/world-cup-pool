import { getTranslations, setRequestLocale } from "next-intl/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { saveQuestion, deleteQuestion } from "./actions";
import { ResendQuizReminderButton } from "@/components/admin/resend-quiz-reminder-button";
import { isLocale, DEFAULT_LOCALE, type Locale } from "@/lib/i18n";
import { localizeQuizQuestion } from "@/lib/quiz";

// The resendQuizReminder action reports back via query params (server-rendered
// page, no client state). `resendQuiz=1` marks a completed run; `noQuestion`
// distinguishes a true no-op from a run that emailed zero pending recipients.
function parseQuizResendParams(params: {
  [key: string]: string | string[] | undefined;
}): { noQuestion: boolean; emailed: number; failed: number; skipped: number } | null {
  if (params.resendQuiz !== "1") return null;
  const count = (key: string) => {
    const raw = params[key];
    const n = typeof raw === "string" ? Number(raw) : NaN;
    return Number.isInteger(n) && n >= 0 ? n : 0;
  };
  return {
    noQuestion: params.resendQuizNoQuestion === "1",
    emailed: count("resendQuizEmailed"),
    failed: count("resendQuizFailed"),
    skipped: count("resendQuizSkipped"),
  };
}

// Translatable non-English locales, paired with their field-label language name.
const TRANSLATION_LOCALES = [
  { code: "es", langKey: "langEs" },
  { code: "fr", langKey: "langFr" },
] as const;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "quiz" });
  return { title: t("adminTitle") };
}

export default async function AdminQuizPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  setRequestLocale(locale);

  const t = await getTranslations("quiz");
  const resend = parseQuizResendParams(await searchParams);

  const supabase = await createServerSupabaseClient();
  // Admin RLS (quiz_questions_admin_all) lets an admin read the base table,
  // correct_index included.
  const { data: questions } = await supabase
    .from("quiz_questions")
    .select("*")
    .order("active_on", { ascending: true });
  const list = questions ?? [];

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <header className="mb-8 border-b border-border pb-6">
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          {t("adminTitle")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("adminLede")}</p>
        <p className="mt-2 text-xs text-muted-foreground">
          Note: the daily quiz applies to all competitions (not competition-scoped).
        </p>
      </header>

      <section className="mb-8 rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              {t("resendTitle")}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{t("resendLede")}</p>
          </div>
          <ResendQuizReminderButton
            locale={locale}
            label={t("resendButton")}
            confirmText={t("resendConfirm")}
          />
        </div>
        {resend ? (
          resend.noQuestion ? (
            <div className="mt-3 rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
              {t("resendNoQuestion")}
            </div>
          ) : (
            <div className="mt-3 rounded-md border bg-muted/30 p-3 text-sm">
              {t("resendSummary", {
                emailed: resend.emailed,
                failed: resend.failed,
                skipped: resend.skipped,
              })}
            </div>
          )
        ) : null}
      </section>

      <form action={saveQuestion} className="mb-10 flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          {t("adminNew")}
        </p>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="prompt">{t("fieldPrompt")}</Label>
          <Input id="prompt" name="prompt" required />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex flex-col gap-1.5">
              <Label htmlFor={`option_${i}`}>{t("fieldOption", { n: i + 1 })}</Label>
              <Input id={`option_${i}`} name={`option_${i}`} />
            </div>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="correct_index">{t("fieldCorrect")}</Label>
            <select
              id="correct_index"
              name="correct_index"
              required
              className="h-9 rounded-md border border-input bg-transparent px-3 text-sm"
            >
              {[0, 1, 2, 3].map((i) => (
                <option key={i} value={i}>
                  {t("fieldOption", { n: i + 1 })}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="active_on">{t("fieldDate")}</Label>
            <Input id="active_on" name="active_on" type="date" required />
          </div>
        </div>

        <div className="mt-2 flex flex-col gap-4 border-t border-border pt-4">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              {t("adminTranslations")}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("adminTranslationsHint")}
            </p>
          </div>
          {TRANSLATION_LOCALES.map(({ code, langKey }) => {
            const lang = t(langKey);
            return (
              <fieldset key={code} className="flex flex-col gap-3 rounded-lg border border-border p-3">
                <legend className="px-1 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  {lang}
                </legend>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`${code}_prompt`}>
                    {t("fieldPromptLocale", { lang })}
                  </Label>
                  <Input id={`${code}_prompt`} name={`${code}_prompt`} />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="flex flex-col gap-1.5">
                      <Label htmlFor={`${code}_option_${i}`}>
                        {t("fieldOptionLocale", { n: i + 1, lang })}
                      </Label>
                      <Input id={`${code}_option_${i}`} name={`${code}_option_${i}`} />
                    </div>
                  ))}
                </div>
              </fieldset>
            );
          })}
        </div>

        <Button type="submit" className="self-start">
          {t("create")}
        </Button>
      </form>

      <h2 className="mb-3 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
        {t("scheduled", { count: list.length })}
      </h2>
      <ul className="flex flex-col gap-2">
        {list.map((q) => (
          <li
            key={q.id}
            className="flex items-start justify-between gap-4 rounded-lg border border-border bg-card px-4 py-3"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5">
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  {q.active_on}
                </p>
                {(() => {
                  // A locale is "translated" when localize actually returns
                  // its translation rather than falling back to English — the
                  // same usability rule the public page applies.
                  const translated = TRANSLATION_LOCALES.filter(
                    ({ code }) =>
                      localizeQuizQuestion(q, code).prompt !== q.prompt,
                  );
                  return translated.length > 0 ? (
                    translated.map(({ code }) => (
                      <Badge key={code} variant="secondary">
                        {t(code === "es" ? "badgeEs" : "badgeFr")}
                      </Badge>
                    ))
                  ) : (
                    <Badge variant="outline">{t("badgeUntranslated")}</Badge>
                  );
                })()}
              </div>
              <p className="mt-0.5 truncate text-sm font-medium">{q.prompt}</p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {q.options
                  .map((o, i) => (i === q.correct_index ? `✓ ${o}` : o))
                  .join(" · ")}
              </p>
            </div>
            <form action={deleteQuestion}>
              <input type="hidden" name="id" value={q.id} />
              <Button type="submit" size="sm" variant="ghost">
                {t("deleteQ")}
              </Button>
            </form>
          </li>
        ))}
      </ul>
    </main>
  );
}
