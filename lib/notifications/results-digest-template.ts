// Pure, dependency-free renderer for the once-daily results-digest email.
// Mirrors result-email-template.ts: the web leaderboard's visual language
// (pitch-green header, cream body, gold/ink/green rank tones, mono uppercase
// labels) using email-safe HTML — table layout, inline styles, fixed hex colors
// (no oklch, CSS variables, or stylesheets).
//
// No database or network access — callers assemble `ResultsDigestData` and pass
// already-localized copy in `strings`, keeping this fully unit-testable. Day-
// shared sections (top 5, movers) render identically for every recipient; only
// the personal rank/delta block varies. The delta block is omitted when no
// previous-day baseline exists, and the movers section is omitted when null.

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
  pitchTint: "#E3EFE8",
  mutedTint: "#F0EEE6",
} as const;

const SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const MONO = "'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,Consolas,monospace";

// One row of the leaderboard top 5.
export interface DigestTopRow {
  rank: number;
  displayName: string | null;
  totalPoints: number;
}

// One of the day's biggest movers. `delta` is today's rank minus the prior
// snapshot's rank — negative means the player climbed (improved).
export interface DigestMover {
  displayName: string | null;
  rank: number;
  delta: number;
}

// The recipient's own standing. `delta` is null when there is no previous-day
// baseline (e.g. the very first run), in which case the delta line is omitted.
export interface DigestPersonal {
  rank: number | null;
  totalPoints: number;
  delta: number | null;
}

// All copy is resolved by the caller (next-intl) and passed in — value-bearing
// strings (subject, heading) arrive already interpolated.
export interface ResultsDigestStrings {
  subject: string;
  preheader: string;
  eyebrow: string;
  heading: string;
  intro: string;
  top5Label: string;
  rankLabel: string;
  playerLabel: string;
  pointsLabel: string;
  yourRankLabel: string;
  yourPointsLabel: string;
  deltaUpLabel: string;
  deltaDownLabel: string;
  deltaFlatLabel: string;
  moversLabel: string;
  climbedLabel: string;
  droppedLabel: string;
  youLabel: string;
  ctaLabel: string;
  footer: string;
}

export interface ResultsDigestData {
  displayName: string | null;
  top5: DigestTopRow[];
  personal: DigestPersonal;
  // null when no previous-day baseline exists — the section is omitted.
  movers: DigestMover[] | null;
  strings: ResultsDigestStrings;
  leaderboardUrl: string;
}

