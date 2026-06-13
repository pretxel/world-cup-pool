import "server-only";
import { cache } from "react";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { CompetitionRow } from "@/lib/db";
import type { Locale } from "@/lib/i18n";
import {
  getStageLabel,
  parseFormatConfig,
  providersSchema,
  brandingSchema,
  type CompetitionBranding,
  type CompetitionFormat,
  type CompetitionProviders,
} from "@/lib/competition-schema";

// A competition row with its JSONB columns parsed into typed objects.
export type ResolvedCompetition = CompetitionRow & {
  format: CompetitionFormat;
  providersConfig: CompetitionProviders;
  brandingConfig: CompetitionBranding;
};

export function resolveCompetition(row: CompetitionRow): ResolvedCompetition {
  return {
    ...row,
    format: parseFormatConfig(row.format_config),
    providersConfig: providersSchema.parse(row.providers ?? {}),
    brandingConfig: brandingSchema.parse(row.branding ?? {}),
  };
}

// The active (public) competition, resolved once per request. Returns null when
// no competition is active (helpers must treat that as "no competition
// selected" rather than throwing). Switching the active competition revalidates
// the affected paths/tags, so a fresh request picks up the change.
export const getActiveCompetition = cache(
  async (): Promise<ResolvedCompetition | null> => {
    const supabase = await createServerSupabaseClient();
    const { data } = await supabase
      .from("competitions")
      .select("*")
      .eq("is_active", true)
      .maybeSingle();
    return data ? resolveCompetition(data) : null;
  },
);

// Localized label for a stage in the active competition, falling back to the
// raw stage key when there is no active competition or the stage is unknown.
export async function getActiveStageLabel(
  stage: string,
  locale: Locale,
): Promise<string> {
  const comp = await getActiveCompetition();
  return comp ? getStageLabel(comp.format, stage, locale) : stage;
}

// World Cup 2026 fallbacks keep behavior identical when no competition is
// resolved (cold DB) or a branding field is unset.
const FALLBACK_SHORT_NAME = "World Cup 2026";
const FALLBACK_BRAND_CODE = "WC26";
const FALLBACK_EMAIL_FROM_NAME = "World Cup Pools";
const FALLBACK_NEWS_QUERY = '"World Cup 2026" OR "FIFA World Cup 2026"';

export type ResolvedBranding = {
  shortName: string;
  siteName: string;
  brandCode: string;
  ogAlt: string;
  emailFromName: string;
  newsQuery: string;
};

// Brand strings resolved from the active competition (short_name + branding
// JSONB), with World Cup defaults. Shared by the layouts, nav, OG cards, and
// email sender so a competition switch reskins the whole product.
export async function getActiveBranding(): Promise<ResolvedBranding> {
  const comp = await getActiveCompetition();
  const b = comp?.brandingConfig;
  const shortName = comp?.short_name ?? FALLBACK_SHORT_NAME;
  return {
    shortName,
    siteName: `${shortName} Pool`,
    brandCode: b?.brandCode ?? FALLBACK_BRAND_CODE,
    ogAlt: b?.ogAlt ?? `${shortName} Pool`,
    emailFromName: b?.emailFromName ?? FALLBACK_EMAIL_FROM_NAME,
    newsQuery: b?.newsQuery ?? FALLBACK_NEWS_QUERY,
  };
}
