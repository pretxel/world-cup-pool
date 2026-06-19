"use client";

import * as React from "react";
import { ShareButtons } from "@/components/share-buttons";
import { buildH2HPath } from "@/lib/share";
import { trackEvent } from "@/lib/analytics";
import type { Locale } from "@/lib/i18n";

type Opponent = { userId: string; name: string };

// Lets a signed-in viewer who appears on the leaderboard build a head-to-head
// link against any other listed player and share it. The canonical URL is built
// client-side from the share helper; ShareButtons emits `share_click` with the
// `h2h` context. Nothing here touches the leaderboard's realtime/segment logic.
export function LeaderboardChallenge({
  locale,
  meId,
  meName,
  siteUrl,
  opponents,
  labels,
}: {
  locale: Locale;
  meId: string;
  meName: string;
  siteUrl: string;
  opponents: Opponent[];
  labels: {
    heading: string;
    body: string;
    pick: string;
    // ICU-rendered template with literal "{a}" / "{b}" placeholders so the
    // chosen opponent's name can be substituted client-side.
    shareTextTemplate: string;
    x: string;
    facebook: string;
    native: string;
    copy: string;
    copied: string;
  };
}) {
  const [selected, setSelected] = React.useState("");

  if (opponents.length === 0) return null;

  const opponent = opponents.find((o) => o.userId === selected);
  const shareUrl = opponent ? `${siteUrl}${buildH2HPath(locale, meId, opponent.userId)}` : "";
  const shareText = opponent
    ? labels.shareTextTemplate.replaceAll("{a}", meName).replaceAll("{b}", opponent.name)
    : "";

  return (
    <section className="border-border bg-card mt-6 rounded-xl border border-dashed p-5">
      <p className="font-medium">{labels.heading}</p>
      <p className="text-muted-foreground mt-1 text-sm">{labels.body}</p>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <select
          aria-label={labels.pick}
          value={selected}
          onChange={(e) => {
            const next = e.target.value;
            setSelected(next);
            if (next) trackEvent("h2h_challenge_created", { context: "h2h" });
          }}
          className="border-border bg-background font-heading text-foreground focus-visible:ring-ring h-9 rounded-md border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none"
        >
          <option value="">{labels.pick}</option>
          {opponents.map((o) => (
            <option key={o.userId} value={o.userId}>
              {o.name}
            </option>
          ))}
        </select>

        {opponent ? (
          <ShareButtons
            context="h2h"
            shareUrl={shareUrl}
            shareText={shareText}
            labels={{
              x: labels.x,
              facebook: labels.facebook,
              native: labels.native,
              copy: labels.copy,
              copied: labels.copied,
            }}
          />
        ) : null}
      </div>
    </section>
  );
}
