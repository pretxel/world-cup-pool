// Deterministic sample data for the admin email previews. Every builder is
// typed against the real template input (minus `strings`), so a template
// gaining or changing a field breaks the build here instead of silently
// rendering a stale preview. No database reads — previews must work on an
// empty local stack.
import { localePath, type Locale } from "@/lib/i18n";
import type { WelcomeEmailData } from "./welcome-email-template";
import type { ResultEmailData, RankDelta } from "./result-email-template";
import type { ResultsDigestData } from "./results-digest-template";
import type { RecapDigestData } from "./recap-digest-template";
import type { PredictionReminderEmailData } from "./prediction-reminder-template";
import type { QuizReminderEmailData } from "./quiz-reminder-template";
import type { PlayoffScoreData } from "./playoff-score-template";
import type { ComebackEmailData } from "./comeback-email-template";
import type { ScoreRulesData } from "./score-rules-template";
import type { GroupInviteEmailData } from "./group-invite-template";
import type { MagicLinkEmailData } from "./magic-link-email-template";
import type { WinnersEmailData } from "./winners-email-template";

// Deliberately long display name so previews surface truncation/wrap issues.
export const LONG_NAME = "Maximiliano Aristóbulo de la Santísima Trinidad";
export const SAMPLE_NAME = "Ana";

// Sum of the sample result matches' points; also interpolated into the subject.
export const SAMPLE_EARNED_POINTS = 8;
export const SAMPLE_RANK_DELTA: RankDelta = {
  direction: "up",
  magnitude: 3,
  previousRank: 10,
};
export const SAMPLE_QUIZ_STREAK = 4;
export const SAMPLE_DAYS_INACTIVE = 6;
export const SAMPLE_COMEBACK_RANK = 18;
export const SAMPLE_COMEBACK_POINTS = 24;
export const SAMPLE_INVITER = "Diego";
export const SAMPLE_GROUP_NAME = "Oficina CDMX";

