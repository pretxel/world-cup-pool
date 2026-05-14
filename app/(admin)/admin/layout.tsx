import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?next=/admin/matches");

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) {
    return (
      <main className="mx-auto max-w-md px-6 py-20 text-center">
        <h1 className="text-2xl font-bold">403 — Admin only</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This page is restricted. If you should have access, ask the pool owner to mark you as admin.
        </p>
        <Link href="/" className="mt-6 inline-block text-sm underline">
          Go home
        </Link>
      </main>
    );
  }

  return <>{children}</>;
}
