// Pure, dependency-free renderer for the result-standing email. Mirrors the
// web leaderboard's visual language (pitch-green header, cream body, gold/ink/
// green rank tones, mono uppercase labels) using email-safe HTML: table layout,
// inline styles, fixed hex colors (no oklch, CSS variables, or stylesheets).
//
// No database or network access — callers assemble `ResultEmailData` and pass
// already-localized copy in `strings`, keeping this fully unit-testable.

import type { HitType } from "@/lib/db";

// ---------------------------------------------------------------------------
// Palette — fixed hex equivalents of the app's light-theme oklch tokens.
// Kept here (not in globals.css) because mail clients can't resolve var()/oklch.
// ---------------------------------------------------------------------------
const C = {
  background: "#FAF9F4",
  card: "#FFFFFF",
  ink: "#1B2330",
  muted: "#6B7280",
  border: "#E5E2D7",
  pitch: "#1B7A4D",
  pitchFg: "#FAF9F4",
  flag: "#E7B53C",
  flagFg: "#3A2E14",
  live: "#D6402F",
  // Soft tints used for the per-match outcome chips.
  pitchTint: "#E3EFE8",
  mutedTint: "#F0EEE6",
} as const;

const SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const MONO = "'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,Consolas,monospace";

export type EmailOutcome = HitType;

export interface EmailFinishedMatch {
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  points: number;
  hitType: EmailOutcome;
}

export interface EmailStanding {
  rank: number | null;
  totalPoints: number;
  exactHits: number;
  winnerGdHits: number;
}

// Movement of a player's overall rank since the previous sync run.
// `up`/`down` carry a positive magnitude and the previous rank; `same` carries
// magnitude 0; `new` (first appearance / no prior snapshot) carries neither.
export type RankDeltaDirection = "up" | "down" | "same" | "new";

export interface RankDelta {
  direction: RankDeltaDirection;
  magnitude: number;
  previousRank?: number;
}

// All copy is resolved by the caller (next-intl) and passed in — value-bearing
// strings (subject, heading) arrive already interpolated.
export interface ResultEmailStrings {
  subject: string;
  preheader: string;
  eyebrow: string;
  heading: string;
  intro: string;
  resultsLabel: string;
  standingLabel: string;
  rankLabel: string;
  playerLabel: string;
  pointsLabel: string;
  exactLabel: string;
  winnerGdLabel: string;
  youLabel: string;
  ptsSuffix: string;
  // Resolved, localized rank-movement line ("you moved up 3 to #7", or the
  // neutral variant for `same`/`new`). Already interpolated by the caller.
  rankDelta: string;
  outcomes: Record<EmailOutcome, string>;
  ctaLabel: string;
  footer: string;
}

export interface ResultEmailData {
  displayName: string | null;
  standing: EmailStanding;
  // Rank movement since the previous run. `null` (admin force-resend, no
  // snapshot) renders the neutral variant, same as `same`/`new`.
  rankDelta?: RankDelta | null;
  matches: EmailFinishedMatch[];
  strings: ResultEmailStrings;
  leaderboardUrl: string;
}

export interface ResultEmailRendered {
  subject: string;
  html: string;
  text: string;
}

// --- helpers ---------------------------------------------------------------

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Per-match outcome chip colors, echoing the leaderboard accents:
// exact = gold, winner/GD = pitch green, winner = green tint, miss = muted.
function outcomeChipColors(hit: EmailOutcome): { bg: string; fg: string } {
  switch (hit) {
    case "exact":
      return { bg: C.flag, fg: C.flagFg };
    case "winner_gd":
      return { bg: C.pitch, fg: C.pitchFg };
    case "winner":
      return { bg: C.pitchTint, fg: C.pitch };
    case "miss":
    default:
      return { bg: C.mutedTint, fg: C.muted };
  }
}

// RankBadge tones from components/leaderboard-table.tsx:
// 1st = gold, 2nd = ink, 3rd = green, else neutral.
function rankBadgeColors(rank: number | null): { bg: string; fg: string } {
  switch (rank) {
    case 1:
      return { bg: C.flag, fg: C.flagFg };
    case 2:
      return { bg: C.ink, fg: C.background };
    case 3:
      return { bg: C.pitch, fg: C.pitchFg };
    default:
      return { bg: C.mutedTint, fg: C.muted };
  }
}

function monoLabel(text: string, color: string): string {
  return `<span style="font-family:${MONO};font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.2em;color:${color};">${escapeHtml(
    text,
  )}</span>`;
}

// --- HTML sections ---------------------------------------------------------

