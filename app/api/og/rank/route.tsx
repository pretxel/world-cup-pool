import { ImageResponse } from "next/og";
import { createClient } from "@supabase/supabase-js";
import { getTranslations } from "next-intl/server";
import { env } from "@/lib/env";
import { isLocale, DEFAULT_LOCALE } from "@/lib/i18n";
import type { Database } from "@/lib/database.types";

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
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
      }}
    >
      <div style={{ display: "flex", color: FG, fontSize: 96, fontWeight: 800 }}>
        {value}
      </div>
      <div
        style={{
          display: "flex",
          color: FG,
          fontSize: 24,
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
  const [{ data: row }, { count }] = await Promise.all([
    supabase
      .from("v_leaderboard_overall")
      .select("rank, display_name, total_points, exact_hits")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("v_leaderboard_overall")
      .select("*", { count: "exact", head: true }),
  ]);
  if (!row) return new Response("Standing not found", { status: 404 });

  const t = await getTranslations({ locale, namespace: "shareRank" });
  const tBoard = await getTranslations({ locale, namespace: "leaderboard" });
  const name = row.display_name ?? tBoard("noName");
  const rank = row.rank ?? 0;
  const points = row.total_points ?? 0;
  const exact = row.exact_hits ?? 0;
  const players = count ?? 0;

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
              fontSize: 28,
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
              color: FG,
              fontSize: 28,
              fontWeight: 700,
              letterSpacing: 6,
              textTransform: "uppercase",
              opacity: 0.85,
            }}
          >
            WC26 POOL
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flex: 1,
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          <div
            style={{
              display: "flex",
              color: FG,
              fontSize: 200,
              fontWeight: 800,
              lineHeight: 1,
            }}
          >
            {`#${rank}`}
          </div>
          <div
            style={{
              display: "flex",
              color: FG,
              fontSize: 56,
              fontWeight: 700,
              maxWidth: 1000,
              textAlign: "center",
            }}
          >
            {name}
          </div>
          <div
            style={{
              display: "flex",
              color: FG,
              fontSize: 26,
              letterSpacing: 4,
              textTransform: "uppercase",
              opacity: 0.7,
            }}
          >
            {t("statPlayers", { count: players })}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 96,
          }}
        >
          <Stat value={String(points)} label={t("pointsLabel")} />
          <Stat value={String(exact)} label={t("exactLabel")} />
        </div>
      </div>
    ),
    {
      width: WIDTH,
      height: HEIGHT,
      headers: {
        // Finite, not immutable: the ranking changes as results land, so the
        // card must refresh. Five minutes bounds scraper load.
        "Cache-Control": "public, max-age=300, s-maxage=300",
      },
    },
  );
}
