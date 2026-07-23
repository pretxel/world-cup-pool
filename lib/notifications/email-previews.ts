// Admin email preview registry: renders every transactional email template
// with deterministic fixture data and the real localized strings, without
// touching any send path (no Resend, no logs, no guard stamps). Server-only
// because the string builders live in server-only sender modules and strings
// resolve through next-intl.
import "server-only";
import { getTranslations } from "next-intl/server";
import { env } from "@/lib/env";
import type { Locale } from "@/lib/i18n";
import { renderWelcomeEmail } from "./welcome-email-template";
import { buildWelcomeEmailStrings } from "./welcome-email";
import { renderResultEmail } from "./result-email-template";
import { buildResultEmailStrings } from "./result-emails";
import { renderResultsDigest } from "./results-digest-template";
import { buildResultsDigestStrings } from "./results-digest-emails";
import { renderRecapDigest } from "./recap-digest-template";
import { buildRecapDigestStrings } from "./recap-digest-emails";
import { renderPredictionReminderEmail } from "./prediction-reminder-template";
import { buildPredictionReminderStrings } from "./prediction-reminder-emails";
import { renderQuizReminderEmail } from "./quiz-reminder-template";
import { buildQuizReminderStrings } from "./quiz-reminder-emails";
import { renderPlayoffScoreEmail } from "./playoff-score-template";
import { buildPlayoffScoreStrings } from "./playoff-score-emails";
import { renderComebackEmail } from "./comeback-email-template";
import { buildComebackEmailStrings } from "./comeback-emails";
import { renderScoreRulesEmail } from "./score-rules-template";
import { buildScoreRulesStrings } from "./score-rules-emails";
import { renderGroupInviteEmail } from "./group-invite-template";
import { buildGroupInviteEmailStrings } from "./group-invite-email";
import {
  renderMagicLinkEmail,
  buildMagicLinkEmailStrings,
} from "./magic-link-email-template";
import { renderWinnersEmail } from "./winners-email-template";
import { buildWinnersEmailStrings } from "./winners-emails";
import { renderAnnouncementEmail } from "./announcement-email-template";
import { buildAnnouncementEmailStrings } from "./announcement-emails";
import {
  SAMPLE_NAME,
  SAMPLE_EARNED_POINTS,
  SAMPLE_RANK_DELTA,
  SAMPLE_QUIZ_STREAK,
  SAMPLE_DAYS_INACTIVE,
  SAMPLE_INVITER,
  SAMPLE_GROUP_NAME,
  welcomeFixture,
  resultFixture,
  resultsDigestFixture,
  recapDigestFixture,
  predictionReminderFixture,
  quizReminderFixture,
  playoffScoreFixture,
  comebackFixture,
  scoreRulesFixture,
  groupInviteFixture,
  magicLinkFixture,
  winnersFixture,
  announcementFixture,
} from "./preview-fixtures";

// Minimal translator shape so this stays decoupled from next-intl internals.
type Translator = (key: string, values?: Record<string, unknown>) => string;

export const EMAIL_PREVIEW_IDS = [
  "welcome",
  "result",
  "resultsDigest",
  "recapDigest",
  "predictionReminder",
  "quizReminder",
  "playoffScore",
  "comeback",
  "scoreRules",
  "groupInvite",
  "magicLink",
  "winners",
  "announcement",
] as const;

export type EmailPreviewId = (typeof EMAIL_PREVIEW_IDS)[number];

export function isEmailPreviewId(value: string): value is EmailPreviewId {
  return (EMAIL_PREVIEW_IDS as readonly string[]).includes(value);
}

export interface EmailPreviewRendered {
  subject: string;
  preheader: string;
  html: string;
  text: string;
}

