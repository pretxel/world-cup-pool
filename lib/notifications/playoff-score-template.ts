// Pure, dependency-free renderer for the weekly Saturday playoff-score email.
// Mirrors results-digest-template.ts: the web leaderboard's visual language
// (pitch-green header, cream body, mono uppercase labels) using email-safe HTML
// — table layout, inline styles, fixed hex colors (no oklch, CSS variables, or
// stylesheets).
//
// Deliberately minimal: the body is JUST the final scorelines of the day's
// finished knockout matches. No per-player points, hit type, rank, movers, or
// bracket-progression sections — those live in other emails. No database or
// network access — the caller assembles `PlayoffScoreData` and passes already-
// localized copy in `strings`, keeping this fully unit-testable.

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
  mutedTint: "#F0EEE6",
} as const;

const SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const MONO = "'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,Consolas,monospace";

// One finished knockout match. Scores are nullable defensively, though a `final`
// match should always carry both. `resultNote` is an optional knockout decider
// hint (e.g. "AET", "won on penalties") shown when the caller has one; the
// current schema has no decider column, so it is normally absent.
export interface PlayoffScoreMatch {
  home: string;
  away: string;
  homeScore: number | null;
  awayScore: number | null;
  resultNote?: string | null;
  // Optional localized stage label (e.g. "Round of 16"). Shown as an eyebrow on
  // the row when present; omitted otherwise.
  stageLabel?: string | null;
}

// All copy is resolved by the caller (next-intl) and passed in — value-bearing
// strings (subject, heading) arrive already interpolated.
export interface PlayoffScoreStrings {
  subject: string;
  preheader: string;
  eyebrow: string;
  heading: string;
  intro: string;
  resultsLabel: string;
  // Joining word between the two scores, e.g. "–". Kept in copy so RTL/locale
  // variants can override it.
  scoreSeparator: string;
  ctaLabel: string;
  footer: string;
}

export interface PlayoffScoreData {
  matches: PlayoffScoreMatch[];
  strings: PlayoffScoreStrings;
  bracketUrl: string;
}

export interface PlayoffScoreRendered {
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

function monoLabel(text: string, color: string): string {
  return `<span style="font-family:${MONO};font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.2em;color:${color};">${escapeHtml(
    text,
  )}</span>`;
}

// "2 – 1" — the scoreline as a mono chip. A null score renders as an em dash so
// a malformed row never throws.
function scoreText(match: PlayoffScoreMatch, separator: string): string {
  const h = match.homeScore != null ? String(match.homeScore) : "—";
  const a = match.awayScore != null ? String(match.awayScore) : "—";
  return `${h} ${separator} ${a}`;
}

// --- HTML sections ---------------------------------------------------------

function renderHeader(): string {
  return `
    <tr>
      <td style="background-color:${C.pitch};padding:22px 28px;">
        <span style="font-family:${SANS};font-size:22px;font-weight:800;letter-spacing:-0.5px;color:${C.pitchFg};">WC</span>
        <span style="display:inline-block;margin:0 6px;padding:2px 8px;border-radius:7px;background-color:${C.pitchFg};font-family:${MONO};font-size:16px;font-weight:800;letter-spacing:-1px;color:${C.pitch};vertical-align:middle;">26</span>
        <span style="font-family:${MONO};font-size:12px;font-weight:600;letter-spacing:0.3em;color:${C.pitchFg};vertical-align:middle;">POOL</span>
      </td>
    </tr>`;
}

function renderIntro(s: PlayoffScoreStrings): string {
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

function renderMatchRow(match: PlayoffScoreMatch, s: PlayoffScoreStrings, zebra: string): string {
  const eyebrow = match.stageLabel
    ? `<div style="margin-bottom:4px;">${monoLabel(match.stageLabel, C.muted)}</div>`
    : "";
  const note = match.resultNote
    ? `<div style="margin-top:2px;font-family:${MONO};font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.12em;color:${C.muted};">${escapeHtml(
        match.resultNote,
      )}</div>`
    : "";
  return `
          <tr style="background-color:${zebra};">
            <td style="padding:14px 16px;font-family:${SANS};font-size:15px;font-weight:600;color:${C.ink};">
              ${eyebrow}${escapeHtml(match.home)} <span style="color:${C.muted};font-weight:400;">v</span> ${escapeHtml(
                match.away,
              )}
            </td>
            <td style="padding:14px 16px;text-align:right;white-space:nowrap;">
              <span style="display:inline-block;padding:6px 12px;border-radius:8px;background-color:${C.pitch};font-family:${MONO};font-size:16px;font-weight:700;color:${C.pitchFg};">${escapeHtml(
                scoreText(match, s.scoreSeparator),
              )}</span>
              ${note}
            </td>
          </tr>`;
}

function renderMatches(data: PlayoffScoreData): string {
  const s = data.strings;
  const rows = data.matches
    .map((m, i) => renderMatchRow(m, s, i % 2 === 0 ? C.card : C.mutedTint))
    .join("");
  return `
    <tr>
      <td style="padding:18px 28px 4px 28px;">
        ${monoLabel(s.resultsLabel, C.muted)}
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${C.border};border-radius:12px;background-color:${C.card};margin-top:10px;overflow:hidden;">
          ${rows}
        </table>
      </td>
    </tr>`;
}

function renderCta(data: PlayoffScoreData): string {
  return `
    <tr>
      <td style="padding:20px 28px 28px 28px;text-align:center;">
        <a href="${escapeHtml(data.bracketUrl)}" style="display:inline-block;padding:12px 22px;border-radius:8px;background-color:${C.pitch};font-family:${SANS};font-size:14px;font-weight:700;color:${C.pitchFg};text-decoration:none;">${escapeHtml(
          data.strings.ctaLabel,
        )}</a>
      </td>
    </tr>`;
}

function renderFooter(s: PlayoffScoreStrings): string {
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

export function renderPlayoffScoreEmail(data: PlayoffScoreData): PlayoffScoreRendered {
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
        ${renderMatches(data)}
        ${renderCta(data)}
        ${renderFooter(s)}
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;

  return { subject: s.subject, html, text: renderText(data) };
}

// Plain-text part mirroring the HTML content for non-HTML clients.
function renderText(data: PlayoffScoreData): string {
  const s = data.strings;
  const lines: string[] = [];
  lines.push(s.heading);
  lines.push("");
  lines.push(s.intro);
  lines.push("");
  lines.push(s.resultsLabel.toUpperCase());
  for (const m of data.matches) {
    const stage = m.stageLabel ? `[${m.stageLabel}] ` : "";
    const note = m.resultNote ? ` (${m.resultNote})` : "";
    lines.push(`  ${stage}${m.home} ${scoreText(m, s.scoreSeparator)} ${m.away}${note}`);
  }
  lines.push("");
  lines.push(`${s.ctaLabel}: ${data.bracketUrl}`);
  lines.push("");
  lines.push(s.footer);
  return lines.join("\n");
}
