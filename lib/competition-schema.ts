// Shared validation for a competition's format_config / providers / branding.
// This is the SINGLE source of truth used by the admin form, the server
// actions, and the unit tests, and it intentionally mirrors the Postgres
// `validate_format_config` trigger (see 20260614000000_competitions.sql). The
// DB trigger remains the final authority; this gives friendly pre-write errors.
//
// Pure module — safe to import on the client (the format editor) and the
// server. No `server-only`, no DB access.

import { z } from "zod";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n";

function isValidRegex(pattern: string): boolean {
  try {
    RegExp(pattern);
    return true;
  } catch {
    return false;
  }
}

// Per-locale labels. Any locale key is allowed, but the default locale MUST be
// present so there is always a fallback label.
export const stageLabelsSchema = z
  .record(z.string(), z.string())
  .refine((labels) => DEFAULT_LOCALE in labels, {
    message: `labels must include the default locale "${DEFAULT_LOCALE}"`,
  });

export const stageSchema = z.object({
  key: z.string().min(1),
  kind: z.enum(["group", "knockout", "league"]),
  order: z.number().int(),
  labels: stageLabelsSchema,
  icon: z.string().optional(),
  hasGroupCode: z.boolean().default(false),
});

export const groupsSchema = z.discriminatedUnion("enabled", [
  z.object({
    enabled: z.literal(true),
    pattern: z
      .string()
      .min(1)
      .refine(isValidRegex, { message: "groups.pattern is not a valid regex" }),
    count: z.number().int().positive(),
  }),
  z.object({ enabled: z.literal(false) }),
]);

export const formatConfigSchema = z
  .object({
    stages: z.array(stageSchema).min(1, "at least one stage is required"),
    groups: groupsSchema,
  })
  .superRefine((cfg, ctx) => {
    const keys = cfg.stages.map((s) => s.key);
    const dup = keys.find((k, i) => keys.indexOf(k) !== i);
    if (dup) {
      ctx.addIssue({
        code: "custom",
        message: `duplicate stage key: ${dup}`,
        path: ["stages"],
      });
    }
    if (cfg.stages.some((s) => s.hasGroupCode) && !cfg.groups.enabled) {
      ctx.addIssue({
        code: "custom",
        message: "a stage has hasGroupCode but groups.enabled is false",
        path: ["groups", "enabled"],
      });
    }
  });

export const providersSchema = z.object({
  footballData: z
    .object({ code: z.string().min(1), season: z.string().optional() })
    .optional(),
  espn: z.object({ leaguePath: z.string().min(1) }).optional(),
});

export const brandingSchema = z.object({
  brandCode: z.string().optional(),
  joinCodePrefix: z.string().optional(),
  newsQuery: z.string().optional(),
  emailFromName: z.string().optional(),
  ogAlt: z.string().optional(),
  hosts: z.array(z.string()).optional(),
});

export const competitionSchema = z.object({
  slug: z
    .string()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "slug must be lowercase kebab-case"),
  kind: z.string().min(1),
  name: z.string().min(1),
  short_name: z.string().min(1).max(60),
  season: z.string().nullable().optional(),
  tournament_start_at: z.string(),
  tournament_end_at: z.string().nullable().optional(),
  opening_home: z.string().nullable().optional(),
  opening_away: z.string().nullable().optional(),
  opening_venue: z.string().nullable().optional(),
  format_config: formatConfigSchema,
  providers: providersSchema.default({}),
  branding: brandingSchema.default({}),
});

export type StageConfig = z.infer<typeof stageSchema>;
export type CompetitionGroups = z.infer<typeof groupsSchema>;
export type CompetitionFormat = z.infer<typeof formatConfigSchema>;
export type CompetitionProviders = z.infer<typeof providersSchema>;
export type CompetitionBranding = z.infer<typeof brandingSchema>;
export type CompetitionInput = z.infer<typeof competitionSchema>;

// ---------------------------------------------------------------------------
// Pure helpers over a parsed format_config. Used by the UI and server alike.
// ---------------------------------------------------------------------------

export function parseFormatConfig(value: unknown): CompetitionFormat {
  return formatConfigSchema.parse(value);
}

export function safeParseFormatConfig(value: unknown) {
  return formatConfigSchema.safeParse(value);
}

export function sortedStages(format: CompetitionFormat): StageConfig[] {
  return [...format.stages].sort((a, b) => a.order - b.order);
}

export function getStageConfig(
  format: CompetitionFormat,
  stageKey: string,
): StageConfig | undefined {
  return format.stages.find((s) => s.key === stageKey);
}

export function getStageLabel(
  format: CompetitionFormat,
  stageKey: string,
  locale: Locale,
): string {
  const stage = getStageConfig(format, stageKey);
  return stage?.labels[locale] ?? stage?.labels[DEFAULT_LOCALE] ?? stageKey;
}

export function getStageOrder(
  format: CompetitionFormat,
  stageKey: string,
): number {
  return getStageConfig(format, stageKey)?.order ?? Number.MAX_SAFE_INTEGER;
}

export function hasGroupStage(format: CompetitionFormat): boolean {
  return format.groups.enabled;
}

// The stage key of the (first) group stage, e.g. "group" — or null when the
// competition has no group stage. Used to query/group group-stage fixtures
// without hardcoding the literal "group".
export function groupStageKey(format: CompetitionFormat): string | null {
  return format.stages.find((s) => s.kind === "group")?.key ?? null;
}

export function groupCodePattern(format: CompetitionFormat): string | null {
  return format.groups.enabled ? format.groups.pattern : null;
}
