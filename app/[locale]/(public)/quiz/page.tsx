import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { FlameIcon, SnowflakeIcon } from "lucide-react";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { QuizLeaderboardRow } from "@/lib/db";
import { computeStreak, localizeQuizQuestion } from "@/lib/quiz";
import { resolveStreakFreeze, type FreezeState } from "@/lib/streak-freeze";
import { loadQuizStanding } from "@/lib/quiz-standing";
import { ShareButtons } from "@/components/share-buttons";
import { buildQuizSharePath } from "@/lib/share";
import { env } from "@/lib/env";
import { cn } from "@/lib/utils";
import { isLocale, DEFAULT_LOCALE, type Locale } from "@/lib/i18n";
import { isCurrentUserAdmin } from "@/lib/admin/current-user";
import { AnswerCard } from "./answer-card";

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "quiz" });
  return {
    title: t("title"),
    description: t("description"),
    alternates: { canonical: "/quiz" },
    openGraph: {
      title: t("ogTitle"),
      description: t("ogDescription"),
      url: "/quiz",
      type: "website",
    },
  };
}

export default async function QuizPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  setRequestLocale(locale);

  const t = await getTranslations("quiz");
  const tShare = await getTranslations("shareQuiz");
  const today = todayUtc();

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Admins are operators, not contestants — the question shows but answering is
  // blocked (and the server action rejects them too).
  const isAdmin = user ? await isCurrentUserAdmin(supabase) : false;

  const { data: question } = await supabase
    .from("v_quiz_questions_public")
    .select("id, prompt, options, translations, active_on")
    .eq("active_on", today)
    .maybeSingle();

  // Serve the prompt/options in the request locale, falling back to English.
  // Answer order is identical across locales, so grading (by index) is
  // locale-independent.
  const localized =
    question?.prompt && question.options
      ? localizeQuizQuestion(
          {
            prompt: question.prompt,
            options: question.options,
            translations: question.translations,
          },
          locale,
        )
      : null;

  // Signed-in: this question's existing answer (for the card) + all answers
  // (for streak + points). Anonymous: skip both.
  let myAnswer: { choiceIndex: number; isCorrect: boolean } | null = null;
  let streak = 0;
  let points = 0;
  let answeredCount = 0;
  let freeze: FreezeState | null = null;
  if (user) {
    const { data: answers } = await supabase
      .from("quiz_answers")
      .select("question_id, choice_index, is_correct, answered_at")
      .eq("user_id", user.id);
    const list = answers ?? [];
    answeredCount = list.length;
    points = list.filter((a) => a.is_correct).length * 10;
    // A weekly freeze pass can forgive a single one-day gap. The quiz streak is
    // unbounded (no weekly window), so gap detection is unbounded too — only the
    // allowance refills on the Monday-UTC week. Best-effort; never throws.
    const now = new Date();
    const answeredAt = list.map((a) => a.answered_at);
    const activityDays = new Set(
      answeredAt.map((iso) => new Date(iso).toISOString().slice(0, 10)),
    );
    freeze = await resolveStreakFreeze(
      supabase,
      user.id,
      "quiz",
      activityDays,
      now,
    );
    streak = computeStreak(answeredAt, now, freeze.frozenDays);
    if (question?.id) {
      const mine = list.find((a) => a.question_id === question.id);
      if (mine) myAnswer = { choiceIndex: mine.choice_index, isCorrect: mine.is_correct };
    }
  }

  const { data: board } = await supabase
    .from("v_quiz_leaderboard")
    .select("*")
    .order("rank", { ascending: true })
    .limit(10);
  const rows = (board ?? []) as QuizLeaderboardRow[];

  // Share standing for the signed-in viewer's own quiz streak. Read from the
  // same public view the share card uses, so the share text matches the card.
  const quizShare =
    user && answeredCount > 0 ? await loadQuizStanding(supabase, user.id) : null;

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <header className="mb-8 border-b border-border pb-6">
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

      {user ? (
        <dl className="mb-8 grid grid-cols-3 gap-3">
          <Stat
            label={t("streakLabel")}
            value={
              <span className="flex items-center gap-1.5">
                <FlameIcon
                  className={cn("size-5", streak > 0 ? "text-orange-500" : "text-muted-foreground/50")}
                  aria-hidden
                />
                {streak}
                {freeze ? (
                  <span
                    className="ml-1 inline-flex items-center gap-0.5 text-xs font-medium text-sky-500"
                    title={t("freezeRemaining", { count: freeze.remaining })}
                  >
                    <SnowflakeIcon className="size-3.5" aria-hidden />
                    {freeze.remaining}
                  </span>
                ) : null}
              </span>
            }
            hint={freeze?.usedThisWeek ? t("freezeSaved") : undefined}
          />
          <Stat label={t("pointsLabel")} value={points} />
          <Stat label={t("answeredLabel")} value={answeredCount} />
        </dl>
      ) : null}

      {user && quizShare ? (
        <section className="mb-8 rounded-xl border border-border bg-card p-4">
          <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            {tShare("heading")}
          </p>
          <ShareButtons
            context="quiz"
            shareUrl={`${env.siteUrl}${buildQuizSharePath(locale, user.id)}`}
            shareText={tShare("shareText", {
              rank: quizShare.row.rank ?? 0,
              count: quizShare.players,
              points: quizShare.row.total_points ?? 0,
              streak: quizShare.row.streak ?? 0,
            })}
            labels={{
              x: tShare("shareOnX"),
              facebook: tShare("shareOnFacebook"),
              native: tShare("shareNative"),
              copy: tShare("copyLink"),
              copied: tShare("copied"),
            }}
          />
        </section>
      ) : null}

      <section className="mb-12">
        {question?.id && localized ? (
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
              {t("todayQuestion")}
            </p>
            <h2 className="mt-1 mb-4 font-heading text-xl font-semibold leading-snug tracking-tight">
              {localized.prompt}
            </h2>
            <AnswerCard
              questionId={question.id}
              options={localized.options}
              signedIn={!!user}
              isAdmin={isAdmin}
              initialAnswer={myAnswer}
            />
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-muted/30 p-10 text-center">
            <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
              {t("emptyTitle")}
            </p>
            <p className="mx-auto mt-2 max-w-sm text-sm">{t("emptyBody")}</p>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
          {t("leaderboardTitle")}
        </h2>
        {rows.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
            {t("leaderboardEmpty")}
          </p>
        ) : (
          <ol className="overflow-hidden rounded-xl border border-border bg-card">
            {rows.map((r, i) => {
              const isMe = user && r.user_id === user.id;
              return (
                <li
                  key={r.user_id ?? i}
                  className={cn(
                    "flex items-center gap-3 px-4 py-2.5 text-sm",
                    i !== 0 && "border-t border-border",
                    isMe && "bg-pitch/5",
                  )}
                >
                  <span className="w-6 font-mono tabular-nums text-muted-foreground">
                    {r.rank}
                  </span>
                  <span className="flex-1 truncate font-medium">
                    {r.display_name || t("noName")}
                    {isMe ? (
                      <span className="ml-2 text-xs text-muted-foreground">{t("you")}</span>
                    ) : null}
                  </span>
                  <span className="font-mono tabular-nums">{r.total_points}</span>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </main>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2">
      <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 font-mono text-xl font-semibold tabular-nums">{value}</dd>
      {hint ? (
        <p className="mt-0.5 text-[10px] leading-tight text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
