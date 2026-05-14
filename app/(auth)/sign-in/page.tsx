import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { SignInForm } from "./sign-in-form";

export const metadata = { title: "Sign in — World Cup 2026 Pool" };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    redirect(next ?? "/matches");
  }

  return (
    <main className="mx-auto flex min-h-[80vh] max-w-md flex-col justify-center px-6 py-12">
      <h1 className="mb-2 text-3xl font-bold">Sign in</h1>
      <p className="mb-8 text-sm text-muted-foreground">
        Use your email or Google account. We&apos;ll only use it to identify your picks.
      </p>
      <SignInForm next={next} />
      <p className="mt-8 text-center text-xs text-muted-foreground">
        New here? Just enter your email — we&apos;ll create your account on the fly.{" "}
        <Link href="/how-it-works" className="underline">
          How it works
        </Link>
      </p>
    </main>
  );
}
