import { getTranslations } from "next-intl/server";
import { TriangleAlertIcon } from "lucide-react";
import { getActiveCompetition } from "@/lib/competition";
import { getManagedCompetition } from "@/lib/admin/managed-competition";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { setManagedCompetition } from "@/app/[locale]/(admin)/admin/competitions/actions";
import { NativeSelect } from "@/components/ui/native-select";
import { SubmitButton } from "@/components/admin/submit-button";

// Persistent indicator of the active (public) vs managed (editing) competition.
// Calm when they coincide; a prominent gold caution bar when they diverge so an
// admin never confuses editing a draft with changing the live site. The
// managed-context switcher lives here too, so it is reachable from every screen.
export async function ManagedContextBar() {
  const t = await getTranslations("admin");
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
        <div role="alert" className="bg-accent text-accent-foreground">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-2.5 text-sm">
            <span className="flex items-center gap-1.5 font-semibold">
              <TriangleAlertIcon className="size-4" aria-hidden />
              {t("context.divergedTitle")}
            </span>
            <span>
              {t("context.managing")}:{" "}
              <strong className="font-semibold">{managed!.name}</strong>
            </span>
            <span aria-hidden className="opacity-50">
              ·
            </span>
            <span>
              {t("context.live")}:{" "}
              <strong className="font-semibold">{active!.name}</strong>
            </span>
            <form action={setManagedCompetition} className="ml-auto">
              <input type="hidden" name="id" value={active!.id} />
              <SubmitButton size="sm" variant="outline">
                {t("context.switchToLive")}
              </SubmitButton>
            </form>
          </div>
        </div>
      ) : (
        <div role="status" className="bg-muted/40">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-2 px-4 py-2 text-sm text-muted-foreground">
            {t("context.inSync")}:{" "}
            <strong className="font-medium text-foreground">
              {managed?.name ?? t("context.none")}
            </strong>
          </div>
        </div>
      )}

      <div className="border-t border-border bg-card/40">
        <form
          action={setManagedCompetition}
          className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-2"
        >
          <label
            htmlFor="managed-switch"
            className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground"
          >
            {t("context.manageLabel")}
          </label>
          <NativeSelect
            id="managed-switch"
            name="id"
            defaultValue={managed?.id}
            aria-label={t("context.switcherLabel")}
            className="max-w-xs"
          >
            {(comps ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </NativeSelect>
          <SubmitButton size="sm" variant="ghost">
            {t("context.switch")}
          </SubmitButton>
        </form>
      </div>
    </div>
  );
}
