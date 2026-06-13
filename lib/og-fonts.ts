import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

// Brand typefaces embedded into the OG cards (app/api/og/*). The site itself
// loads these via next/font/google; here we read subsetted .ttf binaries from
// assets/og/ at request time. ImageResponse accepts only ttf/otf/woff, and ttf
// parses fastest. Requires the Node runtime — see assets/og/README.md.

export type OgFont = {
  name: string;
  data: ArrayBuffer;
  weight: 400 | 500 | 600 | 700 | 800;
  style: "normal" | "italic";
};

type FontSpec = {
  file: string;
  name: string;
  weight: OgFont["weight"];
};

// The exact subset weights produced in assets/og/. Bricolage Grotesque is the
// heading face (rank number 800, display name 700); JetBrains Mono is the label
// + stat face (700).
const HEADING_FAMILY = "Bricolage Grotesque";
const MONO_FAMILY = "JetBrains Mono";

const FONT_SPECS: FontSpec[] = [
  {
    file: "BricolageGrotesque-Condensed-700.ttf",
    name: HEADING_FAMILY,
    weight: 700,
  },
  {
    file: "BricolageGrotesque-Condensed-800.ttf",
    name: HEADING_FAMILY,
    weight: 800,
  },
  { file: "JetBrainsMono-700.ttf", name: MONO_FAMILY, weight: 700 },
];

export const OG_FONT_FAMILY = {
  heading: HEADING_FAMILY,
  mono: MONO_FAMILY,
} as const;

// Module-scoped memoization: a warm Fluid instance parses each font once and
// reuses the buffers across invocations. The promise (not the value) is cached
// so concurrent first requests share a single read.
let cache: Promise<OgFont[]> | null = null;

async function loadFontFile(spec: FontSpec): Promise<OgFont> {
  const buf = await readFile(join(process.cwd(), "assets", "og", spec.file));
  // Copy into a standalone ArrayBuffer (Node Buffers are views over a shared
  // pool; ImageResponse wants the bytes for exactly this font).
  const data = buf.buffer.slice(
    buf.byteOffset,
    buf.byteOffset + buf.byteLength,
  ) as ArrayBuffer;
  return { name: spec.name, data, weight: spec.weight, style: "normal" };
}

/**
 * Returns the embedded brand fonts for ImageResponse's `fonts` option.
 * Memoized per process; safe to call on every request.
 */
export function loadOgFonts(): Promise<OgFont[]> {
  if (!cache) {
    cache = Promise.all(FONT_SPECS.map(loadFontFile)).catch((err) => {
      // Reset so a transient read failure doesn't poison every later request;
      // the card still renders via Satori's fallback font when fonts are absent.
      cache = null;
      throw err;
    });
  }
  return cache;
}

// Codepoints covered by the embedded heading subset (see assets/og/README.md):
// Basic Latin + Latin-1 Supplement + Latin Extended-A + a few punctuation marks.
// Anything outside this needs a fallback face or it renders as an empty box.
const EMBEDDED_PUNCTUATION = new Set([
  0x2013, 0x2014, 0x2018, 0x2019, 0x201c, 0x201d, 0x2026,
]);
function isEmbeddedGlyph(cp: number): boolean {
  return (cp >= 0x20 && cp <= 0x17f) || EMBEDDED_PUNCTUATION.has(cp);
}

// Map a name's dominant non-Latin script to the Noto family that covers it, so
// the fallback fetch pulls the right glyphs. One family per request is enough —
// mixed-script display names are vanishingly rare here.
function fallbackFamilyFor(text: string): string {
  if (/[぀-ヿ]/.test(text)) return "Noto Sans JP"; // kana
  if (/[가-힯]/.test(text)) return "Noto Sans KR"; // hangul
  if (/[一-鿿]/.test(text)) return "Noto Sans SC"; // han
  if (/[؀-ۿ]/.test(text)) return "Noto Sans Arabic";
  if (/[֐-׿]/.test(text)) return "Noto Sans Hebrew";
  if (/[ऀ-ॿ]/.test(text)) return "Noto Sans Devanagari";
  return "Noto Sans"; // Latin (extra), Cyrillic, Greek
}

// An old UA makes the Google Fonts CSS API serve a woff/ttf face (Satori can't
// parse woff2). The CSS embeds the font URL for exactly the requested `text`
// glyphs. Match the first non-woff2 face (woff / truetype / opentype).
const LEGACY_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_6_8) AppleWebKit/534.30 (KHTML, like Gecko) Version/5.1 Safari/534.30";
const FACE_URL_RE =
  /src:\s*url\((https:\/\/[^)]+)\)\s*format\('(?:woff|truetype|opentype)'\)/;

/**
 * Glyph-subset fallback for a display name that contains characters outside the
 * embedded subset (e.g. Cyrillic, Greek, CJK). Returns a single broad-coverage
 * face fetched for just that name's glyphs, or [] when the name is fully covered
 * (the common Latin case — no network call) or the fetch fails (degrade quietly).
 */
export async function loadDisplayNameFallback(
  name: string,
): Promise<OgFont[]> {
  const needsFallback = [...name].some(
    (ch) => !isEmbeddedGlyph(ch.codePointAt(0) ?? 0),
  );
  if (!needsFallback) return [];

  try {
    const family = fallbackFamilyFor(name);
    const cssUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(
      family,
    )}&text=${encodeURIComponent(name)}`;
    const css = await fetch(cssUrl, {
      headers: { "User-Agent": LEGACY_UA },
    }).then((r) => (r.ok ? r.text() : ""));
    const url = css.match(FACE_URL_RE)?.[1];
    if (!url) return [];
    const data = await fetch(url).then((r) => r.arrayBuffer());
    // Weight 400 and a low priority: Satori only reaches for it on glyphs the
    // brand faces lack, so brand text stays in the brand face.
    return [{ name: family, data, weight: 400, style: "normal" }];
  } catch {
    return [];
  }
}
