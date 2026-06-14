"use client";

import { SubmitButton } from "@/components/admin/submit-button";
import { resendQuizReminder } from "@/app/[locale]/(admin)/admin/quiz/actions";

// Force-resend of today's quiz reminder. Re-emails opted-in, still-unanswered
// players even if the cron already reminded them, so it is confirm-gated and
// disabled while submitting via the shared SubmitButton. Copy is resolved
// server-side and passed in so i18n stays on the server.
export function ResendQuizReminderButton({
  locale,
  label,
  confirmText,
}: {
  locale: string;
  label: string;
  confirmText: string;
}) {
  return (
    <form action={resendQuizReminder}>
      <input type="hidden" name="locale" value={locale} />
      <SubmitButton size="sm" variant="outline" confirmText={confirmText}>
        {label}
      </SubmitButton>
    </form>
  );
}
