import { getFormatter, getTranslations } from "next-intl/server";
import { ActivityIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/admin/empty-state";
import { getUserActivity } from "@/lib/operations/queries";

export async function ActivityView() {
  const t = await getTranslations("admin.operations");
  const format = await getFormatter();
  const now = new Date();
  const { feed, stats } = await getUserActivity(now);

  const statTiles: { key: string; value: string; sub?: string }[] = [
    { key: "totalPlayers", value: String(stats.totalPlayers) },
    { key: "active", value: String(stats.activeLast7d) },
    {
      key: "predictionOptOut",
      value: String(stats.predictionOptOut),
      sub: t("activity.ofPlayers", { total: stats.totalPlayers }),
    },
    {
      key: "quizOptOut",
      value: String(stats.quizOptOut),
      sub: t("activity.ofPlayers", { total: stats.totalPlayers }),
    },
  ];

  return (
    <div className="space-y-5">
      {/* Engagement aggregates */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statTiles.map((tile) => (
          <Card key={tile.key} className="gap-1 p-4">
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              {t(`activity.stat.${tile.key}`)}
            </div>
            <div className="font-heading text-2xl font-semibold tabular-nums">
              {tile.value}
            </div>
            {tile.sub ? (
              <div className="text-xs text-muted-foreground">{tile.sub}</div>
            ) : null}
          </Card>
        ))}
      </div>

      {/* Activity feed */}
      <section className="space-y-3">
        <h2 className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {t("activity.feedTitle")}
        </h2>
        {feed.length === 0 ? (
          <EmptyState
            icon={<ActivityIcon />}
            title={t("activity.emptyTitle")}
            description={t("activity.emptyBody")}
          />
        ) : (
          <div className="overflow-hidden rounded-xl border border-border">
            <ul>
              {feed.map((event, i) => (
                <li
                  key={`${event.type}-${event.userId}-${event.at}-${i}`}
                  className="flex items-center justify-between gap-3 border-b border-border p-3 last:border-b-0 even:bg-muted/20"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <Badge variant="outline">{t(`activity.type.${event.type}`)}</Badge>
                    <span className="truncate font-medium">
                      {event.displayName ?? t("activity.unknownUser")}
                    </span>
                  </div>
                  <span
                    title={event.at}
                    className="shrink-0 text-xs text-muted-foreground"
                  >
                    {format.relativeTime(new Date(event.at), now)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
