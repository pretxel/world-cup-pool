import { getActiveCompetition } from "@/lib/competition";
import { getManagedCompetition } from "@/lib/admin/managed-competition";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { setManagedCompetition } from "@/app/[locale]/(admin)/admin/competitions/actions";
import { Button } from "@/components/ui/button";

// Persistent indicator of the active (public) vs managed (editing) competition.
// Calm when they coincide; an alert when they diverge so an admin never
// confuses editing a draft with changing the live site.
export async function ManagedContextBar() {
  const [active, managed] = await Promise.all([
    getActiveCompetition(),
    getManagedCompetition(),
  ]);
  const diverged = !!(managed && active && managed.id !== active.id);

  const admin = createAdminSupabaseClient();
  const { data: comps } = await admin
    .from("competitions")
    .select("id, name")
    .order("season", { ascending: false });

  return (
    <div className="border-b border-border">
      {diverged ? (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-3 bg-amber-500/10 px-4 py-2 text-sm text-amber-700 dark:text-amber-400"
        >
          <span>
            Editing <strong>{managed!.name}</strong> — visitors still see{" "}
            <strong>{active!.name}</strong>.
          </span>
          <form action={setManagedCompetition}>
            <input type="hidden" name="id" value={active!.id} />
            <Button type="submit" size="sm" variant="outline">
              Switch to live
            </Button>
          </form>
        </div>
      ) : (
        <div
          role="status"
          className="bg-muted/40 px-4 py-2 text-sm text-muted-foreground"
        >
          Managing the live competition:{" "}
          <strong className="text-foreground">{managed?.name ?? "none"}</strong>
        </div>
      )}

      <form
        action={setManagedCompetition}
        className="flex items-center gap-2 px-4 py-2"
      >
        <label className="text-xs text-muted-foreground" htmlFor="managed-switch">
          Manage
        </label>
        <select
          id="managed-switch"
          name="id"
          defaultValue={managed?.id}
          className="h-8 rounded-md border px-2 text-sm"
        >
          {(comps ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <Button type="submit" size="sm" variant="ghost">
          Switch
        </Button>
      </form>
    </div>
  );
}
