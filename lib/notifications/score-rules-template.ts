// Pure, dependency-free renderer for the scoring-rules announcement email.
// Mirrors playoff-score-template.ts: the web leaderboard's visual language
// (pitch-green header, cream body, mono uppercase labels) using email-safe HTML
// — table layout, inline styles, fixed hex colors (no oklch, CSS variables, or
// stylesheets).
//
// The body is a per-phase points table: each stage with the points on offer for
// the accuracy tiers (exact / winner+GD / winner). The caller assembles the
// rows from the shared scoring constants (BASE_POINTS × STAGE_POINT_MULTIPLIER)
// and passes already-localized copy in `strings`, so this stays fully
// unit-testable and can never drift from the actual scorer.

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

// One phase row: a localized stage label, its multiplier, and the resolved
// points for each accuracy tier (already base × multiplier).
export interface ScoreRulesPhaseRow {
  stageLabel: string;
  multiplier: number;
  exact: number;
  winnerGd: number;
  winner: number;
}

// All copy is resolved by the caller (next-intl) and passed in — value-bearing
// strings (subject, heading) arrive already interpolated.
export interface ScoreRulesStrings {
  subject: string;
  preheader: string;
  eyebrow: string;
  heading: string;
  intro: string;
  tableLabel: string;
  // Column headers for the points table.
  phaseHeader: string;
  multHeader: string;
  exactHeader: string;
  winnerGdHeader: string;
  winnerHeader: string;
  ctaLabel: string;
  footer: string;
}

export interface ScoreRulesData {
  phases: ScoreRulesPhaseRow[];
  strings: ScoreRulesStrings;
  ctaUrl: string;
}

export interface ScoreRulesRendered {
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

function renderIntro(s: ScoreRulesStrings): string {
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

function th(text: string, align: "left" | "right"): string {
  return `<th style="padding:10px 14px;text-align:${align};font-family:${MONO};font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.16em;color:${C.muted};border-bottom:1px solid ${C.border};">${escapeHtml(
    text,
  )}</th>`;
}

function renderPhaseRow(row: ScoreRulesPhaseRow, zebra: string): string {
  const num = (n: number) =>
    `<td style="padding:12px 14px;text-align:right;font-family:${MONO};font-size:15px;font-weight:700;color:${C.ink};">${n}</td>`;
  return `
          <tr style="background-color:${zebra};">
            <th scope="row" style="padding:12px 14px;text-align:left;font-family:${SANS};font-size:14px;font-weight:600;color:${C.ink};">${escapeHtml(
              row.stageLabel,
            )}</th>
            <td style="padding:12px 14px;text-align:right;font-family:${MONO};font-size:12px;color:${C.muted};">${row.multiplier}×</td>
            ${num(row.exact)}
            ${num(row.winnerGd)}
            ${num(row.winner)}
          </tr>`;
}

function renderTable(data: ScoreRulesData): string {
  const s = data.strings;
  const rows = data.phases
    .map((p, i) => renderPhaseRow(p, i % 2 === 0 ? C.card : C.mutedTint))
    .join("");
  return `
    <tr>
      <td style="padding:18px 28px 4px 28px;">
        ${monoLabel(s.tableLabel, C.muted)}
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${C.border};border-radius:12px;background-color:${C.card};margin-top:10px;overflow:hidden;">
          <thead>
            <tr>
              ${th(s.phaseHeader, "left")}
              ${th(s.multHeader, "right")}
              ${th(s.exactHeader, "right")}
              ${th(s.winnerGdHeader, "right")}
              ${th(s.winnerHeader, "right")}
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </td>
    </tr>`;
}

function renderCta(data: ScoreRulesData): string {
  return `
    <tr>
      <td style="padding:20px 28px 28px 28px;text-align:center;">
        <a href="${escapeHtml(data.ctaUrl)}" style="display:inline-block;padding:12px 22px;border-radius:8px;background-color:${C.pitch};font-family:${SANS};font-size:14px;font-weight:700;color:${C.pitchFg};text-decoration:none;">${escapeHtml(
          data.strings.ctaLabel,
        )}</a>
      </td>
    </tr>`;
}

function renderFooter(s: ScoreRulesStrings): string {
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

export function renderScoreRulesEmail(data: ScoreRulesData): ScoreRulesRendered {
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
        ${renderTable(data)}
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
function renderText(data: ScoreRulesData): string {
  const s = data.strings;
  const lines: string[] = [];
  lines.push(s.heading);
  lines.push("");
  lines.push(s.intro);
  lines.push("");
  lines.push(s.tableLabel.toUpperCase());
  lines.push(
    `  ${s.phaseHeader} | ${s.multHeader} | ${s.exactHeader} | ${s.winnerGdHeader} | ${s.winnerHeader}`,
  );
  for (const p of data.phases) {
    lines.push(
      `  ${p.stageLabel} | ${p.multiplier}× | ${p.exact} | ${p.winnerGd} | ${p.winner}`,
    );
  }
  lines.push("");
  lines.push(`${s.ctaLabel}: ${data.ctaUrl}`);
  lines.push("");
  lines.push(s.footer);
  return lines.join("\n");
}
