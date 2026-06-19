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
// Shown count, ordered by match date (most recent match first).
const MAX_ITEMS = 5;
// Safety cap on the render fetch: the active-only RLS yields one render per
// match, so this stays well above any real tournament's match count.
const SAFETY_LIMIT = 200;

function recapImagePublicUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? env.supabaseUrl;
  return `${base}/storage/v1/object/public/${RECAP_BUCKET}/${path}`;
}

type GalleryItem = {
  matchId: string;
  home: string;
  away: string;
  url: string;
  kickoffAt: string;
  createdAt: string;
};

export async function RecentRecapImages({ locale }: { locale: Locale }) {
  const supabase = await createServerSupabaseClient();

  // All completed renders (active-only via RLS → one per match). Ordering is by
  // match date below, so this is a bounded fetch, not a pre-limited one.
  const { data: renders } = await supabase
    .from("match_summary_images")
    .select("storage_path, match_id, created_at")
    .eq("status", "complete")
    .limit(SAFETY_LIMIT);
  const rows = renders ?? [];
  if (rows.length === 0) return null;

  // Resolve team names + kickoff for ordering and the cards/links.
  const { data: matchRows } = await supabase
    .from("matches")
    .select("id, home_team, away_team, kickoff_at")
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
        kickoffAt: m.kickoff_at,
        createdAt: r.created_at,
      };
    })
    .filter((x): x is GalleryItem => x !== null);

  if (items.length === 0) return null;

  // Most recent match first; tie-break on render time, then match id, so the
  // order is stable. Then cap to the shown count.
  items.sort(
    (a, b) =>
      b.kickoffAt.localeCompare(a.kickoffAt) ||
      b.createdAt.localeCompare(a.createdAt) ||
      a.matchId.localeCompare(b.matchId),
  );
  const shown = items.slice(0, MAX_ITEMS);

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
        {shown.map((item) => (
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
