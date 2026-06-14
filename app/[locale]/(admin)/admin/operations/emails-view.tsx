import { getTranslations } from "next-intl/server";
import { MailIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/admin/empty-state";
import { LocalTime } from "@/components/local-time";
import {
  getEmailLogs,
  type EmailEventType,
} from "@/lib/operations/queries";

const TYPES: EmailEventType[] = ["result", "prediction_reminder", "quiz_reminder"];

export async function EmailsView() {
  const t = await getTranslations("admin.operations");
  const { events, totals } = await getEmailLogs(new Date());

  return (
    <div className="space-y-5">
      {/* Per-type totals over the recent window */}
      <div className="grid gap-4 sm:grid-cols-3">
        {TYPES.map((type) => (
          <Card key={type} className="gap-1 p-4">
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              {t(`emails.type.${type}`)}
            </div>
            <div className="font-heading text-2xl font-semibold tabular-nums">
              {totals[type]}
            </div>
            <div className="text-xs text-muted-foreground">
              {t("emails.totals")}
            </div>
          </Card>
        ))}
      </div>

      {events.length === 0 ? (
        <EmptyState
          icon={<MailIcon />}
          title={t("emails.emptyTitle")}
          description={t("emails.emptyBody")}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <div className="hidden border-b border-border bg-muted/40 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground sm:grid sm:grid-cols-[8rem_minmax(0,1fr)_10rem] sm:gap-4">
            <span aria-hidden />
            <span>{t("emails.recipient")}</span>
            <span>{t("emails.sent")}</span>
          </div>
          <ul>
            {events.map((event, i) => (
              <li
                key={`${event.type}-${event.userId}-${event.sentAt}-${i}`}
                className="flex flex-col gap-1.5 border-b border-border p-3 last:border-b-0 even:bg-muted/20 sm:grid sm:grid-cols-[8rem_minmax(0,1fr)_10rem] sm:items-center sm:gap-4"
              >
                <div>
                  <Badge variant="outline">{t(`emails.type.${event.type}`)}</Badge>
                </div>
                <div className="min-w-0">
                  <div className="truncate font-medium">
                    {event.displayName ?? t("emails.unknownUser")}
                  </div>
                  <div className="truncate font-mono text-xs text-muted-foreground">
                    {event.email ?? t("emails.noEmail")}
                  </div>
                </div>
                <div className="text-sm text-muted-foreground">
                  <LocalTime iso={event.sentAt} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
