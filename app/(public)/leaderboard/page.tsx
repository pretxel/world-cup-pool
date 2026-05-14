import Link from "next/link";
import { cookies } from "next/headers";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { TimezoneCookie } from "./timezone-cookie";
import type { LeaderboardRow } from "@/lib/db";

export const metadata = { title: "Leaderboard — World Cup 2026 Pool" };

type Scope = "today" | "overall";

function todayInTz(tz: string): string {
  // Resolve the current calendar date in the given IANA timezone, formatted as
  // YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: Scope; date?: string }>;
}) {
  const { scope: scopeParam, date: dateParam } = await searchParams;
  const scope: Scope = scopeParam === "overall" ? "overall" : "today";

  const cookieStore = await cookies();
  const tz = cookieStore.get("tz")?.value || "UTC";
  const day = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : todayInTz(tz);

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let rows: LeaderboardRow[] = [];
  let loadError: string | null = null;

  if (scope === "overall") {
    const { data, error } = await supabase
      .from("v_leaderboard_overall")
      .select("*")
      .order("rank", { ascending: true });
    if (error) loadError = error.message;
    rows = (data ?? []) as LeaderboardRow[];
  } else {
    const { data, error } = await supabase.rpc("leaderboard_for_day", { d: day, tz });
    if (error) loadError = error.message;
    rows = (data ?? []) as LeaderboardRow[];
  }

  const myRow = user ? rows.find((r) => r.user_id === user.id) : undefined;

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <TimezoneCookie />
      <header className="mb-6">
        <h1 className="text-3xl font-bold">Leaderboard</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Standings update automatically when an admin enters a final score.
        </p>
      </header>

      <div className="mb-6 flex items-center gap-2 border-b">
        <ScopeLink scope="today" current={scope} label="Today" date={day} />
        <ScopeLink scope="overall" current={scope} label="Overall" />
      </div>

      {scope === "today" ? (
        <form method="get" className="mb-6 flex items-center gap-2">
          <input type="hidden" name="scope" value="today" />
          <label htmlFor="date" className="text-xs text-muted-foreground">
            Day:
          </label>
          <input
            id="date"
            name="date"
            type="date"
            defaultValue={day}
            className="h-9 rounded-md border px-3 text-sm"
          />
          <button type="submit" className="h-9 rounded-md border bg-muted px-3 text-sm">
            Go
          </button>
        </form>
      ) : null}

      {loadError ? (
        <p className="rounded-md border bg-destructive/10 p-3 text-sm text-destructive">
          {loadError}
        </p>
      ) : rows.length === 0 ? (
        <p className="rounded-md border bg-muted/40 p-6 text-sm">
          {scope === "today"
            ? "No completed matches on this day."
            : "No completed matches yet. Check back after the first results are in."}
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>Player</TableHead>
              <TableHead className="text-right">Points</TableHead>
              <TableHead className="text-right">Exact</TableHead>
              <TableHead className="text-right">Winner+GD</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => {
              const isMe = user?.id === r.user_id;
              return (
                <TableRow key={r.user_id} className={isMe ? "bg-primary/5 font-medium" : undefined}>
                  <TableCell className="font-mono">{r.rank}</TableCell>
                  <TableCell>
                    {r.display_name ?? "(no name)"}
                    {isMe ? <Badge variant="outline" className="ml-2 text-[10px]">you</Badge> : null}
                  </TableCell>
                  <TableCell className="text-right font-mono">{r.total_points}</TableCell>
                  <TableCell className="text-right font-mono">{r.exact_hits}</TableCell>
                  <TableCell className="text-right font-mono">{r.winner_gd_hits}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      {user && !myRow ? (
        <p className="mt-6 rounded-md border bg-muted/40 p-4 text-sm">
          You&apos;re <strong>not yet ranked</strong> in this scope.{" "}
          {scope === "today"
            ? "Submit a prediction for one of today's matches."
            : "Submit predictions on upcoming matches."}{" "}
          <Link href="/matches" className="underline">
            Browse matches
          </Link>
        </p>
      ) : null}
    </main>
  );
}

function ScopeLink({
  scope,
  current,
  label,
  date,
}: {
  scope: Scope;
  current: Scope;
  label: string;
  date?: string;
}) {
  const active = scope === current;
  const href = scope === "today" ? `/leaderboard?scope=today${date ? `&date=${date}` : ""}` : `/leaderboard?scope=overall`;
  return (
    <Link
      href={href}
      className={
        "border-b-2 px-3 py-2 text-sm " +
        (active
          ? "border-foreground font-medium"
          : "border-transparent text-muted-foreground hover:text-foreground")
      }
    >
      {label}
    </Link>
  );
}
