import { getTranslations } from "next-intl/server";
import { TeamFlag } from "@/components/team-flag";
import type { GroupTeamRow } from "@/lib/group-standings";
import { cn } from "@/lib/utils";

export async function LeagueStandingsTable({
  rows,
  className,
}: {
  rows: GroupTeamRow[];
  className?: string;
}) {
  const t = await getTranslations("leagueStandings");
  const hasResults = rows.some((r) => r.played > 0);

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-card",
        className,
      )}
    >
      <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
        <h3 className="font-heading text-sm font-semibold tracking-tight">
          {t("heading")}
        </h3>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          {t("caption")}
        </span>
      </div>

      {hasResults ? (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                <th scope="col" className="px-3 py-2 text-left font-medium">
                  {t("colTeam")}
                </th>
                <NumHead abbr={t("colPlayed")} full={t("colPlayedFull")} />
                <NumHead
                  abbr={t("colWon")}
                  full={t("colWonFull")}
                  className="hidden sm:table-cell"
                />
                <NumHead
                  abbr={t("colDrawn")}
                  full={t("colDrawnFull")}
                  className="hidden sm:table-cell"
                />
                <NumHead
                  abbr={t("colLost")}
                  full={t("colLostFull")}
                  className="hidden sm:table-cell"
                />
                <NumHead
                  abbr={t("colGoalsFor")}
                  full={t("colGoalsForFull")}
                  className="hidden md:table-cell"
                />
                <NumHead
                  abbr={t("colGoalsAgainst")}
                  full={t("colGoalsAgainstFull")}
                  className="hidden md:table-cell"
                />
                <NumHead abbr={t("colGoalDiff")} full={t("colGoalDiffFull")} />
                <NumHead
                  abbr={t("colPoints")}
                  full={t("colPointsFull")}
                  className="pr-3"
                />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.team}
                  className="border-b border-border/60 last:border-0"
                >
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="w-3.5 shrink-0 text-right font-mono text-xs tabular-nums text-muted-foreground">
                        {row.rank}
                      </span>
                      <TeamFlag team={row.team} size="sm" />
                      <span className="truncate font-medium">{row.team}</span>
                    </div>
                  </td>
                  <NumCell value={row.played} />
                  <NumCell value={row.won} className="hidden sm:table-cell" />
                  <NumCell value={row.drawn} className="hidden sm:table-cell" />
                  <NumCell value={row.lost} className="hidden sm:table-cell" />
                  <NumCell
                    value={row.goalsFor}
                    className="hidden md:table-cell"
                  />
                  <NumCell
                    value={row.goalsAgainst}
                    className="hidden md:table-cell"
                  />
                  <NumCell value={signed(row.goalDiff)} />
                  <td className="px-3 py-2 text-right font-mono font-semibold tabular-nums">
                    {row.points}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="px-4 py-6 text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            {t("emptyTitle")}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{t("emptyBody")}</p>
        </div>
      )}
    </div>
  );
}

function signed(n: number): string {
  return n > 0 ? `+${n}` : String(n);
}

function NumHead({
  abbr,
  full,
  className,
}: {
  abbr: string;
  full: string;
  className?: string;
}) {
  return (
    <th
      scope="col"
      title={full}
      className={cn("px-1.5 py-2 text-right font-medium", className)}
    >
      <abbr title={full} className="no-underline">
        {abbr}
      </abbr>
    </th>
  );
}

function NumCell({
  value,
  className,
}: {
  value: number | string;
  className?: string;
}) {
  return (
    <td
      className={cn(
        "px-1.5 py-2 text-right font-mono tabular-nums text-muted-foreground",
        className,
      )}
    >
      {value}
    </td>
  );
}
