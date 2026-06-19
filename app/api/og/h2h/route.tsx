import { ImageResponse } from "next/og";
import { createClient } from "@supabase/supabase-js";
import { getTranslations } from "next-intl/server";
import { env } from "@/lib/env";
import { isLocale, DEFAULT_LOCALE } from "@/lib/i18n";
import type { Database } from "@/lib/database.types";
import { loadH2HStandings, loadRecentForm, type FormPip } from "@/lib/h2h";
import { loadOgFonts, loadDisplayNameFallback, OG_FONT_FAMILY } from "@/lib/og-fonts";
import { cardETag, ifNoneMatchSatisfied, notModified, OG_CACHE_CONTROL } from "@/lib/og-cache";

// Node runtime (no `runtime = "edge"`): lib/og-fonts.ts reads font binaries via
// node:fs/promises, and the @vercel/og Edge bundle cap does not apply.
export const dynamic = "force-dynamic";

// Namespaces this card's ETag independently of the rank card's CARD_VERSION;
// bump when the head-to-head layout/composition changes.
const CARD_TOKEN = "h2h-1";

const WIDTH = 1200;
const HEIGHT = 630;
// Brand pitch green (oklch(0.43 0.13 158) ≈) and its foreground, hex for Satori.
const PITCH = "#15714b";
const PITCH_DARK = "#0e5238";
const FG = "#fbfaf6";

function formToken(pips: FormPip[]): string {
  return pips.map((p) => (p.outcome === "hit" ? "h" : "m")).join("");
}

function FormPips({ pips }: { pips: FormPip[] }) {
  return (
    <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
      {pips.map((p, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            width: 18,
            height: 18,
            borderRadius: 9,
            backgroundColor: p.outcome === "hit" ? FG : "rgba(251,250,246,0.22)",
          }}
        />
      ))}
    </div>
  );
}