function renderHeader(): string {
  // Pitch-green band with the WC·26·POOL wordmark in cream — the brand
  // signature without depending on the SVG logotype (which uses var()).
  return `
    <tr>
      <td style="background-color:${C.pitch};padding:22px 28px;">
        <span style="font-family:${SANS};font-size:22px;font-weight:800;letter-spacing:-0.5px;color:${C.pitchFg};">WC</span>
        <span style="display:inline-block;margin:0 6px;padding:2px 8px;border-radius:7px;background-color:${C.pitchFg};font-family:${MONO};font-size:16px;font-weight:800;letter-spacing:-1px;color:${C.pitch};vertical-align:middle;">26</span>
        <span style="font-family:${MONO};font-size:12px;font-weight:600;letter-spacing:0.3em;color:${C.pitchFg};vertical-align:middle;">POOL</span>
      </td>
    </tr>`;
}

function renderIntro(s: ResultEmailStrings): string {
  return `
    <tr>
      <td style="padding:28px 28px 8px 28px;">
        ${monoLabel(s.eyebrow, C.muted)}
        <h1 style="margin:6px 0 0 0;font-family:${SANS};font-size:24px;line-height:1.2;font-weight:700;color:${C.ink};">${escapeHtml(
          s.heading,
        )}</h1>
        <p style="margin:8px 0 0 0;font-family:${SANS};font-size:14px;line-height:1.5;color:${C.muted};">${escapeHtml(
          s.intro,
        )}</p>
      </td>
    </tr>`;
}

