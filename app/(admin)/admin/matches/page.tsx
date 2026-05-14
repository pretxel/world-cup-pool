import { createServerSupabaseClient } from "@/lib/supabase/server";
import { LocalTime } from "@/components/local-time";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { stageLabel, statusLabel } from "@/lib/match-utils";
import { saveFixture, setMatchResult, forceRecompute, deleteMatch } from "./actions";

export const metadata = { title: "Admin · Matches" };

export default async function AdminMatchesPage() {
  const supabase = await createServerSupabaseClient();
  const { data: matches } = await supabase
    .from("matches")
    .select("*")
    .order("kickoff_at", { ascending: true });

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-3xl font-bold">Admin · Matches</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Create or edit fixtures and enter final scores. Saving a final score recomputes the
        leaderboard immediately.
      </p>

      <section className="mt-8 rounded-lg border p-4">
        <h2 className="mb-3 text-lg font-semibold">New fixture</h2>
        <form action={saveFixture} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="stage">Stage</Label>
            <select id="stage" name="stage" className="h-9 w-full rounded-md border px-3 text-sm">
              <option value="group">Group</option>
              <option value="r32">Round of 32</option>
              <option value="r16">Round of 16</option>
              <option value="qf">Quarter-final</option>
              <option value="sf">Semi-final</option>
              <option value="third">Third-place</option>
              <option value="final">Final</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="group_code">Group (A–L, optional)</Label>
            <Input id="group_code" name="group_code" maxLength={1} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="home_team">Home team</Label>
            <Input id="home_team" name="home_team" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="away_team">Away team</Label>
            <Input id="away_team" name="away_team" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="kickoff_at">Kickoff (UTC ISO)</Label>
            <Input
              id="kickoff_at"
              name="kickoff_at"
              type="datetime-local"
              required
              step="60"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="venue">Venue</Label>
            <Input id="venue" name="venue" />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit">Create fixture</Button>
          </div>
        </form>
      </section>

      <section className="mt-10 space-y-4">
        <h2 className="text-lg font-semibold">All fixtures ({matches?.length ?? 0})</h2>
        {(matches ?? []).map((m) => (
          <article key={m.id} className="rounded-lg border p-4">
            <header className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{stageLabel(m.stage)}{m.group_code ? ` · ${m.group_code}` : ""}</Badge>
              <Badge variant={m.status === "final" ? "default" : "secondary"}>
                {statusLabel(m.status)}
              </Badge>
              <span className="text-xs text-muted-foreground">
                <LocalTime iso={m.kickoff_at} />
              </span>
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
                  Result
                </div>
                <div className="mt-2 flex items-end gap-2">
                  <div className="flex-1">
                    <Label htmlFor={`hs-${m.id}`} className="text-xs">{m.home_team}</Label>
                    <Input
                      id={`hs-${m.id}`}
                      name="home_score"
                      type="number"
                      min={0}
                      max={30}
                      defaultValue={m.home_score ?? ""}
                    />
                  </div>
                  <span className="pb-2">–</span>
                  <div className="flex-1">
                    <Label htmlFor={`as-${m.id}`} className="text-xs">{m.away_team}</Label>
                    <Input
                      id={`as-${m.id}`}
                      name="away_score"
                      type="number"
                      min={0}
                      max={30}
                      defaultValue={m.away_score ?? ""}
                    />
                  </div>
                </div>
                <div className="mt-2 space-y-1.5">
                  <Label htmlFor={`st-${m.id}`} className="text-xs">Status</Label>
                  <select
                    id={`st-${m.id}`}
                    name="status"
                    defaultValue={m.status}
                    className="h-9 w-full rounded-md border px-3 text-sm"
                  >
                    <option value="scheduled">scheduled</option>
                    <option value="live">live</option>
                    <option value="final">final</option>
                    <option value="cancelled">cancelled</option>
                  </select>
                </div>
                <div className="mt-3 flex gap-2">
                  <Button type="submit" size="sm">Save result</Button>
                </div>
              </form>

              <div className="space-y-3">
                <form action={forceRecompute} className="flex items-center gap-2">
                  <input type="hidden" name="match_id" value={m.id} />
                  <Button type="submit" size="sm" variant="outline">
                    Force recompute scores
                  </Button>
                </form>
                <form action={deleteMatch} className="flex items-center gap-2">
                  <input type="hidden" name="id" value={m.id} />
                  <Button type="submit" size="sm" variant="destructive">
                    Delete fixture
                  </Button>
                </form>
              </div>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