function Column({
  name,
  rank,
  points,
  exact,
  pips,
  pointsLabel,
  exactLabel,
}: {
  name: string;
  rank: number;
  points: number;
  exact: number;
  pips: FormPip[];
  pointsLabel: string;
  exactLabel: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        flex: 1,
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        padding: "0 24px",
      }}
    >
      <div
        style={{
          display: "flex",
          fontFamily: OG_FONT_FAMILY.heading,
          color: FG,
          fontSize: 150,
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
          fontSize: 46,
          fontWeight: 700,
          maxWidth: 440,
          textAlign: "center",
          lineHeight: 1.05,
        }}
      >
        {name}
      </div>
      <div style={{ display: "flex", gap: 28, marginTop: 14 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          <div
            style={{
              display: "flex",
              fontFamily: OG_FONT_FAMILY.mono,
              color: FG,
              fontSize: 52,
              fontWeight: 700,
              lineHeight: 1,
            }}
          >
            {String(points)}
          </div>
          <div
            style={{
              display: "flex",
              fontFamily: OG_FONT_FAMILY.mono,
              color: FG,
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: 3,
              textTransform: "uppercase",
              opacity: 0.7,
            }}
          >
            {pointsLabel}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          <div
            style={{
              display: "flex",
              fontFamily: OG_FONT_FAMILY.mono,
              color: FG,
              fontSize: 52,
              fontWeight: 700,
              lineHeight: 1,
            }}
          >
            {String(exact)}
          </div>
          <div
            style={{
              display: "flex",
              fontFamily: OG_FONT_FAMILY.mono,
              color: FG,
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: 3,
              textTransform: "uppercase",
              opacity: 0.7,
            }}
          >
            {exactLabel}
          </div>
        </div>
      </div>
      <FormPips pips={pips} />
    </div>
  );
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const idA = url.searchParams.get("a");
  const idB = url.searchParams.get("b");
  if (!idA || !idB) return new Response("Missing a/b", { status: 400 });

  const rawLocale = url.searchParams.get("locale") ?? DEFAULT_LOCALE;
  const locale = isLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE;

  // Cookie-less client: the leaderboard view is public read and this route is
  // fetched by social scrapers with no session. Numbers are read live so the
  // card always reflects the current standings, never the URL.
  const supabase = createClient<Database>(env.supabaseUrl, env.supabaseAnonKey);

  // Validate inputs before any render or ETag work — an unknown user is a 404,
  // never a half-rendered card.
  const standings = await loadH2HStandings(supabase, idA, idB);
  if (!standings) return new Response("Standing not found", { status: 404 });

  const [formA, formB] = await Promise.all([
    loadRecentForm(supabase, idA),
    loadRecentForm(supabase, idB),
  ]);

  const t = await getTranslations({ locale, namespace: "h2h" });
  const tBoard = await getTranslations({ locale, namespace: "leaderboard" });
  const nameA = standings.a.displayName ?? tBoard("noName");
  const nameB = standings.b.displayName ?? tBoard("noName");

  // Conditional cache: the ETag covers every value both columns draw (plus the
  // card token + locale), so an unchanged pair answers 304 without a re-raster.
  const etag = cardETag([
    CARD_TOKEN,
    standings.a.rank,
    nameA,
    standings.a.totalPoints,
    standings.a.exactHits,
    formToken(formA),
    standings.b.rank,
    nameB,
    standings.b.totalPoints,
    standings.b.exactHits,
    formToken(formB),
    locale,
  ]);
  if (ifNoneMatchSatisfied(request, etag)) return notModified(etag);

  // Brand faces, plus a glyph-subset fallback only when a name needs it.
  const [brandFonts, fallbackA, fallbackB] = await Promise.all([
    loadOgFonts(),
    loadDisplayNameFallback(nameA),
    loadDisplayNameFallback(nameB),
  ]);

  const pointsLabel = t("pointsLabel");
  const exactLabel = t("exactLabel");

  return new ImageResponse(
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundImage: `linear-gradient(135deg, ${PITCH} 0%, ${PITCH_DARK} 100%)`,
        padding: 48,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          backgroundImage:
            "radial-gradient(circle at 50% 42%, rgba(251,250,246,0.16) 0%, rgba(251,250,246,0) 55%)",
        }}
      />
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
          justifyContent: "center",
          fontFamily: OG_FONT_FAMILY.mono,
          color: FG,
          fontSize: 24,
          fontWeight: 700,
          letterSpacing: 6,
          textTransform: "uppercase",
          opacity: 0.85,
        }}
      >
        {t("pageEyebrow")}
      </div>

      <div style={{ display: "flex", flex: 1, alignItems: "stretch" }}>
        <Column
          name={nameA}
          rank={standings.a.rank}
          points={standings.a.totalPoints}
          exact={standings.a.exactHits}
          pips={formA}
          pointsLabel={pointsLabel}
          exactLabel={exactLabel}
        />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              width: 1,
              flex: 1,
              backgroundColor: "rgba(251,250,246,0.18)",
            }}
          />
          <div
            style={{
              display: "flex",
              fontFamily: OG_FONT_FAMILY.heading,
              color: FG,
              fontSize: 64,
              fontWeight: 800,
              padding: "12px 0",
              textTransform: "uppercase",
            }}
          >
            {t("vsLabel")}
          </div>
          <div
            style={{
              display: "flex",
              width: 1,
              flex: 1,
              backgroundColor: "rgba(251,250,246,0.18)",
            }}
          />
        </div>
        <Column
          name={nameB}
          rank={standings.b.rank}
          points={standings.b.totalPoints}
          exact={standings.b.exactHits}
          pips={formB}
          pointsLabel={pointsLabel}
          exactLabel={exactLabel}
        />
      </div>
    </div>,
    {
      width: WIDTH,
      height: HEIGHT,
      fonts: [...brandFonts, ...fallbackA, ...fallbackB],
      headers: {
        "Cache-Control": OG_CACHE_CONTROL,
        ETag: etag,
      },
    },
  );
}
