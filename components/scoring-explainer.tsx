import { getTranslations } from "next-intl/server";
import { getActiveCompetition } from "@/lib/competition";
import { getStageLabel } from "@/lib/competition-schema";
import { BASE_POINTS, STAGE_POINT_MULTIPLIER } from "@/lib/scoring";
import { cn } from "@/lib/utils";
import type { Locale } from "@/lib/i18n";

// Phases shown in the explainer, in ascending-stakes order. The per-stage points
// are derived from BASE_POINTS × STAGE_POINT_MULTIPLIER (the shared scoring
// constants) so this section can never drift from the actual scorer.
const STAGE_ORDER = ["group", "r32", "r16", "qf", "sf", "final", "third"] as const;

// Base-point tiers, in the order they appear as columns.
const TIERS = [
  { key: "exact", base: BASE_POINTS.exact, labelKey: "exact" },
  { key: "winnerGd", base: BASE_POINTS.winner_gd, labelKey: "winnerGd" },
  { key: "winner", base: BASE_POINTS.winner, labelKey: "winner" },
] as const;

export async function ScoringExplainer({ locale }: { locale: Locale }) {
  const t = await getTranslations("scoring");
  const competition = await getActiveCompetition();
  const format = competition?.format;

  const rows = STAGE_ORDER.map((stage) => ({
    stage,
    // Localized stage name from the active competition format; falls back to the
    // stage key when there is no active competition or the stage is unmapped.
    label: format ? getStageLabel(format, stage, locale) : stage,
    multiplier: STAGE_POINT_MULTIPLIER[stage] ?? 1,
  }));

  return (
    <section
      id="stage-scoring"
      className="border-t border-border/70 bg-muted/30"
    >
      <div className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
        <div className="max-w-2xl">
          <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
            {t("eyebrow")}
          </p>
          <h2
            className="mt-2 font-heading text-3xl font-semibold tracking-tight sm:text-4xl"
            style={{ fontStretch: "condensed" }}
          >
            {t("heading")}
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
            {t("lede")}
          </p>
        </div>

        <div className="mt-10 overflow-x-auto rounded-xl ring-1 ring-border">
          <table className="w-full min-w-[28rem] border-collapse bg-card text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  &nbsp;
                </th>
                <th className="px-4 py-3 text-right font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  ×
                </th>
                {TIERS.map((tier) => (
                  <th
                    key={tier.key}
                    className="px-4 py-3 text-right font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground"
                  >
                    {t(tier.labelKey)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr
                  key={row.stage}
                  className={cn(
                    "border-b border-border/60 last:border-0",
                    i % 2 === 1 && "bg-muted/30",
                  )}
                >
                  <th
                    scope="row"
                    className="px-4 py-3 text-left font-heading text-sm font-semibold tracking-tight"
                  >
                    {row.label}
                  </th>
                  <td className="px-4 py-3 text-right font-mono text-xs tabular-nums text-muted-foreground">
                    {row.multiplier}×
                  </td>
                  {TIERS.map((tier) => (
                    <td
                      key={tier.key}
                      className="px-4 py-3 text-right font-mono text-base font-semibold tabular-nums"
                    >
                      {tier.base * row.multiplier}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
