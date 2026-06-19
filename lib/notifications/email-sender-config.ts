import { env } from "@/lib/env";

// Resend's sandbox sender. It is the dev-only default for `env.emailFrom`
// (see lib/env.ts) and the one address that hurts deliverability / brand trust
// when it leaks into production. Centralized here so the "is this the sandbox
// sender?" rule lives in exactly one place.
export const RESEND_SANDBOX_ADDRESS = "onboarding@resend.dev";

export interface EmailSenderConfigCheck {
  // The resolved `emailFrom` still points at the Resend sandbox address — matched
  // on the address inside `<...>` (or the bare value) so a custom display name
  // can't mask it.
  isSandboxSender: boolean;
  // `RESEND_API_KEY` is unset, so the dispatchers no-op instead of sending.
  missingApiKey: boolean;
  // The runtime is production (`NODE_ENV === "production"`).
  isProduction: boolean;
  // True only in production when the sender is misconfigured in either way —
  // the single signal the dispatchers gate their warning on.
  shouldWarn: boolean;
  // A single-line, operator-readable description of the misconfiguration, or
  // null when there is nothing to warn about.
  message: string | null;
}

// Extracts the address from a `Name <addr>` sender, or returns the trimmed value
// unchanged when there is no angle-bracket form.
function senderAddress(emailFrom: string): string {
  const m = emailFrom.match(/<([^>]+)>/);
  return (m ? m[1] : emailFrom).trim().toLowerCase();
}

// Pure guard: inspects the resolved email configuration and reports whether the
// production email sender is misconfigured. Never throws, never mutates env, and
// never changes the resolved sender — detection only. `shouldWarn` is true only
// in production; outside production the result reports the facts but leaves
// non-prod behavior unflagged.
export function checkEmailSenderConfig(
  config: { emailFrom: string; resendApiKey: string | null } = env,
  nodeEnv: string | undefined = process.env.NODE_ENV,
): EmailSenderConfigCheck {
  const isSandboxSender = senderAddress(config.emailFrom) === RESEND_SANDBOX_ADDRESS;
  const missingApiKey = !config.resendApiKey;
  const isProduction = nodeEnv === "production";
  const shouldWarn = isProduction && (isSandboxSender || missingApiKey);

  let message: string | null = null;
  if (shouldWarn) {
    const problems: string[] = [];
    if (missingApiKey) problems.push("RESEND_API_KEY is unset");
    if (isSandboxSender) {
      problems.push(`EMAIL_FROM still uses the Resend sandbox sender (${RESEND_SANDBOX_ADDRESS})`);
    }
    message =
      `Production email sender is misconfigured: ${problems.join("; ")}. ` +
      "Set RESEND_API_KEY and EMAIL_FROM to a Resend verified-domain sender.";
  }

  return { isSandboxSender, missingApiKey, isProduction, shouldWarn, message };
}
