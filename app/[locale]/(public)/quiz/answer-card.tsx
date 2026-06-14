"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2Icon, XCircleIcon, Loader2Icon } from "lucide-react";
import { cn } from "@/lib/utils";
import { submitQuizAnswer } from "./actions";

type Answered = {
  choice: number;
  isCorrect: boolean;
  // Known only when answered this session; null for a previously-stored answer.
  correctIndex: number | null;
};

export function AnswerCard({
  questionId,
  options,
  signedIn,
  isAdmin = false,
  initialAnswer,
}: {
  questionId: string;
  options: string[];
  signedIn: boolean;
  isAdmin?: boolean;
  initialAnswer: { choiceIndex: number; isCorrect: boolean } | null;
}) {
  const t = useTranslations("quiz");
  const [answered, setAnswered] = useState<Answered | null>(
    initialAnswer
      ? { choice: initialAnswer.choiceIndex, isCorrect: initialAnswer.isCorrect, correctIndex: null }
      : null,
  );
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function choose(i: number) {
    if (answered || isPending || isAdmin) return;
    setError(null);
    if (!signedIn) {
      setError(t("signInToAnswer"));
      return;
    }
    startTransition(async () => {
      const res = await submitQuizAnswer({ questionId, choice: i });
      if (res.ok) {
        setAnswered({ choice: i, isCorrect: res.isCorrect, correctIndex: res.correctIndex });
      } else if (res.error === "already-answered") {
        setError(t("alreadyAnswered"));
      } else if (res.error === "not-signed-in") {
        setError(t("signInToAnswer"));
      } else if (res.error === "blocked") {
        setError(t("adminBlocked"));
      } else {
        setError(t("answerFailed"));
      }
    });
  }

  const locked = answered != null;

  return (
    <div className="flex flex-col gap-3">
      {isAdmin ? (
        <p className="text-sm text-muted-foreground">{t("adminBlocked")}</p>
      ) : !signedIn && !locked ? (
        <p className="text-sm text-muted-foreground">{t("signInToAnswer")}</p>
      ) : null}
      <ul className="flex flex-col gap-2">
        {options.map((opt, i) => {
          const chosen = answered?.choice === i;
          // An option is "correct" if grading told us so, or — for a stored
          // answer where we don't have correctIndex — the user's own correct pick.
          const correctOpt =
            locked && (answered?.correctIndex === i || (chosen && answered?.isCorrect === true));
          const wrongChosen = locked && chosen && answered?.isCorrect === false;

          return (
            <li key={i}>
              <button
                type="button"
                disabled={locked || isPending || isAdmin}
                onClick={() => choose(i)}
                className={cn(
                  "flex w-full items-center justify-between gap-3 rounded-lg border px-4 py-3 text-left text-sm transition-colors",
                  !locked && "border-border bg-card hover:bg-muted/50",
                  correctOpt && "border-pitch/50 bg-pitch/10 text-pitch",
                  wrongChosen && "border-destructive/50 bg-destructive/10 text-destructive",
                  locked && !correctOpt && !wrongChosen && "border-border opacity-60",
                )}
              >
                <span>{opt}</span>
                {correctOpt ? <CheckCircle2Icon className="size-4 shrink-0" aria-hidden /> : null}
                {wrongChosen ? <XCircleIcon className="size-4 shrink-0" aria-hidden /> : null}
              </button>
            </li>
          );
        })}
      </ul>

      {isPending ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2Icon className="size-4 animate-spin" aria-hidden />
          {t("submitting")}
        </p>
      ) : null}

      {answered ? (
        <p
          className={cn(
            "text-sm font-medium",
            answered.isCorrect ? "text-pitch" : "text-muted-foreground",
          )}
        >
          {answered.isCorrect ? t("correct") : t("incorrect")}
        </p>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
