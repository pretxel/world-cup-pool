import "server-only";
import { NextResponse } from "next/server";
import { Webhook } from "standardwebhooks";
import { Resend } from "resend";
import { getTranslations } from "next-intl/server";
import { env } from "@/lib/env";
import { DEFAULT_LOCALE, isLocale, type Locale } from "@/lib/i18n";
import { getActiveBranding } from "@/lib/competition";
import {
  buildMagicLinkEmailStrings,
  isLinkAction,
  renderMagicLinkEmail,
} from "@/lib/notifications/magic-link-email-template";

// Supabase Auth "Send Email Hook": GoTrue POSTs here instead of sending auth
// emails itself, so we render a branded template and deliver via Resend. The
// client still calls signInWithOtp, and the link still completes through
// /auth/callback — only the delivery path changes.
//
// Once enabled the hook receives EVERY auth email type, so this handler must
// never crash or block GoTrue on an unexpected payload.

// Sending resolves branding + renders + calls Resend; give it headroom.
export const maxDuration = 30;

// Shape of the GoTrue Send Email Hook payload (only the fields we use).
interface HookPayload {
  user: { email?: string | null };
  email_data: {
    token_hash: string;
    redirect_to: string;
    email_action_type: string;
    site_url: string;
  };
}

// Mirror of result-emails' withFromName: swap the display-name portion of a
// "Name <addr>" sender while keeping the verified-domain address from env.
function withFromName(emailFrom: string, name?: string): string {
  if (!name) return emailFrom;
  const m = emailFrom.match(/<([^>]+)>/);
  return m ? `${name} <${m[1]}>` : emailFrom;
}

// Locale hint from the redirect target's first path segment (the app routes are
// /[locale]/...). Falls back to the default locale.
function localeFromRedirect(redirectTo: string): Locale {
  try {
    const seg = new URL(redirectTo).pathname.split("/").filter(Boolean)[0];
    return seg && isLocale(seg) ? seg : DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

// GoTrue treats any 2xx as success. Body is ignored on success.
function ok(): NextResponse {
  return NextResponse.json({});
}

export async function POST(request: Request): Promise<NextResponse> {
  // Read the RAW body — signature verification is over the exact bytes, so we
  // must not re-serialize via request.json().
  const raw = await request.text();

  // Env-gate: with no Resend key there's nothing to send. Return success so a
  // cold/dev env doesn't wedge auth (mirrors the result-email dispatch no-op).
  if (!env.resendApiKey) {
    console.log("[send-email-hook] RESEND_API_KEY unset — skipping send");
    return ok();
  }

  // Verify authenticity. Missing secret or a bad signature → 401, no send.
  if (!env.sendEmailHookSecret) {
    console.error("[send-email-hook] SEND_EMAIL_HOOK_SECRET unset — rejecting");
    return new NextResponse("hook secret not configured", { status: 401 });
  }

  let payload: HookPayload;
  try {
    const wh = new Webhook(env.sendEmailHookSecret.replace("v1,whsec_", ""));
    payload = wh.verify(raw, Object.fromEntries(request.headers)) as HookPayload;
  } catch (err) {
    console.error("[send-email-hook] signature verification failed:", err);
    return new NextResponse("invalid signature", { status: 401 });
  }

  const { user, email_data } = payload;
  const action = email_data.email_action_type;

  // Notification-only / unknown types carry no action link — nothing to send,
  // but don't block GoTrue.
  if (!isLinkAction(action)) {
    console.log(`[send-email-hook] no-op for action type: ${action}`);
    return ok();
  }

  const to = user?.email;
  if (!to) {
    console.error("[send-email-hook] payload missing recipient email");
    return ok();
  }

  // Build the verification link from the PUBLIC Supabase/auth URL (not site_url,
  // which is the frontend origin). Hitting /auth/v1/verify lets GoTrue complete
  // verification and redirect to redirect_to (…/auth/callback), reusing the
  // existing exchangeCodeForSession handler.
  const verifyUrl = new URL(`${env.supabaseUrl}/auth/v1/verify`);
  verifyUrl.searchParams.set("token", email_data.token_hash);
  verifyUrl.searchParams.set("type", action);
  verifyUrl.searchParams.set("redirect_to", email_data.redirect_to);
  const actionUrl = verifyUrl.toString();

  const locale = localeFromRedirect(email_data.redirect_to);
  const t = (await getTranslations({ locale, namespace: "email.magicLink" })) as (
    key: string,
    values?: Record<string, unknown>,
  ) => string;
  const strings = buildMagicLinkEmailStrings(t, action);
  const { subject, html, text } = renderMagicLinkEmail({ actionUrl, strings });

  const { emailFromName } = await getActiveBranding();
  const from = withFromName(env.emailFrom, emailFromName);

  try {
    const resend = new Resend(env.resendApiKey);
    const { error } = await resend.emails.send({ from, to, subject, html, text });
    if (error) throw new Error(error.message ?? "resend send error");
  } catch (err) {
    // Surface a 5xx so GoTrue reports "error sending email" and the user can
    // retry, rather than silently swallowing a failed login email.
    console.error("[send-email-hook] send failed:", err);
    return new NextResponse("send failed", { status: 500 });
  }

  console.log(`[send-email-hook] sent action=${action}`);
  return ok();
}
