import { getFormatter, getTranslations } from "next-intl/server";
import { RefreshCwIcon } from "lucide-react";
import { StatusCard } from "@/components/admin/status-card";
import { ActionStatus } from "@/components/admin/action-status";
import { SubmitButton } from "@/components/admin/submit-button";
import { LocalTime } from "@/components/local-time";
import type { Locale } from "@/lib/i18n";
import { OPERATION_KINDS, type OperationKind } from "@/lib/operations/record-run";
import { getLatestRunPerKind } from "@/lib/operations/queries";
import { nextScheduledRun } from "@/lib/operations/schedule";
import { StatusBadge } from "./status-badge";
import {
  runSyncMatches,
  runSyncNews,
  runPredictionReminders,
  runQuizReminders,
  runResultsDigest,
  runRecapDigest,
  runComebackEmails,
  runPlayoffScoreEmail,
  runScoreRulesEmail,
} from "./actions";

const RUN_ACTION: Record<OperationKind, (formData: FormData) => Promise<void>> = {
  sync_matches: runSyncMatches,
  sync_news: runSyncNews,
  prediction_reminders: runPredictionReminders,
  quiz_reminders: runQuizReminders,
  results_digest: runResultsDigest,
  recap_digest: runRecapDigest,
  comeback_emails: runComebackEmails,
  playoff_score_email: runPlayoffScoreEmail,
  score_rules_email: runScoreRulesEmail,
};

// Parses the "Run now" outcome the trigger action redirects back with. The
// summary is a JSON blob of the job's counts (shape varies per kind), rendered
// generically as label/value pairs.
function parseRanResult(sp: { [key: string]: string | string[] | undefined }) {
  const kind = typeof sp.ranKind === "string" ? sp.ranKind : null;
  if (!kind) return null;
  const status = typeof sp.ranStatus === "string" ? sp.ranStatus : "success";
  const error = typeof sp.ranError === "string" ? sp.ranError : null;
  let summary: Record<string, unknown> | null = null;
  if (typeof sp.ranSummary === "string") {
    try {
      const parsed = JSON.parse(sp.ranSummary);
      if (parsed && typeof parsed === "object") summary = parsed;
    } catch {
      summary = null;
    }
  }
  return { kind, status, error, summary };
}

export async function Overview({
  locale,
  searchParams: sp,
}: {
  locale: Locale;
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const t = await getTranslations("admin.operations");
  const format = await getFormatter();
  const now = new Date();

  const latest = await getLatestRunPerKind();
  const ran = parseRanResult(sp);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {OPERATION_KINDS.map((kind) => {
        const run = latest[kind];
        const next = nextScheduledRun(kind, now);
        const action = RUN_ACTION[kind];
        const showResult = ran?.kind === kind;

        return (
          <StatusCard
            key={kind}
            label={t(`jobs.${kind}`)}
            value={
              run ? (
                <span className="inline-flex items-center gap-2">
                  <StatusBadge
                    status={run.status}
                    label={t(`status.${run.status}`)}
                  />
                </span>
              ) : (
                <StatusBadge status="never" label={t("status.never")} />
              )
            }
            meta={
              <>
                <span>{t(`jobsDesc.${kind}`)}</span>
              </>
            }
          >
            <dl className="grid grid-cols-1 gap-1 text-xs text-muted-foreground">
              <div className="flex justify-between gap-2">
                <dt>{t("overview.lastRun")}</dt>
                <dd className="text-foreground">
                  {run ? (
                    <span title={run.started_at}>
                      {format.relativeTime(new Date(run.started_at), now)}
                    </span>
                  ) : (
                    t("overview.never")
                  )}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt>{t("overview.nextRun")}</dt>
                <dd className="font-mono tabular-nums text-foreground">
                  {next ? (
                    <LocalTime iso={next.toISOString()} />
                  ) : (
                    t("overview.manualOnly")
                  )}
                </dd>
              </div>
            </dl>

            <form action={action}>
              <input type="hidden" name="locale" value={locale} />
              <SubmitButton
                size="sm"
                variant="outline"
                pendingLabel={t("overview.running")}
              >
                <RefreshCwIcon aria-hidden />
                {t("overview.runNow")}
              </SubmitButton>
            </form>

            {showResult ? (
              ran.status === "error" ? (
                <ActionStatus variant="error" live={false}>
                  {t("overview.ranError")}
                  {ran.error ? `: ${ran.error}` : null}
                </ActionStatus>
              ) : (
                <ActionStatus
                  variant={ran.status === "partial" ? "info" : "success"}
                  live={false}
                >
                  <dl className="grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-3">
                    {ran.summary
                      ? Object.entries(ran.summary).map(([key, val]) => (
                          <div
                            key={key}
                            className="flex justify-between gap-2 sm:block"
                          >
                            <dt className="text-muted-foreground">{key}</dt>
                            <dd className="font-mono tabular-nums">
                              {String(val)}
                            </dd>
                          </div>
                        ))
                      : null}
                  </dl>
                </ActionStatus>
              )
            ) : null}
          </StatusCard>
        );
      })}
    </div>
  );
}
