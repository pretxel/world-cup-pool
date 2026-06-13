import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { normalizeTeamName } from "@/lib/team-name-aliases";
import { isConfirmedMatch } from "@/lib/match-utils";
import { findStaleMatches, isStaleMatch } from "@/lib/result-sync/staleness";
import { footballDataProvider } from "@/lib/result-sync/providers/football-data";
import { espnProvider } from "@/lib/result-sync/providers/espn";
import type {
  LocalMatch,
  ProviderConfig,
  RemoteMatch,
  ResultProvider,
  RunSummary,
} from "@/lib/result-sync/types";

// Order matters: first available provider is primary, the rest are fallbacks.
export function defaultProviders(): ResultProvider[] {
  return [footballDataProvider, espnProvider];
}

export function availableProviders(
  providers: ResultProvider[] = defaultProviders(),
): ResultProvider[] {
  return providers.filter((p) => p.available());
}

export type RunSyncOptions = {
  providers?: ResultProvider[];
  now?: Date;
  // Which competition to sync. Defaults to the active competition, so the cron
  // route stays parameterless while admin can sync a non-active draft.
  competitionId?: string;
};

// Per-day fallback sources cost one request per date; during a normal World
// Cup the unresolved backlog is 1-2 days, so this cap only bites when the sync
// has been dead for two weeks. Capped dates are logged, never silently lost.
const MAX_FALLBACK_DATES = 14;

// UTC dates (most recent first) on which a local match could plausibly have a
// result we're missing: confirmed teams, non-terminal status, kickoff in the
// past. Drives the per-date fallback fetches.
function candidateDates(locals: LocalMatch[], now: Date): string[] {
  const dates = new Set<string>();
  for (const m of locals) {
    if (m.status === "final" || m.status === "cancelled") continue;
    if (!isConfirmedMatch(m)) continue;
    const kickoff = Date.parse(m.kickoff_at);
    if (Number.isNaN(kickoff) || kickoff > now.getTime()) continue;
    dates.add(m.kickoff_at.slice(0, 10));
  }
  const sorted = [...dates].sort().reverse();
  if (sorted.length > MAX_FALLBACK_DATES) {
    console.warn(
      `[result-sync] capping fallback dates: ${sorted.length} candidate days, fetching newest ${MAX_FALLBACK_DATES}`,
    );
  }
  return sorted.slice(0, MAX_FALLBACK_DATES);
}

type AdminClient = ReturnType<typeof createAdminSupabaseClient>;

// Mirror one batch of remote rows into the matched local rows. Mutates
// `summary` and the in-memory `locals` (via byKey) so staleness re-checks and
// later batches see what this batch wrote. Returns how many rows were written.
async function applyRemote(
  admin: AdminClient,
  byKey: Map<string, LocalMatch>,
  remote: RemoteMatch[],
  providerName: string,
  summary: RunSummary,
): Promise<number> {
  let written = 0;

  for (const r of remote) {
    const home = normalizeTeamName(r.homeTeam?.name ?? null);
    const away = normalizeTeamName(r.awayTeam?.name ?? null);
    const date = (r.utcDate ?? "").slice(0, 10);
    if (!home || !away || !date) continue;

    const local = byKey.get(`${home}|${away}|${date}`);
    if (!local) {
      summary.unmatched++;
      console.warn(
        `[result-sync:${providerName}] unmatched remote: ${home} vs ${away} @ ${date}`,
      );
      continue;
    }
    summary.matched++;

    const status = (r.status ?? "").toUpperCase();
    const fullTime = r.score?.fullTime;
    let touched = false;

    // FINISHED / AWARDED → write score + status='final'.
    if (
      (status === "FINISHED" || status === "AWARDED") &&
      fullTime?.home != null &&
      fullTime.away != null
    ) {
      if (local.status === "final") {
        // A final is immutable to every provider — score corrections go
        // through the admin form, never through a feed. Identical payloads
        // skip the redundant UPDATE but still recompute, healing a
        // previously failed compute_match_scores call (the idempotent
        // re-run contract: public.scores must converge even if a past
        // run's RPC errored after its write succeeded).
        const identical =
          local.home_score === fullTime.home &&
          local.away_score === fullTime.away;
        if (identical) {
          const { error: rpcErr } = await admin.rpc("compute_match_scores", {
            p_match_id: local.id,
          });
          if (rpcErr) {
            summary.errors++;
            console.error(
              `[result-sync:${providerName}] recompute failed for ${local.id}:`,
              rpcErr.message,
            );
          } else {
            summary.recomputed++;
          }
        }
        continue;
      }
      // .neq guards the race with a concurrent admin edit: the local
      // snapshot was loaded at run start, so the DB — not the snapshot —
      // has the final word on whether the row is already final.
      const { error } = await admin
        .from("matches")
        .update({
          home_score: fullTime.home,
          away_score: fullTime.away,
          status: "final",
        })
        .eq("id", local.id)
        .neq("status", "final");
      if (error) {
        summary.errors++;
        console.error(
          `[result-sync:${providerName}] update final failed for ${local.id}:`,
          error.message,
        );
        continue;
      }
      local.home_score = fullTime.home;
      local.away_score = fullTime.away;
      local.status = "final";
      summary.final++;
      touched = true;
    } else if (
      (status === "IN_PLAY" || status === "PAUSED") &&
      local.status !== "final" &&
      local.status !== "live"
    ) {
      // Flip to live, but never downgrade a final — including one written
      // by an admin after this run's snapshot was loaded (hence .neq).
      const { error } = await admin
        .from("matches")
        .update({ status: "live" })
        .eq("id", local.id)
        .neq("status", "final");
      if (error) {
        summary.errors++;
        console.error(
          `[result-sync:${providerName}] update live failed for ${local.id}:`,
          error.message,
        );
        continue;
      }
      local.status = "live";
      summary.live++;
      touched = true;
    }

    if (touched) {
      written++;
      const { error: rpcErr } = await admin.rpc("compute_match_scores", {
        p_match_id: local.id,
      });
      if (rpcErr) {
        summary.errors++;
        console.error(
          `[result-sync:${providerName}] recompute failed for ${local.id}:`,
          rpcErr.message,
        );
        continue;
      }
      summary.recomputed++;
    }
  }

  return written;
}