// Inline SVG stand-in for the Supabase-hosted recap comic so the preview never
// depends on storage state or the network.
const COMIC_PLACEHOLDER =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="600" height="400" fill="#E3EFE8"/><text x="300" y="200" text-anchor="middle" font-family="sans-serif" font-size="24" fill="#1B7A4D">Recap comic</text></svg>`,
  );

type Fixture<T> = (siteUrl: string, locale: Locale) => Omit<T, "strings">;

const path = (siteUrl: string, locale: Locale, p: string) =>
  `${siteUrl}${localePath(locale, p)}`;

export const welcomeFixture: Fixture<WelcomeEmailData> = (siteUrl, locale) => ({
  displayName: SAMPLE_NAME,
  quizUrl: path(siteUrl, locale, "/quiz"),
  groupsUrl: path(siteUrl, locale, "/groups"),
  leaderboardUrl: path(siteUrl, locale, "/leaderboard"),
});

export const resultFixture: Fixture<ResultEmailData> = (siteUrl, locale) => ({
  displayName: SAMPLE_NAME,
  standing: { rank: 7, totalPoints: 42, exactHits: 5, winnerGdHits: 9 },
  rankDelta: SAMPLE_RANK_DELTA,
  matches: [
    { homeTeam: "México", awayTeam: "Argentina", homeScore: 2, awayScore: 1, points: 5, hitType: "exact" },
    { homeTeam: "France", awayTeam: "Deutschland", homeScore: 3, awayScore: 1, points: 3, hitType: "winner_gd" },
    { homeTeam: "Brasil", awayTeam: "España", homeScore: 0, awayScore: 2, points: 0, hitType: "miss" },
  ],
  leaderboardUrl: path(siteUrl, locale, "/leaderboard"),
});

export const resultsDigestFixture: Fixture<ResultsDigestData> = (siteUrl, locale) => ({
  displayName: SAMPLE_NAME,
  top5: [
    { rank: 1, displayName: LONG_NAME, totalPoints: 61 },
    { rank: 2, displayName: "Lupita", totalPoints: 58 },
    { rank: 3, displayName: "Karim", totalPoints: 55 },
    { rank: 4, displayName: null, totalPoints: 51 },
    { rank: 5, displayName: "Sofía", totalPoints: 49 },
  ],
  personal: { rank: 12, totalPoints: 38, delta: 2 },
  movers: [
    { displayName: "Karim", rank: 3, delta: 4 },
    { displayName: "Lupita", rank: 2, delta: -1 },
  ],
  leaderboardUrl: path(siteUrl, locale, "/leaderboard"),
});

export const recapDigestFixture: Fixture<RecapDigestData> = (siteUrl, locale) => ({
  displayName: SAMPLE_NAME,
  comics: [
    {
      home: "MEX",
      away: "ARG",
      comicUrl: COMIC_PLACEHOLDER,
      matchUrl: path(siteUrl, locale, "/matches"),
      shareUrl: path(siteUrl, locale, "/matches"),
    },
    {
      home: "FRA",
      away: "GER",
      comicUrl: COMIC_PLACEHOLDER,
      matchUrl: path(siteUrl, locale, "/matches"),
      shareUrl: path(siteUrl, locale, "/matches"),
    },
  ],
});

export const predictionReminderFixture: Fixture<PredictionReminderEmailData> = (
  siteUrl,
  locale,
) => ({
  matches: [
    { home: "México", away: "Argentina", kickoffLabel: "Sat 13 Jun · 18:00" },
    { home: "France", away: "Deutschland", kickoffLabel: "Sat 13 Jun · 21:00" },
    { home: "Brasil", away: "España", kickoffLabel: "Sun 14 Jun · 15:00" },
  ],
  predictionsUrl: path(siteUrl, locale, "/matches"),
  unsubscribeUrl: path(siteUrl, locale, "/settings/notifications"),
});

export const quizReminderFixture: Fixture<QuizReminderEmailData> = (siteUrl, locale) => ({
  quizUrl: path(siteUrl, locale, "/quiz"),
  unsubscribeUrl: path(siteUrl, locale, "/settings/notifications"),
});

export const playoffScoreFixture: Fixture<PlayoffScoreData> = (siteUrl, locale) => ({
  matches: [
    { home: "México", away: "Nederland", homeScore: 2, awayScore: 2, resultNote: "(4–3 pens)", stageLabel: "Round of 16" },
    { home: "Argentina", away: "England", homeScore: 1, awayScore: 0, resultNote: null, stageLabel: "Round of 16" },
  ],
  bracketUrl: path(siteUrl, locale, "/bracket"),
});

export const comebackFixture: Fixture<ComebackEmailData> = (siteUrl, locale) => ({
  rank: SAMPLE_COMEBACK_RANK,
  totalPoints: SAMPLE_COMEBACK_POINTS,
  matches: [
    { home: "Portugal", away: "Uruguay", kickoffLabel: "Fri 19 Jun · 18:00" },
    { home: "日本", away: "Côte d'Ivoire", kickoffLabel: "Fri 19 Jun · 21:00" },
  ],
  predictionsUrl: path(siteUrl, locale, "/matches"),
  unsubscribeUrl: path(siteUrl, locale, "/settings/notifications"),
});

// Mirrors BASE_POINTS × STAGE_POINT_MULTIPLIER (lib/scoring.ts) for the World
// Cup stages. Labels are format-config strings in production, so they are
// intentionally fixed English here rather than message-driven.
export const scoreRulesFixture: Fixture<ScoreRulesData> = (siteUrl, locale) => ({
  phases: [
    { stageLabel: "Group stage", multiplier: 1, exact: 5, winnerGd: 3, winner: 1 },
    { stageLabel: "Round of 32", multiplier: 2, exact: 10, winnerGd: 6, winner: 2 },
    { stageLabel: "Round of 16", multiplier: 4, exact: 20, winnerGd: 12, winner: 4 },
    { stageLabel: "Quarter-finals", multiplier: 6, exact: 30, winnerGd: 18, winner: 6 },
    { stageLabel: "Semi-finals", multiplier: 8, exact: 40, winnerGd: 24, winner: 8 },
    { stageLabel: "Final", multiplier: 10, exact: 50, winnerGd: 30, winner: 10 },
  ],
  ctaUrl: path(siteUrl, locale, "/standings"),
});

export const groupInviteFixture: Fixture<GroupInviteEmailData> = (siteUrl, locale) => ({
  inviterName: SAMPLE_INVITER,
  groupName: SAMPLE_GROUP_NAME,
  joinUrl: path(siteUrl, locale, "/groups"),
});

export const magicLinkFixture: Fixture<MagicLinkEmailData> = (siteUrl, locale) => ({
  actionUrl: `${siteUrl}${localePath(locale, "/auth/confirm")}?token=preview`,
});

// Recipient is the runner-up so the you-chip renders on a non-gold row.
export const SAMPLE_WINNER_RANK = 2;
export const SAMPLE_WINNER_POINTS = 58;

export const winnersFixture: Fixture<WinnersEmailData> = (siteUrl, locale) => ({
  displayName: SAMPLE_NAME,
  rank: SAMPLE_WINNER_RANK,
  totalPoints: SAMPLE_WINNER_POINTS,
  podium: [
    { rank: 1, displayName: LONG_NAME, totalPoints: 61, isYou: false },
    { rank: 2, displayName: SAMPLE_NAME, totalPoints: SAMPLE_WINNER_POINTS, isYou: true },
    { rank: 3, displayName: "Karim", totalPoints: 55, isYou: false },
  ],
  leaderboardUrl: path(siteUrl, locale, "/leaderboard"),
});
