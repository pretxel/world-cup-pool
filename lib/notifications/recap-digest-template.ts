// Pure, dependency-free renderer for the post-matchday recap-digest email.
// Mirrors result-email-template.ts / results-digest-template.ts: the web app's
// visual language (pitch-green header, cream body, gold/ink accents, mono
// uppercase labels) using email-safe HTML — table layout, inline styles, fixed
// hex colors (no oklch, CSS variables, or stylesheets).
//
// No database or network access — callers assemble `RecapDigestData` and pass
// already-localized copy in `strings`, keeping this fully unit-testable. Each
// new recap comic renders as a block: a thumbnail <img> from the public bucket
// URL with team-naming alt text, the teams, a link to the match detail page,
// and a recap share link. The email remains useful with images blocked: the
// text part and the per-comic match link carry the actionable content.

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

// One newly-rendered recap comic to surface in the digest.
export interface RecapDigestComic {
  home: string;
  away: string;
  // Public Supabase URL of the rendered comic (match-recap-images bucket).
  comicUrl: string;
  // Link to the match detail page (env.siteUrl + localePath).
  matchUrl: string;
  // Recap share link (tweet-intent at the match detail destination).
  shareUrl: string;
}

// All copy is resolved by the caller (next-intl) and passed in — value-bearing
// strings (subject, heading) arrive already interpolated.
export interface RecapDigestStrings {
  subject: string;
  preheader: string;
  eyebrow: string;
  // Personalized heading (already interpolated with the display name).
  heading: string;
  // Used when the recipient has no display name.
  headingNoName: string;
  intro: string;
  // The "vs" word between the two team names, e.g. "FRA vs ARG".
  vsLabel: string;
  matchCtaLabel: string;
  shareCtaLabel: string;
  footer: string;
}

export interface RecapDigestData {
  displayName: string | null;
  comics: RecapDigestComic[];
  strings: RecapDigestStrings;
}

export interface RecapDigestRendered {
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

function renderIntro(s: RecapDigestStrings, heading: string): string {
  return `
    <tr>
      <td style="padding:28px 28px 8px 28px;">
        ${monoLabel(s.eyebrow, C.muted)}
        <h1 style="margin:6px 0 0 0;font-family:${SANS};font-size:24px;line-height:1.2;font-weight:700;color:${C.ink};">${escapeHtml(
          heading,
        )}</h1>
        <p style="margin:8px 0 0 0;font-family:${SANS};font-size:14px;line-height:1.5;color:${C.muted};">${escapeHtml(
          s.intro,
        )}</p>
      </td>
    </tr>`;
}

function renderComic(comic: RecapDigestComic, s: RecapDigestStrings): string {
  const matchTitle = `${comic.home} ${s.vsLabel} ${comic.away}`;
  const alt = matchTitle;
  return `
    <tr>
      <td style="padding:14px 28px 4px 28px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${C.border};border-radius:12px;background-color:${C.card};overflow:hidden;">
          <tr>
            <td style="padding:0;">
              <a href="${escapeHtml(comic.matchUrl)}" style="display:block;text-decoration:none;">
                <img src="${escapeHtml(
                  comic.comicUrl,
                )}" alt="${escapeHtml(alt)}" width="544" style="display:block;width:100%;max-width:544px;height:auto;border:0;" />
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding:12px 16px 14px 16px;">
              <p style="margin:0;font-family:${MONO};font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:${C.ink};">${escapeHtml(
                matchTitle,
              )}</p>
              <p style="margin:10px 0 0 0;">
                <a href="${escapeHtml(
                  comic.matchUrl,
                )}" style="display:inline-block;margin-right:10px;padding:8px 16px;border-radius:8px;background-color:${C.pitch};font-family:${SANS};font-size:13px;font-weight:700;color:${C.pitchFg};text-decoration:none;">${escapeHtml(
                  s.matchCtaLabel,
                )}</a>
                <a href="${escapeHtml(
                  comic.shareUrl,
                )}" style="display:inline-block;padding:8px 16px;border-radius:8px;background-color:${C.flag};font-family:${SANS};font-size:13px;font-weight:700;color:${C.flagFg};text-decoration:none;">${escapeHtml(
                  s.shareCtaLabel,
                )}</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>`;
}

function renderFooter(s: RecapDigestStrings): string {
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

export function renderRecapDigest(data: RecapDigestData): RecapDigestRendered {
  const s = data.strings;
  const heading = data.displayName ? s.heading : s.headingNoName;
  const comics = data.comics.map((c) => renderComic(c, s)).join("");

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
        ${renderIntro(s, heading)}
        ${comics}
        <tr><td style="height:8px;"></td></tr>
        ${renderFooter(s)}
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;

  const text = renderText(data, heading);

  return { subject: s.subject, html, text };
}

// Plain-text part mirroring the HTML content for non-HTML clients. Lists each
// match + its match link + share link so the digest stays actionable when
// remote images are blocked.
function renderText(data: RecapDigestData, heading: string): string {
  const s = data.strings;
  const lines: string[] = [];
  lines.push(heading);
  lines.push("");
  lines.push(s.intro);
  lines.push("");
  for (const c of data.comics) {
    lines.push(`${c.home} ${s.vsLabel} ${c.away}`);
    lines.push(`  ${s.matchCtaLabel}: ${c.matchUrl}`);
    lines.push(`  ${s.shareCtaLabel}: ${c.shareUrl}`);
    lines.push("");
  }
  lines.push(s.footer);
  return lines.join("\n");
}
