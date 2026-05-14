import type { MetadataRoute } from "next";
import { env } from "@/lib/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { SUPPORTED_LOCALES, type Locale } from "@/lib/i18n";

type StaticRoute = {
  path: string;
  changeFrequency: NonNullable<MetadataRoute.Sitemap[number]["changeFrequency"]>;
  priority: number;
};

const STATIC_ROUTES: StaticRoute[] = [
  { path: "/", changeFrequency: "daily", priority: 1 },
  { path: "/matches", changeFrequency: "daily", priority: 0.9 },
  { path: "/leaderboard", changeFrequency: "daily", priority: 0.9 },
  { path: "/how-it-works", changeFrequency: "weekly", priority: 0.5 },
  { path: "/sign-in", changeFrequency: "weekly", priority: 0.3 },
];

function urlFor(base: string, locale: Locale, path: string): string {
  const trimmed = path === "/" ? "" : path;
  return `${base}/${locale}${trimmed}`;
}

function languageAlternates(
  base: string,
  path: string,
): Record<string, string> {
  return Object.fromEntries(
    SUPPORTED_LOCALES.map((loc) => [loc, urlFor(base, loc, path)]),
  );
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = env.siteUrl.replace(/\/$/, "");
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = STATIC_ROUTES.flatMap((route) =>
    SUPPORTED_LOCALES.map((locale) => ({
      url: urlFor(base, locale, route.path),
      lastModified: now,
      changeFrequency: route.changeFrequency,
      priority: route.priority,
      alternates: { languages: languageAlternates(base, route.path) },
    })),
  );

  let matchEntries: MetadataRoute.Sitemap = [];
  try {
    const supabase = await createServerSupabaseClient();
    const { data: matches } = await supabase
      .from("matches")
      .select("id, updated_at")
      .order("kickoff_at", { ascending: true });

    matchEntries = (matches ?? []).flatMap((m) =>
      SUPPORTED_LOCALES.map((locale) => ({
        url: urlFor(base, locale, `/matches/${m.id}`),
        lastModified: m.updated_at ? new Date(m.updated_at) : now,
        changeFrequency: "daily" as const,
        priority: 0.7,
        alternates: {
          languages: languageAlternates(base, `/matches/${m.id}`),
        },
      })),
    );
  } catch {
    matchEntries = [];
  }

  return [...staticEntries, ...matchEntries];
}