function renderMatchCard(m: EmailFinishedMatch, s: ResultEmailStrings): string {
  const chip = outcomeChipColors(m.hitType);
  const sign = m.points > 0 ? "+" : "";
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${C.border};border-radius:12px;background-color:${C.card};margin-top:10px;">
      <tr>
        <td style="padding:16px 18px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td width="42%" style="font-family:${SANS};font-size:15px;font-weight:600;color:${C.ink};text-align:right;">${escapeHtml(
                m.homeTeam,
              )}</td>
              <td width="16%" style="text-align:center;">
                <span style="font-family:${MONO};font-size:20px;font-weight:800;color:${C.ink};white-space:nowrap;">${m.homeScore}&nbsp;&ndash;&nbsp;${m.awayScore}</span>
              </td>
              <td width="42%" style="font-family:${SANS};font-size:15px;font-weight:600;color:${C.ink};text-align:left;">${escapeHtml(
                m.awayTeam,
              )}</td>
            </tr>
          </table>
          <div style="margin-top:12px;text-align:center;">
            <span style="display:inline-block;padding:4px 10px;border-radius:6px;background-color:${chip.bg};font-family:${MONO};font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:${chip.fg};">${escapeHtml(
              s.outcomes[m.hitType],
            )} &middot; ${sign}${m.points} ${escapeHtml(s.ptsSuffix)}</span>
          </div>
        </td>
      </tr>
    </table>`;
}

function renderResults(data: ResultEmailData): string {
  const cards = data.matches.map((m) => renderMatchCard(m, data.strings)).join("");
  return `
    <tr>
      <td style="padding:18px 28px 4px 28px;">
        ${monoLabel(data.strings.resultsLabel, C.muted)}
        ${cards}
      </td>
    </tr>`;
}

function renderStanding(data: ResultEmailData): string {
  const { standing, strings } = data;
  const badge = rankBadgeColors(standing.rank);
  const rankText = standing.rank != null ? String(standing.rank) : "—";
  const name = data.displayName ?? "—";
  return `
    <tr>
      <td style="padding:18px 28px 8px 28px;">
        ${monoLabel(strings.standingLabel, C.muted)}
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${C.border};border-radius:12px;background-color:${C.card};margin-top:10px;overflow:hidden;">
          <tr style="background-color:${C.mutedTint};">
            <td style="padding:8px 14px;">${monoLabel(strings.rankLabel, C.muted)}</td>
            <td style="padding:8px 14px;">${monoLabel(strings.playerLabel, C.muted)}</td>
            <td style="padding:8px 14px;text-align:right;">${monoLabel(strings.pointsLabel, C.muted)}</td>
            <td style="padding:8px 14px;text-align:right;">${monoLabel(strings.exactLabel, C.muted)}</td>
            <td style="padding:8px 14px;text-align:right;">${monoLabel(strings.winnerGdLabel, C.muted)}</td>
          </tr>
          <tr style="background-color:${C.flag}1f;">
            <td style="padding:12px 14px;">
              <span style="display:inline-block;min-width:30px;padding:4px 7px;border-radius:6px;background-color:${badge.bg};font-family:${MONO};font-size:13px;font-weight:700;text-align:center;color:${badge.fg};">${rankText}</span>
            </td>
            <td style="padding:12px 14px;font-family:${SANS};font-size:14px;font-weight:600;color:${C.ink};">
              ${escapeHtml(name)}
              <span style="display:inline-block;margin-left:6px;padding:2px 6px;border-radius:5px;background-color:${C.flag};font-family:${MONO};font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.16em;color:${C.flagFg};">${escapeHtml(
                strings.youLabel,
              )}</span>
            </td>
            <td style="padding:12px 14px;text-align:right;font-family:${MONO};font-size:16px;font-weight:700;color:${C.ink};">${standing.totalPoints}</td>
            <td style="padding:12px 14px;text-align:right;font-family:${MONO};font-size:14px;color:${C.muted};">${standing.exactHits}</td>
            <td style="padding:12px 14px;text-align:right;font-family:${MONO};font-size:14px;color:${C.muted};">${standing.winnerGdHits}</td>
          </tr>
        </table>
        ${renderRankDeltaLine(data)}
      </td>
    </tr>`;
}

// Rank-movement line under the standing table. `up`/`down` use the pitch/live
// accent; the neutral variant (`same`/`new`/null) stays muted. Always present so
// the section never collapses; the copy itself is resolved by the caller.
function renderRankDeltaLine(data: ResultEmailData): string {
  const dir = data.rankDelta?.direction ?? "new";
  const color = dir === "up" ? C.pitch : dir === "down" ? C.live : C.muted;
  return `<p style="margin:10px 2px 0 2px;font-family:${SANS};font-size:13px;line-height:1.5;font-weight:600;color:${color};">${escapeHtml(
    data.strings.rankDelta,
  )}</p>`;
}

function renderCta(data: ResultEmailData): string {
  return `
    <tr>
      <td style="padding:20px 28px 28px 28px;text-align:center;">
        <a href="${escapeHtml(data.leaderboardUrl)}" style="display:inline-block;padding:12px 22px;border-radius:8px;background-color:${C.pitch};font-family:${SANS};font-size:14px;font-weight:700;color:${C.pitchFg};text-decoration:none;">${escapeHtml(
          data.strings.ctaLabel,
        )}</a>
      </td>
    </tr>`;
}

function renderFooter(s: ResultEmailStrings): string {
  return `
    <tr>
      <td style="padding:18px 28px 28px 28px;border-top:1px solid ${C.border};">
        <p style="margin:0;font-family:${SANS};font-size:12px;line-height:1.5;color:${C.muted};">${escapeHtml(
          s.footer,
        )}</p>
      </td>
    </tr>`;
}

// --- public renderer -------------------------------------------------------

export function renderResultEmail(data: ResultEmailData): ResultEmailRendered {
  const s = data.strings;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${escapeHtml(s.subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:${C.background};">
<span style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(s.preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${C.background};">
  <tr>
    <td align="center" style="padding:24px 12px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;border:1px solid ${C.border};border-radius:16px;overflow:hidden;background-color:${C.background};">
        ${renderHeader()}
        ${renderIntro(s)}
        ${renderResults(data)}
        ${renderStanding(data)}
        ${renderCta(data)}
        ${renderFooter(s)}
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;

  const text = renderText(data);

  return { subject: s.subject, html, text };
}

// Plain-text part mirroring the HTML content for non-HTML clients.
function renderText(data: ResultEmailData): string {
  const s = data.strings;
  const lines: string[] = [];
  lines.push(s.heading);
  lines.push("");
  lines.push(s.intro);
  lines.push("");
  lines.push(s.resultsLabel.toUpperCase());
  for (const m of data.matches) {
    const sign = m.points > 0 ? "+" : "";
    lines.push(
      `  ${m.homeTeam} ${m.homeScore}-${m.awayScore} ${m.awayTeam}  (${s.outcomes[m.hitType]}, ${sign}${m.points} ${s.ptsSuffix})`,
    );
  }
  lines.push("");
  lines.push(s.standingLabel.toUpperCase());
  const rankText = data.standing.rank != null ? String(data.standing.rank) : "—";
  lines.push(
    `  ${s.rankLabel} ${rankText} · ${s.pointsLabel} ${data.standing.totalPoints} · ${s.exactLabel} ${data.standing.exactHits} · ${s.winnerGdLabel} ${data.standing.winnerGdHits}`,
  );
  lines.push(`  ${s.rankDelta}`);
  lines.push("");
  lines.push(`${s.ctaLabel}: ${data.leaderboardUrl}`);
  lines.push("");
  lines.push(s.footer);
  return lines.join("\n");
}
