import { ImageResponse } from "next/og";
import { createClient } from "@supabase/supabase-js";
import { getTranslations } from "next-intl/server";
import { env } from "@/lib/env";
import { isLocale, DEFAULT_LOCALE } from "@/lib/i18n";
import type { Database } from "@/lib/database.types";
import {
  loadOgFonts,
  loadDisplayNameFallback,
  OG_FONT_FAMILY,
} from "@/lib/og-fonts";
import {
  cardETag,
  ifNoneMatchSatisfied,
  notModified,
  OG_CACHE_CONTROL,
} from "@/lib/og-cache";

// Node runtime (no `runtime = "edge"`): lib/og-fonts.ts reads font binaries via
// node:fs/promises, and the @vercel/og Edge bundle cap does not apply.
export const dynamic = "force-dynamic";

const WIDTH = 1200;
const HEIGHT = 630;
// Brand pitch green (oklch(0.43 0.13 158) ≈) and its foreground, hex for Satori.
const PITCH = "#15714b";
const PITCH_DARK = "#0e5238";
const FG = "#fbfaf6";

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div
      style={{
        display: "flex",
        flex: 1,
        flexDirection: "column",
        alignItems: "center",
        gap: 10,
        padding: "10px 0",
      }}
    >
      <div
        style={{
          display: "flex",
          fontFamily: OG_FONT_FAMILY.mono,
          color: FG,
          fontSize: 92,
          fontWeight: 700,
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      <div
        style={{
          display: "flex",
          fontFamily: OG_FONT_FAMILY.mono,
          color: FG,
          fontSize: 22,
          fontWeight: 700,
          letterSpacing: 4,
          textTransform: "uppercase",
          opacity: 0.7,
        }}
      >
        {label}
      </div>
    </div>
  );
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const userId = url.searchParams.get("userId");
  if (!userId) return new Response("Missing userId", { status: 400 });

  const rawLocale = url.searchParams.get("locale") ?? DEFAULT_LOCALE;
  const locale = isLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE;

  // Cookie-less client: the leaderboard view is public read and this route is
  // fetched by social scrapers with no session. Numbers are read live so the
  // card always reflects the current standing, never the URL.
  const supabase = createClient<Database>(env.supabaseUrl, env.supabaseAnonKey);
  const [{ data: row }, { count }, { data: comp }] = await Promise.all([
    supabase
      .from("v_leaderboard_overall")
      .select("rank, display_name, total_points, exact_hits")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("v_leaderboard_overall")
      .select("*", { count: "exact", head: true }),
    supabase
      .from("competitions")
      .select("branding")
      .eq("is_active", true)
      .maybeSingle(),
  ]);
  const brandCode =
    (comp?.branding as { brandCode?: string } | null)?.brandCode ?? "WC26";
  // Validate inputs before any render or ETag work — an unknown user is a 404,
  // never a half-rendered card.
  if (!row) return new Response("Standing not found", { status: 404 });

  const t = await getTranslations({ locale, namespace: "shareRank" });
  const tBoard = await getTranslations({ locale, namespace: "leaderboard" });
  const name = row.display_name ?? tBoard("noName");
  const rank = row.rank ?? 0;
  const points = row.total_points ?? 0;
  const exact = row.exact_hits ?? 0;
  const players = count ?? 0;

  // Conditional cache: the ETag covers every value the card draws, so an
  // unchanged standing answers 304 without paying for a fresh raster.
  const etag = cardETag([rank, name, points, exact, players, locale]);
  if (ifNoneMatchSatisfied(request, etag)) return notModified(etag);

  // Brand faces, plus a glyph-subset fallback only when the name needs it.
  const [brandFonts, nameFallback] = await Promise.all([
    loadOgFonts(),
    loadDisplayNameFallback(name),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundImage: `linear-gradient(135deg, ${PITCH} 0%, ${PITCH_DARK} 100%)`,
          padding: 56,
        }}
      >
        {/* Soft spotlight behind the rank — Satori-supported radial gradient,
            a texture cue toward the scoreboard look without CSS patterns. */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            backgroundImage:
              "radial-gradient(circle at 50% 42%, rgba(251,250,246,0.16) 0%, rgba(251,250,246,0) 55%)",
          }}
        />
        {/* Top hairline accent */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 6,
            display: "flex",
            backgroundColor: FG,
            opacity: 0.5,
          }}
        />

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div
            style={{
              display: "flex",
              fontFamily: OG_FONT_FAMILY.mono,
              color: FG,
              fontSize: 26,
              fontWeight: 700,
              letterSpacing: 6,
              textTransform: "uppercase",
              opacity: 0.85,
            }}
          >
            {t("pageEyebrow")}
          </div>
          <div
            style={{
              display: "flex",
              fontFamily: OG_FONT_FAMILY.mono,
              color: FG,
              fontSize: 26,
              fontWeight: 700,
              letterSpacing: 6,
              textTransform: "uppercase",
              opacity: 0.85,
            }}
          >
            {brandCode} POOL
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flex: 1,
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}
        >
          <div
            style={{
              display: "flex",
              fontFamily: OG_FONT_FAMILY.heading,
              color: FG,
              fontSize: 210,
              fontWeight: 800,
              lineHeight: 1,
            }}
          >
            {`#${rank}`}
          </div>
          <div
            style={{
              display: "flex",
              fontFamily: OG_FONT_FAMILY.heading,
              color: FG,
              fontSize: 60,
              fontWeight: 700,
              maxWidth: 1040,
              textAlign: "center",
              lineHeight: 1.05,
            }}
          >
            {name}
          </div>
          <div
            style={{
              display: "flex",
              fontFamily: OG_FONT_FAMILY.mono,
              color: FG,
              fontSize: 24,
              fontWeight: 700,
              letterSpacing: 4,
              textTransform: "uppercase",
              opacity: 0.7,
              marginTop: 6,
            }}
          >
            {t("statPlayers", { count: players })}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "stretch",
            borderTop: `1px solid rgba(251,250,246,0.18)`,
            paddingTop: 20,
          }}
        >
          <Stat value={String(points)} label={t("pointsLabel")} />
          <div
            style={{
              display: "flex",
              width: 1,
              backgroundColor: "rgba(251,250,246,0.18)",
            }}
          />
          <Stat value={String(exact)} label={t("exactLabel")} />
        </div>
      </div>
    ),
    {
      width: WIDTH,
      height: HEIGHT,
      fonts: [...brandFonts, ...nameFallback],
      headers: {
        "Cache-Control": OG_CACHE_CONTROL,
        ETag: etag,
      },
    },
  );
}
