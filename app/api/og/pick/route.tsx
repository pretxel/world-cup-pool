import { ImageResponse } from "next/og";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { flagSlug } from "@/lib/team-flag";
import { clampGoals } from "@/lib/share";
import { isLocale, DEFAULT_LOCALE } from "@/lib/i18n";
import type { Database } from "@/lib/database.types";
import { getStageLabel, safeParseFormatConfig } from "@/lib/competition-schema";
import { loadOgFonts, OG_FONT_FAMILY } from "@/lib/og-fonts";

// Node runtime (no `runtime = "edge"`): lib/og-fonts.ts reads font binaries via
// node:fs/promises. The pick card is deterministic from its URL params, so its
// cache stays immutable — unlike the rank card it does not use ETag/SWR.
export const dynamic = "force-dynamic";

const WIDTH = 1200;
const HEIGHT = 630;
// Brand pitch green (oklch(0.43 0.13 158) ≈) and its foreground, hex for Satori.
const PITCH = "#15714b";
const PITCH_DARK = "#0e5238";
const FG = "#fbfaf6";


function initials(team: string): string {
  return team
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

async function flagDataUri(
  origin: string,
  team: string,
): Promise<string | null> {
  const slug = flagSlug(team);
  if (!slug) return null;
  try {
    const res = await fetch(`${origin}/flags/${slug}.svg`);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return `data:image/svg+xml;base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

function TeamBlock({
  name,
  flag,
}: {
  name: string;
  flag: string | null;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 24,
        width: 380,
      }}
    >
      {flag ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={flag}
          width={150}
          height={110}
          alt=""
          style={{ borderRadius: 12, objectFit: "cover" }}
        />
      ) : (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 150,
            height: 110,
            borderRadius: 12,
            backgroundColor: "rgba(251,250,246,0.12)",
            color: FG,
            fontFamily: OG_FONT_FAMILY.heading,
            fontSize: 44,
            fontWeight: 700,
          }}
        >
          {initials(name)}
        </div>
      )}
      <div
        style={{
          display: "flex",
          color: FG,
          fontFamily: OG_FONT_FAMILY.heading,
          fontSize: 44,
          fontWeight: 700,
          textAlign: "center",
          lineHeight: 1.15,
        }}
      >
        {name}
      </div>
    </div>
  );
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const matchId = url.searchParams.get("matchId");
  if (!matchId) return new Response("Missing matchId", { status: 400 });

  const rawLocale = url.searchParams.get("locale") ?? DEFAULT_LOCALE;
  const locale = isLocale(rawLocale) ? rawLocale : DEFAULT_LOCALE;
  const h = clampGoals(url.searchParams.get("h"));
  const a = clampGoals(url.searchParams.get("a"));
  const hasScores = h !== null && a !== null;

  // Cookie-less client: the matches table is public read and this route is
  // fetched by social scrapers with no session.
  const supabase = createClient<Database>(env.supabaseUrl, env.supabaseAnonKey);
  const { data: match } = await supabase
    .from("matches")
    .select("home_team, away_team, stage, group_code, kickoff_at, competition_id")
    .eq("id", matchId)
    .maybeSingle();
  if (!match) return new Response("Match not found", { status: 404 });

  // Stage label comes from the match's competition format_config; fall back to
  // the raw stage key if the competition or stage can't be resolved.
  const { data: comp } = await supabase
    .from("competitions")
    .select("format_config, branding")
    .eq("id", match.competition_id)
    .maybeSingle();
  const parsedFormat = comp ? safeParseFormatConfig(comp.format_config) : null;
  const brandCode =
    (comp?.branding as { brandCode?: string } | null)?.brandCode ?? "WC26";
  const stageName = parsedFormat?.success
    ? getStageLabel(parsedFormat.data, match.stage, locale)
    : match.stage;
  const stageLabel = `${stageName}${match.group_code ? ` · ${match.group_code}` : ""}`;
  const kickoff = new Date(match.kickoff_at).toLocaleDateString(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

  const [homeFlag, awayFlag] = await Promise.all([
    flagDataUri(url.origin, match.home_team),
    flagDataUri(url.origin, match.away_team),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundImage: `linear-gradient(135deg, ${PITCH} 0%, ${PITCH_DARK} 100%)`,
          padding: 56,
        }}
      >
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
              color: FG,
              fontFamily: OG_FONT_FAMILY.mono,
              fontSize: 28,
              fontWeight: 700,
              letterSpacing: 6,
              textTransform: "uppercase",
              opacity: 0.85,
            }}
          >
            {stageLabel}
          </div>
          <div
            style={{
              display: "flex",
              color: FG,
              fontFamily: OG_FONT_FAMILY.mono,
              fontSize: 28,
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
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <TeamBlock name={match.home_team} flag={homeFlag} />
          <div
            style={{
              display: "flex",
              color: FG,
              fontFamily: OG_FONT_FAMILY.heading,
              fontSize: hasScores ? 150 : 72,
              fontWeight: 800,
            }}
          >
            {hasScores ? `${h}–${a}` : "vs"}
          </div>
          <TeamBlock name={match.away_team} flag={awayFlag} />
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "center",
            color: FG,
            fontFamily: OG_FONT_FAMILY.mono,
            fontSize: 26,
            fontWeight: 700,
            letterSpacing: 4,
            textTransform: "uppercase",
            opacity: 0.7,
          }}
        >
          {kickoff}
        </div>
      </div>
    ),
    {
      width: WIDTH,
      height: HEIGHT,
      fonts: await loadOgFonts(),
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    },
  );
}
