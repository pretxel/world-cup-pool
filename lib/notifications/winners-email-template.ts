// Pure, dependency-free renderer for the pool winners congratulation email.
// Mirrors results-digest-template.ts: the web leaderboard's visual language
// (pitch-green header, cream body, gold/ink/green rank tones, mono uppercase
// labels) using email-safe HTML — table layout, inline styles, fixed hex colors
// (no oklch, CSS variables, or stylesheets).
//
// No database or network access — callers assemble `WinnersEmailData` and pass
// already-localized copy in `strings`, keeping this fully unit-testable. The
// podium table is shared across recipients; the heading/intro and the marked
// row personalize each send.

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
  mutedTint: "#F0EEE6",
} as const;

const SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const MONO = "'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,Consolas,monospace";

// One podium row. `isYou` marks the recipient's own row with the you-chip.
export interface WinnersPodiumRow {
  rank: number;
  displayName: string | null;
  totalPoints: number;
  isYou: boolean;
}

// All copy is resolved by the caller (next-intl) and passed in — value-bearing
// strings (subject, heading) arrive already interpolated with the recipient's
// rank, name, and points.
export interface WinnersEmailStrings {
  subject: string;
  preheader: string;
  eyebrow: string;
  heading: string;
  intro: string;
  podiumLabel: string;
  rankLabel: string;
  playerLabel: string;
  pointsLabel: string;
  youLabel: string;
  ctaLabel: string;
  footer: string;
  // "Made with love :) — pretxel" credit line.
  madeWithLove: string;
  // "Coming soon: La Liga Pool" teaser line.
  comingSoon: string;
}

export interface WinnersEmailData {
  displayName: string | null;
  rank: number;
  totalPoints: number;
  podium: WinnersPodiumRow[];
  leaderboardUrl: string;
  strings: WinnersEmailStrings;
}

export interface WinnersEmailRendered {
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

// RankBadge tones from components/leaderboard-table.tsx:
// 1st = gold, 2nd = ink, 3rd = green, else neutral.
function rankBadgeColors(rank: number): { bg: string; fg: string } {
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

function rankBadge(rank: number): string {
  const badge = rankBadgeColors(rank);
  return `<span style="display:inline-block;min-width:30px;padding:4px 7px;border-radius:6px;background-color:${badge.bg};font-family:${MONO};font-size:13px;font-weight:700;text-align:center;color:${badge.fg};">${rank}</span>`;
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

function renderIntro(s: WinnersEmailStrings): string {
  return `
  <tr>
    <td style="padding:28px 28px 8px 28px;">
      ${monoLabel(s.eyebrow, C.muted)}
      <h1 style="margin:8px 0 0 0;font-family:${SANS};font-size:24px;line-height:1.2;font-weight:700;color:${C.ink};">${escapeHtml(
        s.heading,
      )}</h1>
      <p style="margin:10px 0 0 0;font-family:${SANS};font-size:14px;line-height:1.5;color:${C.muted};">${escapeHtml(
        s.intro,
      )}</p>
    </td>
  </tr>`;
}

function renderPodium(data: WinnersEmailData): string {
  const s = data.strings;
  const rows = data.podium
    .map((r, i) => {
      const name = r.displayName ?? "—";
      const zebra = i % 2 === 1 ? C.mutedTint : C.card;
      const youChip = r.isYou
        ? `<span style="display:inline-block;margin-left:6px;padding:2px 6px;border-radius:5px;background-color:${C.flag};font-family:${MONO};font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.16em;color:${C.flagFg};">${escapeHtml(
            s.youLabel,
          )}</span>`
        : "";
      return `
        <tr style="background-color:${zebra};">
          <td style="padding:12px 14px;">${rankBadge(r.rank)}</td>
          <td style="padding:12px 14px;font-family:${SANS};font-size:14px;font-weight:600;color:${C.ink};">${escapeHtml(
            name,
          )}${youChip}</td>
          <td style="padding:12px 14px;text-align:right;font-family:${MONO};font-size:15px;font-weight:700;color:${C.ink};">${r.totalPoints}</td>
        </tr>`;
    })
    .join("");

  return `
  <tr>
    <td style="padding:20px 28px 0 28px;">
      ${monoLabel(s.podiumLabel, C.muted)}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${C.border};border-radius:12px;background-color:${C.card};margin-top:10px;overflow:hidden;">
        <tr style="background-color:${C.mutedTint};">
          <td style="padding:10px 14px;">${monoLabel(s.rankLabel, C.muted)}</td>
          <td style="padding:10px 14px;">${monoLabel(s.playerLabel, C.muted)}</td>
          <td style="padding:10px 14px;text-align:right;">${monoLabel(s.pointsLabel, C.muted)}</td>
        </tr>
        ${rows}
      </table>
    </td>
  </tr>`;
}

function renderCta(data: WinnersEmailData): string {
  return `
  <tr>
    <td style="padding:24px 28px;text-align:center;">
      <a href="${escapeHtml(data.leaderboardUrl)}" style="display:inline-block;padding:12px 22px;border-radius:8px;background-color:${C.pitch};font-family:${SANS};font-size:14px;font-weight:700;color:${C.pitchFg};text-decoration:none;">${escapeHtml(
        data.strings.ctaLabel,
      )}</a>
    </td>
  </tr>`;
}

function renderFooter(s: WinnersEmailStrings): string {
  return `
  <tr>
    <td style="padding:18px 28px;border-top:1px solid ${C.border};">
      <p style="margin:0;font-family:${SANS};font-size:12px;line-height:1.5;color:${C.muted};">${escapeHtml(
        s.footer,
      )}</p>
      <p style="margin:8px 0 0 0;font-family:${SANS};font-size:12px;line-height:1.5;color:${C.muted};">${escapeHtml(
        s.madeWithLove,
      )}</p>
      <p style="margin:4px 0 0 0;font-family:${MONO};font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.12em;color:${C.pitch};">${escapeHtml(
        s.comingSoon,
      )}</p>
    </td>
  </tr>`;
}

// --- entry points ----------------------------------------------------------

export function renderWinnersEmail(data: WinnersEmailData): WinnersEmailRendered {
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
        ${renderPodium(data)}
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

// Plain-text mirror of the HTML for non-HTML clients.
function renderText(data: WinnersEmailData): string {
  const s = data.strings;
  const lines: string[] = [];
  lines.push(s.heading);
  lines.push("");
  lines.push(s.intro);
  lines.push("");
  lines.push(s.podiumLabel.toUpperCase());
  for (const r of data.podium) {
    const you = r.isYou ? ` (${s.youLabel})` : "";
    lines.push(` ${r.rank}. ${r.displayName ?? "—"}${you} — ${r.totalPoints} ${s.pointsLabel}`);
  }
  lines.push("");
  lines.push(`${s.ctaLabel}: ${data.leaderboardUrl}`);
  lines.push("");
  lines.push(s.footer);
  lines.push(s.madeWithLove);
  lines.push(s.comingSoon);
  return lines.join("\n");
}
