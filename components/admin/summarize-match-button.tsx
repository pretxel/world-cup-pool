"use client";

import { SubmitButton } from "@/components/admin/submit-button";
import { summarizeMatch } from "@/app/[locale]/(admin)/admin/matches/actions";

// On-demand AI recap trigger for one final match. Generation is idempotent and
// non-destructive (the generator skips when a recap already exists), so unlike
// the resend button this is not confirm-gated. Copy is resolved server-side and
// passed in so i18n stays on the server. Outcome feedback renders separately via
// <ActionStatus> from the action's query-param result.
export function SummarizeMatchButton({
  matchId,
  locale,
  label,
  pendingLabel,
}: {
  matchId: string;
  locale: string;
  label: string;
  pendingLabel: string;
}) {
  return (
    <form action={summarizeMatch} className="flex items-center gap-2">
      <input type="hidden" name="match_id" value={matchId} />
      <input type="hidden" name="locale" value={locale} />
      <SubmitButton size="sm" variant="outline" pendingLabel={pendingLabel}>
        {label}
      </SubmitButton>
    </form>
  );
}
