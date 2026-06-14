// Pure, dependency-free renderer for the magic-link (and related auth) email.
// Mirrors the web app's visual language and the result-standing email
// (pitch-green header, cream body, WC·26·POOL wordmark, mono uppercase labels)
// using email-safe HTML: table layout, inline styles, fixed hex colors (no
// oklch, CSS variables, or stylesheets).
//
// No database, network, or i18n access — the route handler resolves localized
// copy via next-intl and passes it in `strings`, keeping this fully
// unit-testable.

// ---------------------------------------------------------------------------
// Palette — fixed hex equivalents of the app's light-theme oklch tokens.
// Duplicated from result-email-template.ts (not shared) because each email
// renderer is intentionally standalone and mail clients can't resolve
// var()/oklch.
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

// Auth email types that carry an action link we render a branded email for.
// GoTrue's Send Email Hook delivers many more types once enabled; the route
// handler no-ops the rest. `magiclink` is the only one the app triggers today.
export const LINK_ACTIONS = [
  "magiclink",
  "signup",
  "recovery",
  "invite",
  "email_change",
] as const;

export type MagicLinkAction = (typeof LINK_ACTIONS)[number];

export function isLinkAction(value: string): value is MagicLinkAction {
  return (LINK_ACTIONS as readonly string[]).includes(value);
}

// Fully-resolved, value-bearing copy for one email. Per-action strings
// (subject/heading/intro/cta) are chosen by the caller; the rest are shared.
export interface MagicLinkEmailStrings {
  subject: string;
  preheader: string;
  eyebrow: string;
  heading: string;
  intro: string;
  ctaLabel: string;
  fallbackLabel: string;
  expiryNote: string;
  ignoreNote: string;
  footer: string;
}

export interface MagicLinkEmailData {
  actionUrl: string;
  strings: MagicLinkEmailStrings;
}

export interface MagicLinkEmailRendered {
  subject: string;
  html: string;
  text: string;
}

// Minimal translator shape so this stays decoupled from next-intl internals.
type Translator = (key: string, values?: Record<string, unknown>) => string;

// Builds the resolved copy for one email from a next-intl translator scoped to
// the `email.magicLink` namespace. Unknown/non-link action types fall back to
// the `magiclink` copy so the caller always has sensible strings.
export function buildMagicLinkEmailStrings(
  t: Translator,
  action: string,
): MagicLinkEmailStrings {
  const a: MagicLinkAction = isLinkAction(action) ? action : "magiclink";
  return {
    subject: t(`actions.${a}.subject`),
    heading: t(`actions.${a}.heading`),
    intro: t(`actions.${a}.intro`),
    ctaLabel: t(`actions.${a}.ctaLabel`),
    preheader: t("preheader"),
    eyebrow: t("eyebrow"),
    fallbackLabel: t("fallbackLabel"),
    expiryNote: t("expiryNote"),
    ignoreNote: t("ignoreNote"),
    footer: t("footer"),
  };
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
  // Pitch-green band with the WC·26·POOL wordmark in cream — identical to the
  // result email's signature, without depending on the SVG logotype (var()).
  return `
    <tr>
      <td style="background-color:${C.pitch};padding:22px 28px;">
        <span style="font-family:${SANS};font-size:22px;font-weight:800;letter-spacing:-0.5px;color:${C.pitchFg};">WC</span>
        <span style="display:inline-block;margin:0 6px;padding:2px 8px;border-radius:7px;background-color:${C.pitchFg};font-family:${MONO};font-size:16px;font-weight:800;letter-spacing:-1px;color:${C.pitch};vertical-align:middle;">26</span>
        <span style="font-family:${MONO};font-size:12px;font-weight:600;letter-spacing:0.3em;color:${C.pitchFg};vertical-align:middle;">POOL</span>
      </td>
    </tr>`;
}

function renderIntro(s: MagicLinkEmailStrings): string {
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

function renderCta(data: MagicLinkEmailData): string {
  // Primary action button + a copy-paste fallback link for clients that strip
  // buttons. The URL is escaped in both the href and the visible text.
  const url = escapeHtml(data.actionUrl);
  return `
    <tr>
      <td style="padding:20px 28px 8px 28px;text-align:center;">
        <a href="${url}" style="display:inline-block;padding:13px 26px;border-radius:8px;background-color:${C.pitch};font-family:${SANS};font-size:15px;font-weight:700;color:${C.pitchFg};text-decoration:none;">${escapeHtml(
          data.strings.ctaLabel,
        )}</a>
      </td>
    </tr>
    <tr>
      <td style="padding:14px 28px 4px 28px;">
        <p style="margin:0 0 6px 0;font-family:${SANS};font-size:12px;line-height:1.5;color:${C.muted};">${escapeHtml(
          data.strings.fallbackLabel,
        )}</p>
        <p style="margin:0;font-family:${MONO};font-size:12px;line-height:1.5;word-break:break-all;color:${C.pitch};">
          <a href="${url}" style="color:${C.pitch};text-decoration:underline;">${url}</a>
        </p>
      </td>
    </tr>`;
}

function renderNotice(s: MagicLinkEmailStrings): string {
  return `
    <tr>
      <td style="padding:16px 28px 4px 28px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${C.border};border-radius:10px;background-color:${C.mutedTint};">
          <tr>
            <td style="padding:12px 14px;">
              <p style="margin:0;font-family:${SANS};font-size:12px;line-height:1.5;color:${C.muted};">${escapeHtml(
                s.expiryNote,
              )} ${escapeHtml(s.ignoreNote)}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>`;
}

function renderFooter(s: MagicLinkEmailStrings): string {
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

export function renderMagicLinkEmail(data: MagicLinkEmailData): MagicLinkEmailRendered {
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
        ${renderCta(data)}
        ${renderNotice(s)}
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
function renderText(data: MagicLinkEmailData): string {
  const s = data.strings;
  const lines: string[] = [];
  lines.push(s.heading);
  lines.push("");
  lines.push(s.intro);
  lines.push("");
  lines.push(`${s.ctaLabel}: ${data.actionUrl}`);
  lines.push("");
  lines.push(`${s.expiryNote} ${s.ignoreNote}`);
  lines.push("");
  lines.push(s.footer);
  return lines.join("\n");
}
