"use client";

import * as React from "react";
import { toast } from "sonner";
import { CheckIcon, LinkIcon, Share2Icon } from "lucide-react";
import { buildFacebookShareUrl, buildTweetIntentUrl } from "@/lib/share";
import { cn } from "@/lib/utils";

// Generic social share actions for any pre-built share URL + text. All data
// arrives via props; the component only decides which affordances the browser
// supports. The native share sheet is the Instagram path on mobile — IG has no
// web share URL. Used by pick sharing and leaderboard-rank sharing alike.
export function ShareButtons({
  shareUrl,
  shareText,
  labels,
}: {
  shareUrl: string;
  shareText: string;
  labels: {
    x: string;
    facebook: string;
    native: string;
    copy: string;
    copied: string;
  };
}) {
  // navigator.share is feature-detected after mount so server and first
  // client render agree (no hydration mismatch).
  const [canNativeShare, setCanNativeShare] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCanNativeShare(true);
    }
  }, []);

  async function onNativeShare() {
    try {
      await navigator.share({ text: shareText, url: shareUrl });
    } catch {
      // User dismissed the sheet — not an error worth surfacing.
    }
  }

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success(labels.copied);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(labels.copy);
    }
  }

  const chipClass =
    "inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 font-heading text-xs font-medium tracking-tight text-foreground transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <a
        href={buildTweetIntentUrl(shareText, shareUrl)}
        target="_blank"
        rel="noopener noreferrer"
        className={chipClass}
      >
        <XLogo className="size-3.5" />
        {labels.x}
      </a>
      <a
        href={buildFacebookShareUrl(shareUrl)}
        target="_blank"
        rel="noopener noreferrer"
        className={chipClass}
      >
        <FacebookLogo className="size-3.5" />
        {labels.facebook}
      </a>
      {canNativeShare ? (
        <button type="button" onClick={onNativeShare} className={chipClass}>
          <Share2Icon className="size-3.5" aria-hidden />
          {labels.native}
        </button>
      ) : null}
      <button type="button" onClick={onCopy} className={chipClass}>
        {copied ? (
          <CheckIcon className={cn("size-3.5", "text-pitch")} aria-hidden />
        ) : (
          <LinkIcon className="size-3.5" aria-hidden />
        )}
        {labels.copy}
      </button>
    </div>
  );
}

function XLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function FacebookLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047v-2.66c0-3.025 1.792-4.697 4.533-4.697 1.313 0 2.686.236 2.686.236v2.971H15.83c-1.491 0-1.956.93-1.956 1.886v2.264h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073" />
    </svg>
  );
}
