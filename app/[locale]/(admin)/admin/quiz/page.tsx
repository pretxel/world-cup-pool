import { getTranslations, setRequestLocale } from "next-intl/server";
import { MessageCircleQuestionIcon } from "lucide-react";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { FormSection } from "@/components/admin/form-section";
import { EmptyState } from "@/components/admin/empty-state";
import { ActionStatus } from "@/components/admin/action-status";
import { LiveRegion } from "@/components/admin/live-region";
import { SubmitButton } from "@/components/admin/submit-button";
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

// Translatable non-English locales, paired with their field-label language name
// and the "translated" badge key. Keep in sync with the non-default
// SUPPORTED_LOCALES the save action persists.
const TRANSLATION_LOCALES = [
  { code: "es", langKey: "langEs", badgeKey: "badgeEs" },
  { code: "fr", langKey: "langFr", badgeKey: "badgeFr" },
  { code: "de", langKey: "langDe", badgeKey: "badgeDe" },
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

  // Announced via the always-mounted live region; the visible panel mounts only
  // after the resend redirect, which is not reliably announced on its own.
  const resendAnnounce = resend
    ? resend.noQuestion
      ? t("resendNoQuestion")
      : t("resendSummary", {
          emailed: resend.emailed,
          failed: resend.failed,
          skipped: resend.skipped,
        })
    : undefined;

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <LiveRegion status={resendAnnounce} />
      <div className="admin-reveal space-y-8">
        <div className="space-y-3">
          <AdminPageHeader title={t("adminTitle")} description={t("adminLede")} />
          <p className="text-xs text-muted-foreground">{t("adminScopeNote")}</p>
        </div>

        {/* Resend reminder */}
        <Card className="gap-3 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-0.5">
              <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
                {t("resendTitle")}
              </p>
              <p className="text-sm text-muted-foreground">{t("resendLede")}</p>
            </div>
            <ResendQuizReminderButton
              locale={locale}
              label={t("resendButton")}
              confirmText={t("resendConfirm")}
            />
          </div>
          {resend ? (
            resend.noQuestion ? (
              <ActionStatus live={false}>{t("resendNoQuestion")}</ActionStatus>
            ) : (
              <ActionStatus variant="success" live={false}>
                {t("resendSummary", {
                  emailed: resend.emailed,
                  failed: resend.failed,
                  skipped: resend.skipped,
                })}
              </ActionStatus>
            )
          ) : null}
        </Card>

        {/* New question */}
        <Card className="p-5">
          <form action={saveQuestion} className="space-y-8">
            <FormSection title={t("adminNew")}>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="prompt">{t("fieldPrompt")}</Label>
                <Input id="prompt" name="prompt" required />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="flex flex-col gap-1.5">
                    <Label htmlFor={`option_${i}`}>
                      {t("fieldOption", { n: i + 1 })}
                    </Label>
                    <Input id={`option_${i}`} name={`option_${i}`} />
                  </div>
                ))}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="correct_index">{t("fieldCorrect")}</Label>
                  <NativeSelect id="correct_index" name="correct_index" required>
                    {[0, 1, 2, 3].map((i) => (
                      <option key={i} value={i}>
                        {t("fieldOption", { n: i + 1 })}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="active_on">{t("fieldDate")}</Label>
                  <Input id="active_on" name="active_on" type="date" required />
                </div>
              </div>
            </FormSection>

            <div className="border-t border-border pt-6">
              <FormSection
                title={t("adminTranslations")}
                description={t("adminTranslationsHint")}
              >
                {TRANSLATION_LOCALES.map(({ code, langKey }) => {
                  const lang = t(langKey);
                  return (
                    <fieldset
                      key={code}
                      className="flex flex-col gap-3 rounded-lg border border-border p-3"
                    >
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
                            <Input
                              id={`${code}_option_${i}`}
                              name={`${code}_option_${i}`}
                            />
                          </div>
                        ))}
                      </div>
                    </fieldset>
                  );
                })}
              </FormSection>
            </div>

            <SubmitButton>{t("create")}</SubmitButton>
          </form>
        </Card>

        {/* Scheduled questions */}
        <section className="space-y-3">
          <h2 className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            {t("scheduled", { count: list.length })}
          </h2>

          {list.length === 0 ? (
            <EmptyState
              icon={<MessageCircleQuestionIcon />}
              title={t("scheduledEmptyTitle")}
              description={t("scheduledEmptyBody")}
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {list.map((q) => {
                // A locale is "translated" when localize actually returns its
                // translation rather than falling back to English — the same
                // usability rule the public page applies.
                const translated = TRANSLATION_LOCALES.filter(
                  ({ code }) => localizeQuizQuestion(q, code).prompt !== q.prompt,
                );
                return (
                  <li
                    key={q.id}
                    className="flex items-start justify-between gap-4 rounded-lg border border-border bg-card px-4 py-3"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                          {q.active_on}
                        </p>
                        {translated.length > 0 ? (
                          translated.map(({ code, badgeKey }) => (
                            <Badge key={code} variant="secondary">
                              {t(badgeKey)}
                            </Badge>
                          ))
                        ) : (
                          <Badge variant="outline">{t("badgeUntranslated")}</Badge>
                        )}
                      </div>
                      <p className="mt-0.5 truncate text-sm font-medium">
                        {q.prompt}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {q.options
                          .map((o, i) => (i === q.correct_index ? `✓ ${o}` : o))
                          .join(" · ")}
                      </p>
                    </div>
                    <form action={deleteQuestion}>
                      <input type="hidden" name="id" value={q.id} />
                      <SubmitButton
                        size="sm"
                        variant="destructive"
                        confirmText={t("deleteConfirm")}
                      >
                        {t("deleteQ")}
                      </SubmitButton>
                    </form>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
