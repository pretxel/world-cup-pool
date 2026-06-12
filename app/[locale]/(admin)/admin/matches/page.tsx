import { getTranslations, setRequestLocale } from "next-intl/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { LocalTime } from "@/components/local-time";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  saveFixture,
  setMatchResult,
  forceRecompute,
  deleteMatch,
  syncNow,
} from "./actions";
import { isLocale, DEFAULT_LOCALE, type Locale } from "@/lib/i18n";
import { isConfirmedMatch } from "@/lib/match-utils";
import { isStaleMatch } from "@/lib/result-sync/staleness";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "admin" });
  return { title: t("title") };
}

const STAGE_KEYS = {
  group: "stageGroup",
  r32: "stageR32",
  r16: "stageR16",
  qf: "stageQf",
  sf: "stageSf",
  third: "stageThird",
  final: "stageFinal",
} as const;

const STATUS_KEYS = {
  scheduled: "statusScheduled",
  live: "statusLive",
  final: "statusFinal",
  cancelled: "statusCancelled",
} as const;

// The syncNow action reports back via query params (server-rendered page, no
// client state). Non-numeric values render as 0 rather than erroring.
function parseSyncSummaryParams(params: {
  [key: string]: string | string[] | undefined;
}): { source: string; counts: Record<string, number> } | null {
  const source = params.syncSource;
  if (typeof source !== "string" || source.length === 0) return null;
  const count = (key: string) => {
    const raw = params[key];
    const n = typeof raw === "string" ? Number(raw) : NaN;
    return Number.isInteger(n) && n >= 0 ? n : 0;
  };
  return {
    source,
    counts: {
      fetched: count("syncFetched"),
      matched: count("syncMatched"),
      final: count("syncFinal"),
      stale: count("syncStale"),
      staleResolved: count("syncStaleResolved"),
      errors: count("syncErrors"),
    },
  };
}

