// Pure, dependency-free renderer for the one-time onboarding welcome email.
// Mirrors the result/quiz emails' visual language (pitch-green header, cream
// body, gold accents, mono uppercase labels) using email-safe HTML: table
// layout, inline styles, fixed hex colors (no oklch, CSS variables, or
// stylesheets).
//
// No database or network access — callers assemble `WelcomeEmailData` and pass
// already-localized copy in `strings`, keeping this fully unit-testable.

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
  pitchTint: "#E3EFE8",
} as const;

const SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const MONO = "'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,Consolas,monospace";

// All copy is resolved by the caller (next-intl) and passed in — value-bearing
// strings (subject, heading) arrive already interpolated.
export interface WelcomeEmailStrings {
  subject: string;
  preheader: string;
  eyebrow: string;
  heading: string;
  headingNoName: string;
  intro: string;
  quizTitle: string;
  quizBlurb: string;
  quizCta: string;
  groupsTitle: string;
  groupsBlurb: string;
  groupsCta: string;
  leaderboardTitle: string;
  leaderboardBlurb: string;
  leaderboardCta: string;
  footer: string;
}

export interface WelcomeEmailData {
  displayName: string | null;
  quizUrl: string;
  groupsUrl: string;
  leaderboardUrl: string;
  strings: WelcomeEmailStrings;
}

export interface WelcomeEmailRendered {
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

// The heading uses the personalized variant when a display name is available,
// falling back to the name-less variant otherwise.
function resolveHeading(data: WelcomeEmailData): string {
  return data.displayName ? data.strings.heading : data.strings.headingNoName;
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

function renderIntro(data: WelcomeEmailData): string {
  const s = data.strings;
  return `
    <tr>
      <td style="padding:28px 28px 8px 28px;">
        ${monoLabel(s.eyebrow, C.muted)}
        <h1 style="margin:6px 0 0 0;font-family:${SANS};font-size:24px;line-height:1.2;font-weight:700;color:${C.ink};">${escapeHtml(
          resolveHeading(data),
        )}</h1>
        <p style="margin:8px 0 0 0;font-family:${SANS};font-size:14px;line-height:1.5;color:${C.muted};">${escapeHtml(
          s.intro,
        )}</p>
      </td>
    </tr>`;
}

// One oriented "core loop" section: a titled card with a blurb and a deep link.
function renderLoop(title: string, blurb: string, cta: string, url: string): string {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${C.border};border-radius:12px;background-color:${C.card};margin-top:10px;">
      <tr>
        <td style="padding:16px 18px;">
          <h2 style="margin:0;font-family:${SANS};font-size:16px;font-weight:700;color:${C.ink};">${escapeHtml(
            title,
          )}</h2>
          <p style="margin:6px 0 0 0;font-family:${SANS};font-size:13px;line-height:1.5;color:${C.muted};">${escapeHtml(
            blurb,
          )}</p>
          <p style="margin:12px 0 0 0;">
            <a href="${escapeHtml(url)}" style="display:inline-block;padding:9px 16px;border-radius:8px;background-color:${C.pitchTint};font-family:${SANS};font-size:13px;font-weight:700;color:${C.pitch};text-decoration:none;">${escapeHtml(
              cta,
            )}</a>
          </p>
        </td>
      </tr>
    </table>`;
}

function renderLoops(data: WelcomeEmailData): string {
  const s = data.strings;
  return `
    <tr>
      <td style="padding:18px 28px 4px 28px;">
        ${renderLoop(s.quizTitle, s.quizBlurb, s.quizCta, data.quizUrl)}
        ${renderLoop(s.groupsTitle, s.groupsBlurb, s.groupsCta, data.groupsUrl)}
        ${renderLoop(s.leaderboardTitle, s.leaderboardBlurb, s.leaderboardCta, data.leaderboardUrl)}
      </td>
    </tr>`;
}

function renderFooter(s: WelcomeEmailStrings): string {
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

export function renderWelcomeEmail(data: WelcomeEmailData): WelcomeEmailRendered {
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
        ${renderIntro(data)}
        ${renderLoops(data)}
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
function renderText(data: WelcomeEmailData): string {
  const s = data.strings;
  const lines: string[] = [];
  lines.push(resolveHeading(data));
  lines.push("");
  lines.push(s.intro);
  lines.push("");
  lines.push(`${s.quizTitle} — ${s.quizBlurb}`);
  lines.push(`${s.quizCta}: ${data.quizUrl}`);
  lines.push("");
  lines.push(`${s.groupsTitle} — ${s.groupsBlurb}`);
  lines.push(`${s.groupsCta}: ${data.groupsUrl}`);
  lines.push("");
  lines.push(`${s.leaderboardTitle} — ${s.leaderboardBlurb}`);
  lines.push(`${s.leaderboardCta}: ${data.leaderboardUrl}`);
  lines.push("");
  lines.push(s.footer);
  return lines.join("\n");
}
