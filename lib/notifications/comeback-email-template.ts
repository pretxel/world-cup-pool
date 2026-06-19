// Pure, dependency-free renderer for the comeback (re-engagement) email.
// Mirrors the prediction-reminder visual language (pitch-green header, cream
// body, mono uppercase labels) using email-safe HTML: table layout, inline
// styles, fixed hex colors (no oklch, CSS variables, or stylesheets).
//
// No database or network access — callers assemble `ComebackEmailData` and pass
// already-localized copy in `strings` plus the resolved data (days since last
// pick, rank/points, next matches), keeping this fully unit-testable.

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
} as const;

const SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const MONO = "'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,Consolas,monospace";

// All copy is resolved by the caller (next-intl) and passed in — value-bearing
// strings (subject, heading, daysInactiveLabel, rankLabel) arrive already
// interpolated. `vs` is the separator rendered between the two teams of each
// fixture (e.g. "vs"). `unrankedLabel` is shown instead of a rank when the
// recipient is absent from the leaderboard view.
export interface ComebackEmailStrings {
  subject: string;
  preheader: string;
  eyebrow: string;
  heading: string;
  intro: string;
  daysInactiveLabel: string;
  rankLabel: string;
  unrankedLabel: string;
  pointsLabel: string;
  matchesLabel: string;
  vs: string;
  ctaLabel: string;
  footer: string;
  unsubscribeLabel: string;
}

// One confirmed, still-pickable upcoming match. `kickoffLabel` is a
// pre-formatted, human-readable time (e.g. "12:00 UTC"); this renderer does no
// date math.
export interface ComebackEmailMatch {
  home: string;
  away: string;
  kickoffLabel: string;
}

export interface ComebackEmailData {
  strings: ComebackEmailStrings;
  // The recipient's current overall rank, or null when they are absent from the
  // leaderboard view (picks but no scored match yet) — rendered as "unranked".
  rank: number | null;
  totalPoints: number;
  matches: ComebackEmailMatch[];
  predictionsUrl: string;
  unsubscribeUrl: string;
}

export interface ComebackEmailRendered {
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

function renderBody(s: ComebackEmailStrings): string {
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

// The days-inactive + rank/points "reason to return" block. `daysInactiveLabel`
// and `rankLabel` arrive already interpolated with the day count / rank number;
// when `rank` is null the unranked label is shown and points are omitted.
function renderStats(data: ComebackEmailData): string {
  const s = data.strings;
  const rankCell =
    data.rank === null
      ? `<span style="font-family:${SANS};font-size:15px;font-weight:700;color:${C.ink};">${escapeHtml(
          s.unrankedLabel,
        )}</span>`
      : `<span style="font-family:${SANS};font-size:15px;font-weight:700;color:${C.ink};">${escapeHtml(
          s.rankLabel,
        )}</span><br /><span style="font-family:${MONO};font-size:11px;color:${C.muted};">${escapeHtml(
          s.pointsLabel,
        )}</span>`;
  return `
    <tr>
      <td style="padding:12px 28px 0 28px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding:12px 14px;border:1px solid ${C.border};border-radius:10px;">
              <span style="font-family:${SANS};font-size:15px;font-weight:700;color:${C.pitch};">${escapeHtml(
                s.daysInactiveLabel,
              )}</span>
            </td>
            <td style="width:10px;font-size:0;line-height:0;">&nbsp;</td>
            <td style="padding:12px 14px;border:1px solid ${C.border};border-radius:10px;">
              ${rankCell}
            </td>
          </tr>
        </table>
      </td>
    </tr>`;
}

function renderMatches(data: ComebackEmailData): string {
  const s = data.strings;
  const rows = data.matches
    .map(
      (m) => `
        <tr>
          <td style="padding:10px 14px;border:1px solid ${C.border};border-radius:10px;">
            <span style="font-family:${SANS};font-size:15px;font-weight:700;color:${C.ink};">${escapeHtml(
              m.home,
            )} <span style="color:${C.muted};font-weight:600;">${escapeHtml(
              s.vs,
            )}</span> ${escapeHtml(m.away)}</span>
            <br />
            <span style="font-family:${MONO};font-size:11px;color:${C.muted};">${escapeHtml(
              m.kickoffLabel,
            )}</span>
          </td>
        </tr>
        <tr><td style="height:8px;line-height:8px;font-size:0;">&nbsp;</td></tr>`,
    )
    .join("");
  return `
    <tr>
      <td style="padding:16px 28px 0 28px;">
        ${monoLabel(s.matchesLabel, C.muted)}
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:10px;">
          ${rows}
        </table>
      </td>
    </tr>`;
}

function renderCta(data: ComebackEmailData): string {
  return `
    <tr>
      <td style="padding:12px 28px 28px 28px;text-align:center;">
        <a href="${escapeHtml(data.predictionsUrl)}" style="display:inline-block;padding:12px 22px;border-radius:8px;background-color:${C.pitch};font-family:${SANS};font-size:14px;font-weight:700;color:${C.pitchFg};text-decoration:none;">${escapeHtml(
          data.strings.ctaLabel,
        )}</a>
      </td>
    </tr>`;
}

function renderFooter(data: ComebackEmailData): string {
  const s = data.strings;
  return `
    <tr>
      <td style="padding:18px 28px 28px 28px;border-top:1px solid ${C.border};">
        <p style="margin:0;font-family:${SANS};font-size:12px;line-height:1.5;color:${C.muted};">${escapeHtml(
          s.footer,
        )}</p>
        <p style="margin:8px 0 0 0;font-family:${SANS};font-size:12px;line-height:1.5;">
          <a href="${escapeHtml(data.unsubscribeUrl)}" style="color:${C.muted};text-decoration:underline;">${escapeHtml(
            s.unsubscribeLabel,
          )}</a>
        </p>
      </td>
    </tr>`;
}

// --- public renderer -------------------------------------------------------

export function renderComebackEmail(data: ComebackEmailData): ComebackEmailRendered {
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
        ${renderBody(s)}
        ${renderStats(data)}
        ${renderMatches(data)}
        ${renderCta(data)}
        ${renderFooter(data)}
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;

  return { subject: s.subject, html, text: renderText(data) };
}

// Plain-text part mirroring the HTML content for non-HTML clients.
function renderText(data: ComebackEmailData): string {
  const s = data.strings;
  const lines: string[] = [];
  lines.push(s.heading);
  lines.push("");
  lines.push(s.intro);
  lines.push("");
  lines.push(s.daysInactiveLabel);
  if (data.rank === null) {
    lines.push(s.unrankedLabel);
  } else {
    lines.push(`${s.rankLabel} — ${s.pointsLabel}`);
  }
  lines.push("");
  lines.push(s.matchesLabel);
  for (const m of data.matches) {
    lines.push(`- ${m.home} ${s.vs} ${m.away} (${m.kickoffLabel})`);
  }
  lines.push("");
  lines.push(`${s.ctaLabel}: ${data.predictionsUrl}`);
  lines.push("");
  lines.push(s.footer);
  lines.push(`${s.unsubscribeLabel}: ${data.unsubscribeUrl}`);
  return lines.join("\n");
}
