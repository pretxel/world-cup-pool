"use client";

import { useState, useTransition } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2Icon, MailIcon, CheckCircle2Icon } from "lucide-react";

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

  if (sent) {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-pitch/30 bg-pitch/5 p-4 text-sm dark:bg-pitch/10">
        <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-pitch" />
        <div>
          <p className="font-medium">Check your inbox.</p>
          <p className="mt-1 text-muted-foreground">
            We sent a sign-in link to{" "}
            <span className="font-mono text-foreground">{email}</span>. It works
            once and expires soon.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleMagicLink} className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="email" className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Email
          </Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="h-11 text-base"
          />
        </div>
        <Button
          type="submit"
          disabled={isPending}
          className="h-11 w-full gap-2 text-sm font-semibold uppercase tracking-[0.14em]"
        >
          {isPending ? (
            <>
              <Loader2Icon className="size-4 animate-spin" /> Sending
            </>
          ) : (
            <>
              <MailIcon className="size-4" /> Send magic link
            </>
          )}
        </Button>
      </form>
    </div>
  );
}