export interface ResultsDigestRendered {
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

function rankBadge(rank: number | null): string {
  const badge = rankBadgeColors(rank);
  const text = rank != null ? String(rank) : "—";
  return `<span style="display:inline-block;min-width:30px;padding:4px 7px;border-radius:6px;background-color:${badge.bg};font-family:${MONO};font-size:13px;font-weight:700;text-align:center;color:${badge.fg};">${escapeHtml(
    text,
  )}</span>`;
}

// A signed delta chip: a climb (negative) is pitch-green, a drop is the live
// red accent, no change is muted. Returns the localized label + magnitude.
function deltaChip(delta: number, s: ResultsDigestStrings): string {
  let bg: string = C.mutedTint;
  let fg: string = C.muted;
  let text = s.deltaFlatLabel;
  if (delta < 0) {
    bg = C.pitchTint;
    fg = C.pitch;
    text = `${s.deltaUpLabel} ${Math.abs(delta)}`;
  } else if (delta > 0) {
    bg = "#F7E0DC";
    fg = C.live;
    text = `${s.deltaDownLabel} ${delta}`;
  }
  return `<span style="display:inline-block;padding:3px 9px;border-radius:6px;background-color:${bg};font-family:${MONO};font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:${fg};">${escapeHtml(
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

function renderIntro(s: ResultsDigestStrings): string {
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

function renderTop5(data: ResultsDigestData): string {
  const s = data.strings;
  const rows = data.top5
    .map((r, i) => {
      const name = r.displayName ?? "—";
      const zebra = i % 2 === 0 ? C.card : C.mutedTint;
      return `
          <tr style="background-color:${zebra};">
            <td style="padding:10px 14px;">${rankBadge(r.rank)}</td>
            <td style="padding:10px 14px;font-family:${SANS};font-size:14px;font-weight:600;color:${C.ink};">${escapeHtml(
              name,
            )}</td>
            <td style="padding:10px 14px;text-align:right;font-family:${MONO};font-size:15px;font-weight:700;color:${C.ink};">${r.totalPoints}</td>
          </tr>`;
    })
    .join("");
  return `
    <tr>
      <td style="padding:18px 28px 4px 28px;">
        ${monoLabel(s.top5Label, C.muted)}
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${C.border};border-radius:12px;background-color:${C.card};margin-top:10px;overflow:hidden;">
          <tr style="background-color:${C.mutedTint};">
            <td style="padding:8px 14px;">${monoLabel(s.rankLabel, C.muted)}</td>
            <td style="padding:8px 14px;">${monoLabel(s.playerLabel, C.muted)}</td>
            <td style="padding:8px 14px;text-align:right;">${monoLabel(s.pointsLabel, C.muted)}</td>
          </tr>
          ${rows}
        </table>
      </td>
    </tr>`;
}

function renderPersonal(data: ResultsDigestData): string {
  const s = data.strings;
  const { personal } = data;
  const name = data.displayName ?? "—";
  const deltaCell =
    personal.delta != null
      ? `<td style="padding:12px 14px;text-align:right;">${deltaChip(personal.delta, s)}</td>`
      : "";
  return `
    <tr>
      <td style="padding:18px 28px 8px 28px;">
        ${monoLabel(s.yourRankLabel, C.muted)}
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${C.border};border-radius:12px;background-color:${C.card};margin-top:10px;overflow:hidden;">
          <tr style="background-color:${C.flag}1f;">
            <td style="padding:12px 14px;">${rankBadge(personal.rank)}</td>
            <td style="padding:12px 14px;font-family:${SANS};font-size:14px;font-weight:600;color:${C.ink};">
              ${escapeHtml(name)}
              <span style="display:inline-block;margin-left:6px;padding:2px 6px;border-radius:5px;background-color:${C.flag};font-family:${MONO};font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.16em;color:${C.flagFg};">${escapeHtml(
                s.youLabel,
              )}</span>
            </td>
            <td style="padding:12px 14px;text-align:right;font-family:${MONO};font-size:16px;font-weight:700;color:${C.ink};">${personal.totalPoints}</td>
            ${deltaCell}
          </tr>
        </table>
      </td>
    </tr>`;
}

function renderMovers(data: ResultsDigestData): string {
  if (!data.movers || data.movers.length === 0) return "";
  const s = data.strings;
  const rows = data.movers
    .map((m) => {
      const name = m.displayName ?? "—";
      const climbed = m.delta < 0;
      const label = climbed ? s.climbedLabel : s.droppedLabel;
      return `
          <tr>
            <td style="padding:10px 14px;">${rankBadge(m.rank)}</td>
            <td style="padding:10px 14px;font-family:${SANS};font-size:14px;font-weight:600;color:${C.ink};">${escapeHtml(
              name,
            )}<span style="display:block;font-family:${MONO};font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.12em;color:${C.muted};">${escapeHtml(
              label,
            )}</span></td>
            <td style="padding:10px 14px;text-align:right;">${deltaChip(m.delta, s)}</td>
          </tr>`;
    })
    .join("");
  return `
    <tr>
      <td style="padding:18px 28px 4px 28px;">
        ${monoLabel(s.moversLabel, C.muted)}
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${C.border};border-radius:12px;background-color:${C.card};margin-top:10px;overflow:hidden;">
          ${rows}
        </table>
      </td>
    </tr>`;
}

function renderCta(data: ResultsDigestData): string {
  return `
    <tr>
      <td style="padding:20px 28px 28px 28px;text-align:center;">
        <a href="${escapeHtml(data.leaderboardUrl)}" style="display:inline-block;padding:12px 22px;border-radius:8px;background-color:${C.pitch};font-family:${SANS};font-size:14px;font-weight:700;color:${C.pitchFg};text-decoration:none;">${escapeHtml(
          data.strings.ctaLabel,
        )}</a>
      </td>
    </tr>`;
}

function renderFooter(s: ResultsDigestStrings): string {
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

export function renderResultsDigest(data: ResultsDigestData): ResultsDigestRendered {
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
        ${renderTop5(data)}
        ${renderPersonal(data)}
        ${renderMovers(data)}
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
function renderText(data: ResultsDigestData): string {
  const s = data.strings;
  const lines: string[] = [];
  lines.push(s.heading);
  lines.push("");
  lines.push(s.intro);
  lines.push("");
  lines.push(s.top5Label.toUpperCase());
  for (const r of data.top5) {
    lines.push(`  ${r.rank}. ${r.displayName ?? "—"} — ${r.totalPoints} ${s.pointsLabel}`);
  }
  lines.push("");
  lines.push(s.yourRankLabel.toUpperCase());
  const rankText = data.personal.rank != null ? String(data.personal.rank) : "—";
  let yourLine = `  ${s.rankLabel} ${rankText} · ${s.pointsLabel} ${data.personal.totalPoints}`;
  if (data.personal.delta != null) {
    const d = data.personal.delta;
    const label = d < 0 ? `${s.deltaUpLabel} ${Math.abs(d)}` : d > 0 ? `${s.deltaDownLabel} ${d}` : s.deltaFlatLabel;
    yourLine += ` · ${label}`;
  }
  lines.push(yourLine);
  if (data.movers && data.movers.length > 0) {
    lines.push("");
    lines.push(s.moversLabel.toUpperCase());
    for (const m of data.movers) {
      const label = m.delta < 0 ? s.climbedLabel : s.droppedLabel;
      const mag = m.delta < 0 ? `${s.deltaUpLabel} ${Math.abs(m.delta)}` : `${s.deltaDownLabel} ${m.delta}`;
      lines.push(`  ${m.displayName ?? "—"} (${s.rankLabel} ${m.rank}) — ${label}, ${mag}`);
    }
  }
  lines.push("");
  lines.push(`${s.ctaLabel}: ${data.leaderboardUrl}`);
  lines.push("");
  lines.push(s.footer);
  return lines.join("\n");
}
