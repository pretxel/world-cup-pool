import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ListTreeIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/admin/empty-state";
import { LocalTime } from "@/components/local-time";
import { localePath, type Locale } from "@/lib/i18n";
import { parsePageParam } from "@/lib/pagination";
import { cn } from "@/lib/utils";
import {
  OPERATION_KINDS,
  type OperationKind,
  type OperationStatus,
} from "@/lib/operations/record-run";
import { getRunHistory } from "@/lib/operations/queries";
import { StatusBadge } from "./status-badge";

const PAGE_SIZE = 20;
const STATUSES: OperationStatus[] = ["success", "partial", "error"];

function str(v: string | string[] | undefined): string | undefined {
  return typeof v === "string" ? v : undefined;
}

function durationLabel(
  ms: number | null,
  t: (k: string, v?: Record<string, string | number | Date>) => string,
): string {
  if (ms == null) return "—";
  if (ms < 1000) return t("runs.millis", { ms });
  return t("runs.seconds", { s: (ms / 1000).toFixed(1) });
}

// Compact "key value · key value" rendering of a run's summary jsonb.
function summaryText(summary: unknown): string {
  if (!summary || typeof summary !== "object") return "—";
  const entries = Object.entries(summary as Record<string, unknown>);
  if (entries.length === 0) return "—";
  return entries.map(([k, v]) => `${k} ${String(v)}`).join(" · ");
}

export async function RunsView({
  locale,
  searchParams: sp,
}: {
  locale: Locale;
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const t = await getTranslations("admin.operations");

  const rawKind = str(sp.kind);
  const kind = OPERATION_KINDS.includes(rawKind as OperationKind)
    ? (rawKind as OperationKind)
    : undefined;
  const rawStatus = str(sp.status);
  const status = STATUSES.includes(rawStatus as OperationStatus)
    ? (rawStatus as OperationStatus)
    : undefined;
  const page = parsePageParam(sp.page);

  const { rows, total } = await getRunHistory({
    kind,
    status,
    page,
    pageSize: PAGE_SIZE,
  });
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Build an /admin/operations?view=runs href with the given overrides; changing
  // a filter resets to page 1.
  const href = (overrides: Record<string, string | undefined>) => {
    const params = new URLSearchParams({ view: "runs" });
    const next = { kind, status, page: String(page), ...overrides };
    if (next.kind) params.set("kind", next.kind);
    if (next.status) params.set("status", next.status);
    if (next.page && next.page !== "1") params.set("page", next.page);
    return localePath(locale, `/admin/operations?${params.toString()}`);
  };

  const filterChip = (
    label: string,
    chipHref: string,
    active: boolean,
  ) => (
    <Link
      key={chipHref + label}
      href={chipHref}
      aria-current={active ? "true" : undefined}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "border-transparent bg-primary/10 text-foreground"
          : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {label}
    </Link>
  );

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            {t("runs.filterKind")}
          </span>
          {filterChip(t("runs.all"), href({ kind: undefined, page: "1" }), !kind)}
          {OPERATION_KINDS.map((k) =>
            filterChip(t(`jobs.${k}`), href({ kind: k, page: "1" }), kind === k),
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            {t("runs.filterStatus")}
          </span>
          {filterChip(t("runs.all"), href({ status: undefined, page: "1" }), !status)}
          {STATUSES.map((s) =>
            filterChip(
              t(`status.${s}`),
              href({ status: s, page: "1" }),
              status === s,
            ),
          )}
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<ListTreeIcon />}
          title={t("runs.emptyTitle")}
          description={t("runs.emptyBody")}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          <div className="hidden border-b border-border bg-muted/40 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground sm:grid sm:grid-cols-[10rem_minmax(0,1fr)_auto] sm:gap-4">
            <span>{t("runs.colWhen")}</span>
            <span>{t("runs.colKind")}</span>
            <span>{t("runs.colStatus")}</span>
          </div>
          <ul>
            {rows.map((run) => (
              <li
                key={run.id}
                className="flex flex-col gap-2 border-b border-border p-3 last:border-b-0 even:bg-muted/20 sm:grid sm:grid-cols-[10rem_minmax(0,1fr)_auto] sm:items-start sm:gap-4"
              >
                <div className="text-sm text-muted-foreground">
                  <LocalTime iso={run.started_at} />
                </div>
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{t(`jobs.${run.kind}`)}</span>
                    <Badge variant="outline">
                      {t(`trigger.${run.trigger}`)}
                    </Badge>
                    <span className="font-mono text-xs text-muted-foreground">
                      {durationLabel(run.duration_ms, t)}
                    </span>
                  </div>
                  <div className="font-mono text-xs text-muted-foreground">
                    {summaryText(run.summary)}
                  </div>
                  {run.error ? (
                    <div className="text-xs text-destructive">
                      {t("runs.errorLabel")}: {run.error}
                    </div>
                  ) : null}
                </div>
                <div>
                  <StatusBadge
                    status={run.status}
                    label={t(`status.${run.status}`)}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 ? (
        <nav className="flex items-center justify-between gap-3 text-sm">
          {page > 1 ? (
            <Link
              href={href({ page: String(page - 1) })}
              className="rounded-md border border-border px-3 py-1.5 hover:bg-muted"
            >
              {t("runs.prev")}
            </Link>
          ) : (
            <span className="rounded-md border border-border px-3 py-1.5 text-muted-foreground opacity-50">
              {t("runs.prev")}
            </span>
          )}
          <span className="font-mono text-xs text-muted-foreground">
            {t("runs.page", { page, total: totalPages })}
          </span>
          {page < totalPages ? (
            <Link
              href={href({ page: String(page + 1) })}
              className="rounded-md border border-border px-3 py-1.5 hover:bg-muted"
            >
              {t("runs.next")}
            </Link>
          ) : (
            <span className="rounded-md border border-border px-3 py-1.5 text-muted-foreground opacity-50">
              {t("runs.next")}
            </span>
          )}
        </nav>
      ) : null}
    </div>
  );
}
