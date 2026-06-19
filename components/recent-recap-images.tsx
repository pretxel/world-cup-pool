import "server-only";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { localePath, type Locale } from "@/lib/i18n";

// Landing-page gallery of the most recently generated match recap comics. Reads
// the active, completed renders (the active-only RLS scopes visibility, so this
// is naturally one image per match and only published comics). Renders nothing
// when there are none.

const RECAP_BUCKET = "match-recap-images";
const MAX_ITEMS = 5;

function recapImagePublicUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? env.supabaseUrl;
  return `${base}/storage/v1/object/public/${RECAP_BUCKET}/${path}`;
}

type GalleryItem = { matchId: string; home: string; away: string; url: string };

export async function RecentRecapImages({ locale }: { locale: Locale }) {
  const supabase = await createServerSupabaseClient();

  // Newest completed renders first (active-only via RLS).
  const { data: renders } = await supabase
    .from("match_summary_images")
    .select("storage_path, match_id, created_at")
    .eq("status", "complete")
    .order("created_at", { ascending: false })
    .limit(MAX_ITEMS);
  const rows = renders ?? [];
  if (rows.length === 0) return null;

  // Resolve team names for the cards/links (anon-readable matches).
  const { data: matchRows } = await supabase
    .from("matches")
    .select("id, home_team, away_team")
    .in(
      "id",
      rows.map((r) => r.match_id),
    );
  const matchById = new Map((matchRows ?? []).map((m) => [m.id, m]));

  const items: GalleryItem[] = rows
    .map((r): GalleryItem | null => {
      const m = matchById.get(r.match_id);
      if (!r.storage_path || !m) return null;
      return {
        matchId: r.match_id,
        home: m.home_team,
        away: m.away_team,
        url: recapImagePublicUrl(r.storage_path),
      };
    })
    .filter((x): x is GalleryItem => x !== null);

  if (items.length === 0) return null;

  const t = await getTranslations("home");

  return (
    <section className="relative mx-auto max-w-6xl px-4 py-16 sm:py-20">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
          {t("recapGalleryEyebrow")}
        </p>
        <h2
          className="mt-2 font-heading text-3xl font-semibold tracking-tight sm:text-4xl"
          style={{ fontStretch: "condensed" }}
        >
          {t("recapGalleryHeadline")}
        </h2>
      </div>

      <ul className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {items.map((item) => (
          <li key={item.matchId}>
            <Link
              href={localePath(locale, `/matches/${item.matchId}`)}
              className="group block overflow-hidden rounded-xl bg-card ring-1 ring-border transition-shadow hover:shadow-lg"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.url}
                alt={t("recapImageAlt", { home: item.home, away: item.away })}
                className="aspect-[2/3] w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
              />
              <div className="px-3 py-2 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                {item.home} <span className="text-muted-foreground/50">vs</span> {item.away}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
