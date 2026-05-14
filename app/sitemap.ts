import type { MetadataRoute } from "next";
import { env } from "@/lib/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = env.siteUrl.replace(/\/$/, "");
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = [
    {
      url: `${base}/`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${base}/matches`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${base}/leaderboard`,
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${base}/how-it-works`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.5,
    },
    {
      url: `${base}/sign-in`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.3,
    },
  ];

  let matchEntries: MetadataRoute.Sitemap = [];
  try {
    const supabase = await createServerSupabaseClient();
    const { data: matches } = await supabase
      .from("matches")
      .select("id, updated_at")
      .order("kickoff_at", { ascending: true });

    matchEntries = (matches ?? []).map((m) => ({
      url: `${base}/matches/${m.id}`,
      lastModified: m.updated_at ? new Date(m.updated_at) : now,
      changeFrequency: "daily" as const,
      priority: 0.7,
    }));
  } catch {
    // Sitemap should still build even if Supabase is unreachable.
    matchEntries = [];
  }

  return [...staticEntries, ...matchEntries];
}