// Renders one email type with fixture data in the requested locale. Pure
// aside from message loading — safe to call repeatedly from the admin page.
export async function renderEmailPreview(
  id: EmailPreviewId,
  locale: Locale,
): Promise<EmailPreviewRendered> {
  const siteUrl = env.siteUrl;

  switch (id) {
    case "welcome": {
      const t = (await getTranslations({ locale, namespace: "welcomeEmail" })) as Translator;
      const data = welcomeFixture(siteUrl, locale);
      const strings = buildWelcomeEmailStrings(t, { displayName: data.displayName });
      const { subject, html, text } = renderWelcomeEmail({ ...data, strings });
      return { subject, preheader: strings.preheader, html, text };
    }
    case "result": {
      const t = (await getTranslations({ locale, namespace: "email" })) as Translator;
      const data = resultFixture(siteUrl, locale);
      const strings = buildResultEmailStrings(t, {
        displayName: data.displayName,
        earnedPoints: SAMPLE_EARNED_POINTS,
        rankDelta: SAMPLE_RANK_DELTA,
        newRank: data.standing.rank,
      });
      const { subject, html, text } = renderResultEmail({ ...data, strings });
      return { subject, preheader: strings.preheader, html, text };
    }
    case "resultsDigest": {
      const t = (await getTranslations({ locale, namespace: "resultsDigest" })) as Translator;
      const data = resultsDigestFixture(siteUrl, locale);
      const strings = buildResultsDigestStrings(t, { displayName: data.displayName });
      const { subject, html, text } = renderResultsDigest({ ...data, strings });
      return { subject, preheader: strings.preheader, html, text };
    }
    case "recapDigest": {
      const t = (await getTranslations({ locale, namespace: "recapDigest" })) as Translator;
      const data = recapDigestFixture(siteUrl, locale);
      const strings = buildRecapDigestStrings(t, { displayName: data.displayName });
      const { subject, html, text } = renderRecapDigest({ ...data, strings });
      return { subject, preheader: strings.preheader, html, text };
    }
    case "predictionReminder": {
      const t = (await getTranslations({ locale, namespace: "predictionEmail" })) as Translator;
      const data = predictionReminderFixture(siteUrl, locale);
      const strings = buildPredictionReminderStrings(t, { displayName: SAMPLE_NAME });
      const { subject, html, text } = renderPredictionReminderEmail({ ...data, strings });
      return { subject, preheader: strings.preheader, html, text };
    }
    case "quizReminder": {
      const t = (await getTranslations({ locale, namespace: "quizEmail" })) as Translator;
      const data = quizReminderFixture(siteUrl, locale);
      const strings = buildQuizReminderStrings(t, {
        displayName: SAMPLE_NAME,
        streak: SAMPLE_QUIZ_STREAK,
      });
      const { subject, html, text } = renderQuizReminderEmail({ ...data, strings });
      return { subject, preheader: strings.preheader, html, text };
    }
    case "playoffScore": {
      const t = (await getTranslations({ locale, namespace: "playoffScoreEmail" })) as Translator;
      const data = playoffScoreFixture(siteUrl, locale);
      const strings = buildPlayoffScoreStrings(t);
      const { subject, html, text } = renderPlayoffScoreEmail({ ...data, strings });
      return { subject, preheader: strings.preheader, html, text };
    }
    case "comeback": {
      const t = (await getTranslations({ locale, namespace: "comebackEmail" })) as Translator;
      const data = comebackFixture(siteUrl, locale);
      const strings = buildComebackEmailStrings(t, {
        displayName: SAMPLE_NAME,
        daysSinceLastPick: SAMPLE_DAYS_INACTIVE,
        rank: data.rank,
        totalPoints: data.totalPoints,
      });
      const { subject, html, text } = renderComebackEmail({ ...data, strings });
      return { subject, preheader: strings.preheader, html, text };
    }
    case "scoreRules": {
      const t = (await getTranslations({ locale, namespace: "scoreRulesEmail" })) as Translator;
      const data = scoreRulesFixture(siteUrl, locale);
      const strings = buildScoreRulesStrings(t);
      const { subject, html, text } = renderScoreRulesEmail({ ...data, strings });
      return { subject, preheader: strings.preheader, html, text };
    }
    case "groupInvite": {
      const t = (await getTranslations({ locale, namespace: "groupInvite" })) as Translator;
      const data = groupInviteFixture(siteUrl, locale);
      const strings = buildGroupInviteEmailStrings(t, {
        inviterName: SAMPLE_INVITER,
        groupName: SAMPLE_GROUP_NAME,
      });
      const { subject, html, text } = renderGroupInviteEmail({ ...data, strings });
      return { subject, preheader: strings.preheader, html, text };
    }
    case "magicLink": {
      const t = (await getTranslations({ locale, namespace: "email.magicLink" })) as Translator;
      const data = magicLinkFixture(siteUrl, locale);
      const strings = buildMagicLinkEmailStrings(t, "magiclink");
      const { subject, html, text } = renderMagicLinkEmail({ ...data, strings });
      return { subject, preheader: strings.preheader, html, text };
    }
    case "winners": {
      const t = (await getTranslations({ locale, namespace: "winnersEmail" })) as Translator;
      const data = winnersFixture(siteUrl, locale);
      const strings = buildWinnersEmailStrings(t, {
        displayName: data.displayName,
        rank: data.rank,
        totalPoints: data.totalPoints,
      });
      const { subject, html, text } = renderWinnersEmail({ ...data, strings });
      return { subject, preheader: strings.preheader, html, text };
    }
    case "announcement": {
      const t = (await getTranslations({ locale, namespace: "announcementEmail" })) as Translator;
      const data = announcementFixture(siteUrl, locale);
      const strings = buildAnnouncementEmailStrings(t);
      const { subject, html, text } = renderAnnouncementEmail({ ...data, strings });
      return { subject, preheader: strings.preheader, html, text };
    }
  }
}
