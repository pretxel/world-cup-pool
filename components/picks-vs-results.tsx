import { getTranslations } from "next-intl/server";
import { GroupStandingsTable } from "@/components/group-standings-table";
import type { SimulatedGroup } from "@/lib/group-standings";
import { cn } from "@/lib/utils";

// Side-by-side group-standings split: the player's simulated tables (from their
// picks) beside the real, results-derived tables. Both columns reuse the shared
// `GroupStandingsTable` via its `source` prop, so no new table primitive is
// introduced. Side-by-side on wide screens, stacked on mobile. Groups are paired
// by `groupCode`; either side may be empty (shows its own empty state).
export async function PicksVsResults({
  pickGroups,
  resultGroups,
  className,
}: {
  pickGroups: SimulatedGroup[];
  resultGroups: SimulatedGroup[];
  className?: string;
}) {
  const t = await getTranslations("picksVsResults");

  // Union of group codes from both sides, preserving the picks ordering first.
  const resultsByCode = new Map(resultGroups.map((g) => [g.groupCode, g]));
  const codes: string[] = [];
  const seen = new Set<string>();
  for (const g of pickGroups) {
    if (!seen.has(g.groupCode)) {
      seen.add(g.groupCode);
      codes.push(g.groupCode);
    }
  }
  for (const g of resultGroups) {
    if (!seen.has(g.groupCode)) {
      seen.add(g.groupCode);
      codes.push(g.groupCode);
    }
  }
  if (codes.length === 0) return null;

  const picksByCode = new Map(pickGroups.map((g) => [g.groupCode, g]));

  return (
    <section className={className}>
      <div className="mb-4 border-b border-border pb-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
          {t("eyebrow")}
        </p>
        <h2
          className="mt-1 font-heading text-2xl font-semibold tracking-tight"
          style={{ fontStretch: "condensed" }}
        >
          {t("heading")}
        </h2>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          {t("lede")}
        </p>
      </div>

      <div className="grid gap-6">
        {codes.map((code) => {
          const picks = picksByCode.get(code)?.rows ?? [];
          const results = resultsByCode.get(code)?.rows ?? [];
          return (
            <div key={code} className="grid gap-3 lg:grid-cols-2">
              <ColumnLabelled label={t("picksLabel")}>
                <GroupStandingsTable
                  groupCode={code}
                  rows={picks}
                  source="picks"
                />
              </ColumnLabelled>
              <ColumnLabelled label={t("resultsLabel")}>
                <GroupStandingsTable
                  groupCode={code}
                  rows={results}
                  source="results"
                />
              </ColumnLabelled>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ColumnLabelled({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </p>
      {children}
    </div>
  );
}
