// Pure, dependency-free renderer for the WinScore rebrand + new-features
// announcement email. Mirrors winners-email-template.ts: the app's visual
// language (pitch-green header, cream body, gold/ink accents, mono uppercase
// labels) using email-safe HTML — table layout, inline styles, fixed hex colors
// (no oklch, CSS variables, or stylesheets).
//
// No database or network access — callers assemble `AnnouncementEmailData` and
// pass already-localized copy in `strings`, keeping this fully unit-testable.
// The template is identical for every recipient (a broadcast); nothing is
// personalized, so the same rendered output is reused per send.

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

// One "what's new" entry: a short title and a one-line description.
export interface AnnouncementFeature {
  title: string;
  body: string;
}

// All copy is resolved by the caller (next-intl) and passed in already
// localized. The feature list is variable-length so copy can grow ("and more")
// without a template change.
export interface AnnouncementEmailStrings {
  subject: string;
  preheader: string;
  eyebrow: string;
  heading: string;
  intro: string;
  whatsNewLabel: string;
  features: AnnouncementFeature[];
  ctaLabel: string;
  footer: string;
  // "Made with love :) — pretxel" credit line.
  madeWithLove: string;
}

export interface AnnouncementEmailData {
  // Absolute URL the CTA points at (winscore.me landing / home).
  ctaUrl: string;
  strings: AnnouncementEmailStrings;
}

export interface AnnouncementEmailRendered {
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

// The new WinScore wordmark, replacing the old "WC 26 POOL" mark: "Win" in the
// header foreground, a gold "Score" chip, and the ".me" domain tag.
function renderHeader(): string {
  return `
  <tr>
    <td style="background-color:${C.pitch};padding:22px 28px;">
      <span style="font-family:${SANS};font-size:22px;font-weight:800;letter-spacing:-0.5px;color:${C.pitchFg};">Win</span>
      <span style="display:inline-block;margin:0 2px;padding:2px 8px;border-radius:7px;background-color:${C.flag};font-family:${SANS};font-size:20px;font-weight:800;letter-spacing:-0.5px;color:${C.flagFg};vertical-align:middle;">Score</span>
      <span style="font-family:${MONO};font-size:12px;font-weight:600;letter-spacing:0.3em;color:${C.pitchFg};vertical-align:middle;">.ME</span>
    </td>
  </tr>`;
}

function renderIntro(s: AnnouncementEmailStrings): string {
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

function renderFeatures(s: AnnouncementEmailStrings): string {
  const rows = s.features
    .map(
      (f, i) => `
        <tr style="background-color:${i % 2 === 1 ? C.mutedTint : C.card};">
          <td style="padding:14px 16px;font-family:${SANS};">
            <span style="display:block;font-size:15px;font-weight:700;color:${C.ink};">${escapeHtml(
              f.title,
            )}</span>
            <span style="display:block;margin-top:3px;font-size:13px;line-height:1.5;color:${C.muted};">${escapeHtml(
              f.body,
            )}</span>
          </td>
        </tr>`,
    )
    .join("");

  return `
  <tr>
    <td style="padding:20px 28px 0 28px;">
      ${monoLabel(s.whatsNewLabel, C.muted)}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${C.border};border-radius:12px;background-color:${C.card};margin-top:10px;overflow:hidden;">
        ${rows}
      </table>
    </td>
  </tr>`;
}

function renderCta(data: AnnouncementEmailData): string {
  return `
  <tr>
    <td style="padding:24px 28px;text-align:center;">
      <a href="${escapeHtml(data.ctaUrl)}" style="display:inline-block;padding:12px 22px;border-radius:8px;background-color:${C.pitch};font-family:${SANS};font-size:14px;font-weight:700;color:${C.pitchFg};text-decoration:none;">${escapeHtml(
        data.strings.ctaLabel,
      )}</a>
    </td>
  </tr>`;
}

function renderFooter(s: AnnouncementEmailStrings): string {
  return `
  <tr>
    <td style="padding:18px 28px;border-top:1px solid ${C.border};">
      <p style="margin:0;font-family:${SANS};font-size:12px;line-height:1.5;color:${C.muted};">${escapeHtml(
        s.footer,
      )}</p>
      <p style="margin:8px 0 0 0;font-family:${SANS};font-size:12px;line-height:1.5;color:${C.muted};">${escapeHtml(
        s.madeWithLove,
      )}</p>
    </td>
  </tr>`;
}

// --- entry points ----------------------------------------------------------

export function renderAnnouncementEmail(data: AnnouncementEmailData): AnnouncementEmailRendered {
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
        ${renderFeatures(s)}
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
function renderText(data: AnnouncementEmailData): string {
  const s = data.strings;
  const lines: string[] = [];
  lines.push(s.heading);
  lines.push("");
  lines.push(s.intro);
  lines.push("");
  lines.push(s.whatsNewLabel.toUpperCase());
  for (const f of s.features) {
    lines.push(` • ${f.title} — ${f.body}`);
  }
  lines.push("");
  lines.push(`${s.ctaLabel}: ${data.ctaUrl}`);
  lines.push("");
  lines.push(s.footer);
  lines.push(s.madeWithLove);
  return lines.join("\n");
}