export default async function AdminMatchesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : DEFAULT_LOCALE;
  setRequestLocale(locale);

  const t = await getTranslations("admin");
  const tStages = await getTranslations("stages");
  const tStatus = await getTranslations("matchStatus");

  const syncSummary = parseSyncSummaryParams(await searchParams);
  const now = new Date();

  const supabase = await createServerSupabaseClient();
  const { data: matches } = await supabase
    .from("matches")
    .select("*")
    .order("kickoff_at", { ascending: true });

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-3xl font-bold">{t("headline")}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t("lede")}</p>

      <section className="mt-6 rounded-lg border p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">{t("syncTitle")}</h2>
            <p className="text-sm text-muted-foreground">{t("syncLede")}</p>
          </div>
          <form action={syncNow}>
            <input type="hidden" name="locale" value={locale} />
            <Button type="submit">{t("syncNow")}</Button>
          </form>
        </div>
        {syncSummary ? (
          syncSummary.source === "none" ? (
            <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {t("syncFailed", { errors: syncSummary.counts.errors })}
            </div>
          ) : (
            <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 rounded-md border bg-muted/30 p-3 text-sm sm:grid-cols-3">
              <div className="flex justify-between gap-2 sm:block">
                <dt className="text-muted-foreground">{t("syncSource")}</dt>
                <dd className="font-mono">{syncSummary.source}</dd>
              </div>
              <div className="flex justify-between gap-2 sm:block">
                <dt className="text-muted-foreground">{t("syncMatched")}</dt>
                <dd className="font-mono tabular-nums">
                  {syncSummary.counts.matched}
                </dd>
              </div>
              <div className="flex justify-between gap-2 sm:block">
                <dt className="text-muted-foreground">{t("syncFinalized")}</dt>
                <dd className="font-mono tabular-nums">
                  {syncSummary.counts.final}
                </dd>
              </div>
              <div className="flex justify-between gap-2 sm:block">
                <dt className="text-muted-foreground">{t("syncStaleResolved")}</dt>
                <dd className="font-mono tabular-nums">
                  {syncSummary.counts.staleResolved}
                </dd>
              </div>
              <div className="flex justify-between gap-2 sm:block">
                <dt className="text-muted-foreground">{t("syncStale")}</dt>
                <dd className="font-mono tabular-nums">
                  {syncSummary.counts.stale}
                </dd>
              </div>
              <div className="flex justify-between gap-2 sm:block">
                <dt className="text-muted-foreground">{t("syncErrors")}</dt>
                <dd className="font-mono tabular-nums">
                  {syncSummary.counts.errors}
                </dd>
              </div>
            </dl>
          )
        ) : null}
      </section>

      <section className="mt-8 rounded-lg border p-4">
        <h2 className="mb-3 text-lg font-semibold">{t("newFixture")}</h2>
        <form action={saveFixture} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="stage">{t("stage")}</Label>
            <select id="stage" name="stage" className="h-9 w-full rounded-md border px-3 text-sm">
              <option value="group">{t("stageGroup")}</option>
              <option value="r32">{t("stageR32")}</option>
              <option value="r16">{t("stageR16")}</option>
              <option value="qf">{t("stageQf")}</option>
              <option value="sf">{t("stageSf")}</option>
              <option value="third">{t("stageThird")}</option>
              <option value="final">{t("stageFinal")}</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="group_code">{t("groupCode")}</Label>
            <Input id="group_code" name="group_code" maxLength={1} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="home_team">{t("homeTeam")}</Label>
            <Input id="home_team" name="home_team" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="away_team">{t("awayTeam")}</Label>
            <Input id="away_team" name="away_team" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="kickoff_at">{t("kickoff")}</Label>
            <Input id="kickoff_at" name="kickoff_at" type="datetime-local" required step="60" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="venue">{t("venue")}</Label>
            <Input id="venue" name="venue" />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit">{t("createFixture")}</Button>
          </div>
        </form>
      </section>

      <section className="mt-10 space-y-4">
        <h2 className="text-lg font-semibold">
          {t("allFixtures", { count: matches?.length ?? 0 })}
        </h2>
        {(matches ?? []).map((m) => {
          const stageKey = STAGE_KEYS[m.stage as keyof typeof STAGE_KEYS];
          const statusKey = STATUS_KEYS[m.status as keyof typeof STATUS_KEYS];
          return (
            <article key={m.id} className="rounded-lg border p-4">
              <header className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">
                  {tStages(m.stage as keyof IntlMessages["stages"])}
                  {m.group_code ? ` · ${m.group_code}` : ""}
                </Badge>
                <Badge variant={m.status === "final" ? "default" : "secondary"}>
                  {tStatus(m.status as keyof IntlMessages["matchStatus"])}
                </Badge>
                {!isConfirmedMatch(m) ? (
                  <Badge variant="destructive">{t("unconfirmed")}</Badge>
                ) : null}
                {isStaleMatch(m, now) ? (
                  <Badge variant="destructive">{t("staleBadge")}</Badge>
                ) : null}
                <span className="text-xs text-muted-foreground">
                  <LocalTime iso={m.kickoff_at} />
                </span>
                <span className="sr-only">{stageKey} {statusKey}</span>
              </header>
              <div className="mt-2 text-base font-medium">
                {m.home_team} vs {m.away_team}
                {m.status === "final" && m.home_score != null && m.away_score != null ? (
                  <span className="ml-2 font-mono text-muted-foreground">
                    ({m.home_score}–{m.away_score})
                  </span>
                ) : null}
              </div>
              {m.venue ? <div className="text-xs text-muted-foreground">{m.venue}</div> : null}

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <form action={setMatchResult} className="rounded-md border p-3">
                  <input type="hidden" name="match_id" value={m.id} />
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t("result")}
                  </div>
                  <div className="mt-2 flex items-end gap-2">
                    <div className="flex-1">
                      <Label htmlFor={`hs-${m.id}`} className="text-xs">{m.home_team}</Label>
                      <Input id={`hs-${m.id}`} name="home_score" type="number" min={0} max={30} defaultValue={m.home_score ?? ""} />
                    </div>
                    <span className="pb-2">–</span>
                    <div className="flex-1">
                      <Label htmlFor={`as-${m.id}`} className="text-xs">{m.away_team}</Label>
                      <Input id={`as-${m.id}`} name="away_score" type="number" min={0} max={30} defaultValue={m.away_score ?? ""} />
                    </div>
                  </div>
                  <div className="mt-2 space-y-1.5">
                    <Label htmlFor={`st-${m.id}`} className="text-xs">{t("status")}</Label>
                    <select id={`st-${m.id}`} name="status" defaultValue={m.status} className="h-9 w-full rounded-md border px-3 text-sm">
                      <option value="scheduled">{t("statusScheduled")}</option>
                      <option value="live">{t("statusLive")}</option>
                      <option value="final">{t("statusFinal")}</option>
                      <option value="cancelled">{t("statusCancelled")}</option>
                    </select>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Button type="submit" size="sm">{t("saveResult")}</Button>
                  </div>
                </form>

                <div className="space-y-3">
                  <form action={forceRecompute} className="flex items-center gap-2">
                    <input type="hidden" name="match_id" value={m.id} />
                    <Button type="submit" size="sm" variant="outline">
                      {t("forceRecompute")}
                    </Button>
                  </form>
                  <form action={deleteMatch} className="flex items-center gap-2">
                    <input type="hidden" name="id" value={m.id} />
                    <Button type="submit" size="sm" variant="destructive">
                      {t("deleteFixture")}
                    </Button>
                  </form>
                </div>
              </div>

              <details className="mt-4 rounded-md border p-3">
                <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("editFixture")}
                </summary>
                <form
                  action={saveFixture}
                  className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2"
                >
                  <input type="hidden" name="id" value={m.id} />
                  <div className="space-y-1.5">
                    <Label htmlFor={`stage-${m.id}`}>{t("stage")}</Label>
                    <select
                      id={`stage-${m.id}`}
                      name="stage"
                      defaultValue={m.stage}
                      className="h-9 w-full rounded-md border px-3 text-sm"
                    >
                      <option value="group">{t("stageGroup")}</option>
                      <option value="r32">{t("stageR32")}</option>
                      <option value="r16">{t("stageR16")}</option>
                      <option value="qf">{t("stageQf")}</option>
                      <option value="sf">{t("stageSf")}</option>
                      <option value="third">{t("stageThird")}</option>
                      <option value="final">{t("stageFinal")}</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`gc-${m.id}`}>{t("groupCode")}</Label>
                    <Input
                      id={`gc-${m.id}`}
                      name="group_code"
                      maxLength={1}
                      defaultValue={m.group_code ?? ""}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`ht-${m.id}`}>{t("homeTeam")}</Label>
                    <Input
                      id={`ht-${m.id}`}
                      name="home_team"
                      defaultValue={m.home_team}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`at-${m.id}`}>{t("awayTeam")}</Label>
                    <Input
                      id={`at-${m.id}`}
                      name="away_team"
                      defaultValue={m.away_team}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`ko-${m.id}`}>{t("kickoff")}</Label>
                    <Input
                      id={`ko-${m.id}`}
                      name="kickoff_at"
                      type="datetime-local"
                      step="60"
                      defaultValue={m.kickoff_at.slice(0, 16)}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`vn-${m.id}`}>{t("venue")}</Label>
                    <Input
                      id={`vn-${m.id}`}
                      name="venue"
                      defaultValue={m.venue ?? ""}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <Button type="submit" size="sm">
                      {t("saveEdit")}
                    </Button>
                  </div>
                </form>
              </details>
            </article>
          );
        })}
      </section>
    </main>
  );
}
