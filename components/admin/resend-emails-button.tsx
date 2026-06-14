"use client";

import { SubmitButton } from "@/components/admin/submit-button";
import { resendResultEmails } from "@/app/[locale]/(admin)/admin/matches/actions";

// Force-resend of result emails for one final match. Re-sends to players who
// were already emailed, so it is confirm-gated and disabled while submitting via
// the shared SubmitButton. Copy is resolved server-side and passed in so i18n
// stays on the server.
export function ResendResultEmailsButton({
  matchId,
  locale,
  label,
  confirmText,
}: {
  matchId: string;
  locale: string;
  label: string;
  confirmText: string;
}) {
  return (
    <form action={resendResultEmails} className="flex items-center gap-2">
      <input type="hidden" name="match_id" value={matchId} />
      <input type="hidden" name="locale" value={locale} />
      <SubmitButton size="sm" variant="outline" confirmText={confirmText}>
        {label}
      </SubmitButton>
    </form>
  );
}
