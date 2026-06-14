"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { resendResultEmails } from "@/app/[locale]/(admin)/admin/matches/actions";

// Force-resend of result emails for one final match. Re-sends to players who
// were already emailed, so it is confirm-gated and disabled while submitting.
// Copy is resolved server-side and passed in so i18n stays on the server.
function SubmitButton({ label, confirmText }: { label: string; confirmText: string }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={(e) => {
        if (!window.confirm(confirmText)) e.preventDefault();
      }}
    >
      {label}
    </Button>
  );
}

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
      <SubmitButton label={label} confirmText={confirmText} />
    </form>
  );
}
