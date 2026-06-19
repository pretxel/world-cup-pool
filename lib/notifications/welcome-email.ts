import "server-only";
import { Resend } from "resend";
import { getTranslations } from "next-intl/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { DEFAULT_LOCALE, localePath } from "@/lib/i18n";
import { isSendableEmail } from "./result-emails";
import { renderWelcomeEmail, type WelcomeEmailStrings } from "./welcome-email-template";

type AdminClient = ReturnType<typeof createAdminSupabaseClient>;

// Minimal translator shape so this stays decoupled from next-intl internals.
type Translator = (key: string, values?: Record<string, unknown>) => string;

// Builds the resolved, value-bearing copy for the welcome email. The heading is
// interpolated with the display name; the renderer falls back to `headingNoName`
// when no name is available.
export function buildWelcomeEmailStrings(
  t: Translator,
  opts: { displayName: string | null },
): WelcomeEmailStrings {
  return {
    subject: t("subject"),
    preheader: t("preheader"),
    eyebrow: t("eyebrow"),
    heading: opts.displayName ? t("heading", { name: opts.displayName }) : t("headingNoName"),
    headingNoName: t("headingNoName"),
    intro: t("intro"),
    quizTitle: t("quizTitle"),
    quizBlurb: t("quizBlurb"),
    quizCta: t("quizCta"),
    groupsTitle: t("groupsTitle"),
    groupsBlurb: t("groupsBlurb"),
    groupsCta: t("groupsCta"),
    leaderboardTitle: t("leaderboardTitle"),
    leaderboardBlurb: t("leaderboardBlurb"),
    leaderboardCta: t("leaderboardCta"),
    footer: t("footer"),
  };
}

// Player emails live only in auth.users — reachable via the service-role admin
// client. Returns null (→ skip) on any error or missing address.
async function resolveEmail(admin: AdminClient, userId: string): Promise<string | null> {
  try {
    const { data, error } = await admin.auth.admin.getUserById(userId);
    if (error) {
      console.error(`[welcome-email] getUserById ${userId} failed:`, error.message);
      return null;
    }
    return data.user?.email ?? null;
  } catch (err) {
    console.error(`[welcome-email] getUserById ${userId} threw:`, err);
    return null;
  }
}

// Sends a single one-time welcome email orienting a new user to the daily quiz,
// friend groups, and the leaderboard, right after they set their display name
// during onboarding. Best-effort and idempotent:
//   - No-ops (logs + returns) when RESEND_API_KEY is unset.
//   - Reads the one-time guard (`profiles.welcome_email_sent_at`) and returns
//     early when it is already set — so a name edit or onboarding re-run never
//     re-sends.
//   - Skips recipients with no resolvable / deliverable address.
//   - Stamps the guard only after the provider accepts the message, so a failed
//     send leaves it null and the email can go out on a later onboarding action.
//   - Catches and logs every error; NEVER throws to the caller, so the
//     onboarding redirect is never broken or delayed by email problems.
export async function sendWelcomeEmail(userId: string): Promise<void> {
  try {
    if (!env.resendApiKey) {
      console.log("[welcome-email] RESEND_API_KEY unset — skipping send");
      return;
    }

    const admin = createAdminSupabaseClient();

    // One-time guard: a non-null stamp means the email already went out.
    const { data: profile, error: profileErr } = await admin
      .from("profiles")
      .select("display_name, welcome_email_sent_at")
      .eq("id", userId)
      .maybeSingle();
    if (profileErr) {
      console.error(`[welcome-email] load profile ${userId} failed:`, profileErr.message);
      return;
    }
    if (!profile) {
      console.error(`[welcome-email] no profile for ${userId} — skipping`);
      return;
    }
    if (profile.welcome_email_sent_at) {
      // Already sent — idempotent no-op (re-run onboarding / name edit).
      return;
    }

    const email = await resolveEmail(admin, userId);
    if (!email || !isSendableEmail(email)) {
      console.log(`[welcome-email] ${userId} has no deliverable address — skipping`);
      return;
    }

    const t = (await getTranslations({
      locale: DEFAULT_LOCALE,
      namespace: "welcomeEmail",
    })) as Translator;

    const displayName = (profile.display_name as string | null) ?? null;
    const { subject, html, text } = renderWelcomeEmail({
      displayName,
      quizUrl: `${env.siteUrl}${localePath(DEFAULT_LOCALE, "/quiz")}`,
      groupsUrl: `${env.siteUrl}${localePath(DEFAULT_LOCALE, "/groups")}`,
      leaderboardUrl: `${env.siteUrl}${localePath(DEFAULT_LOCALE, "/leaderboard")}`,
      strings: buildWelcomeEmailStrings(t, { displayName }),
    });

    const resend = new Resend(env.resendApiKey);
    const { error: sendErr } = await resend.emails.send({
      from: env.emailFrom,
      to: [email],
      subject,
      html,
      text,
    });
    if (sendErr) {
      // Leave the guard null so a later onboarding action can retry.
      console.error(`[welcome-email] send to ${userId} failed:`, sendErr.message);
      return;
    }

    // Stamp the guard only after the provider accepted the message. Re-check the
    // column is still null to narrow (not eliminate) a concurrent-submit double
    // send — a single extra welcome email is an acceptable blast radius.
    const { error: stampErr } = await admin
      .from("profiles")
      .update({ welcome_email_sent_at: new Date().toISOString() })
      .eq("id", userId)
      .is("welcome_email_sent_at", null);
    if (stampErr) {
      // The email went out; failing to stamp risks a duplicate on a later
      // onboarding action, but never a lost send. Surface it loudly.
      console.error(`[welcome-email] stamp ${userId} failed:`, stampErr.message);
    }
  } catch (err) {
    // Best-effort: never let an email problem break onboarding.
    console.error(`[welcome-email] unexpected error for ${userId}:`, err);
  }
}