// One sync run: fetch through the provider chain, mirror into public.matches,
// recompute touched scores, and report staleness. Escalates to the fallback
// provider when the primary hard-fails, returns nothing, or leaves stale
// matches behind. Never throws on provider failures — only on the local DB
// being unreachable.
export async function runSync(opts: RunSyncOptions = {}): Promise<RunSummary> {
  const now = opts.now ?? new Date();
  const providers = availableProviders(opts.providers ?? defaultProviders());

  const summary: RunSummary = {
    fetched: 0,
    matched: 0,
    live: 0,
    final: 0,
    recomputed: 0,
    unmatched: 0,
    errors: 0,
    source: "none",
    stale: 0,
    staleResolved: 0,
  };

  const admin = createAdminSupabaseClient();

  // Resolve the competition to sync (default: the active one) and its provider
  // config. Loading and the dedupe key are scoped to this competition so two
  // competitions sharing a date/teams cannot collide.
  const compQuery = admin.from("competitions").select("id, providers");
  const { data: comp } = opts.competitionId
    ? await compQuery.eq("id", opts.competitionId).maybeSingle()
    : await compQuery.eq("is_active", true).maybeSingle();
  const competitionId = comp?.id ?? opts.competitionId;
  const providerConfig = (comp?.providers ?? undefined) as
    | ProviderConfig
    | undefined;

  let matchesQuery = admin
    .from("matches")
    .select(
      "id, home_team, away_team, kickoff_at, home_score, away_score, status",
    );
  if (competitionId) matchesQuery = matchesQuery.eq("competition_id", competitionId);
  const { data: localRows, error: loadErr } = await matchesQuery;
  if (loadErr) {
    throw new Error(`Failed to load local matches: ${loadErr.message}`);
  }
  const locals = (localRows ?? []) as LocalMatch[];

  // Index local matches by (home|away|YYYY-MM-DD) for O(1) lookup. The set is
  // already competition-scoped by the query above, so this key is unambiguous.
  const byKey = new Map<string, LocalMatch>();
  for (const m of locals) {
    byKey.set(`${m.home_team}|${m.away_team}|${m.kickoff_at.slice(0, 10)}`, m);
  }

  const staleAtStart = findStaleMatches(locals, now);
  const dates = candidateDates(locals, now);
  const [primary, fallback] = providers;

  // Main fetch: primary first; full fallback run on hard failure or an empty
  // payload (an empty competition feed mid-tournament is a failure in
  // disguise, not a result).
  let remote: RemoteMatch[] = [];
  if (primary) {
    try {
      remote = await primary.fetchMatches(dates, providerConfig);
      if (remote.length > 0) {
        summary.source = primary.name;
      } else {
        console.warn(`[result-sync] ${primary.name} returned 0 matches`);
      }
    } catch (err) {
      summary.errors++;
      console.error(`[result-sync] ${primary.name} fetch failed:`, err);
    }
  }
  if (summary.source === "none" && fallback) {
    try {
      remote = await fallback.fetchMatches(dates, providerConfig);
      // `source` means "whose data was applied" — an empty fallback payload
      // applied nothing, so the run stays source: "none".
      if (remote.length > 0) {
        summary.source = fallback.name;
      } else {
        console.warn(`[result-sync] ${fallback.name} returned 0 matches`);
      }
    } catch (err) {
      summary.errors++;
      console.error(`[result-sync] ${fallback.name} fetch failed:`, err);
      remote = [];
    }
  }

  if (summary.source !== "none") {
    summary.fetched += remote.length;
    await applyRemote(admin, byKey, remote, summary.source, summary);
  }

  // Targeted escalation: the primary "succeeded" but left overdue matches
  // unresolved — ask the fallback about just those days.
  if (primary && fallback && summary.source === primary.name) {
    const staleAfterMain = findStaleMatches(locals, now);
    if (staleAfterMain.length > 0) {
      const staleDates = [
        ...new Set(staleAfterMain.map((m) => m.kickoff_at.slice(0, 10))),
      ];
      try {
        const extra = await fallback.fetchMatches(staleDates, providerConfig);
        summary.fetched += extra.length;
        const written = await applyRemote(
          admin,
          byKey,
          extra,
          fallback.name,
          summary,
        );
        if (written > 0) summary.source = fallback.name;
      } catch (err) {
        summary.errors++;
        console.error(
          `[result-sync] ${fallback.name} escalation fetch failed:`,
          err,
        );
      }
    }
  }

  summary.stale = findStaleMatches(locals, now).length;
  summary.staleResolved = staleAtStart.filter(
    (m) => !isStaleMatch(m, now),
  ).length;

  return summary;
}
