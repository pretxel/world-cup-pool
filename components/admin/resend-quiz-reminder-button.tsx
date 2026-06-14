"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { resendQuizReminder } from "@/app/[locale]/(admin)/admin/quiz/actions";

// Force-resend of today's quiz reminder. Re-emails opted-in, still-unanswered
// players even if the cron already reminded them, so it is confirm-gated and
// disabled while submitting. Copy is resolved server-side and passed in so i18n
// stays on the server.
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
      <SubmitButton label={label} confirmText={confirmText} />
    </form>
  );
}
