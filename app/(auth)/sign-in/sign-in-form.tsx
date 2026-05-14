"use client";

import { useState, useTransition } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export function SignInForm({ next }: { next?: string }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [isPending, startTransition] = useTransition();

  const redirectTo = `${typeof window !== "undefined" ? window.location.origin : ""}/auth/callback${
    next ? `?next=${encodeURIComponent(next)}` : ""
  }`;

  function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    if (!email.includes("@")) {
      toast.error("Enter a valid email address");
      return;
    }
    startTransition(async () => {
      const supabase = createBrowserSupabaseClient();
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectTo },
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      setSent(true);
    });
  }

  function handleGoogle() {
    startTransition(async () => {
      const supabase = createBrowserSupabaseClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo },
      });
      if (error) toast.error(error.message);
    });
  }

  if (sent) {
    return (
      <div className="rounded-md border bg-muted/40 p-4 text-sm">
        Check your email. We sent a sign-in link to <strong>{email}</strong>.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleMagicLink} className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </div>
        <Button type="submit" disabled={isPending} className="w-full">
          {isPending ? "Sending…" : "Send magic link"}
        </Button>
      </form>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <div className="h-px flex-1 bg-border" />
        or
        <div className="h-px flex-1 bg-border" />
      </div>

      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={handleGoogle}
        disabled={isPending}
      >
        Continue with Google
      </Button>
    </div>
  );
}
