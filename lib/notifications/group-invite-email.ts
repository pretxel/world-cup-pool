import "server-only";
import { Resend } from "resend";
import { getTranslations } from "next-intl/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { localePath, type Locale } from "@/lib/i18n";
import {
  renderGroupInviteEmail,
  type GroupInviteEmailStrings,
} from "./group-invite-template";

// Minimal translator shape so this stays decoupled from next-intl internals.
type Translator = (key: string, values?: Record<string, unknown>) => string;

// Counts of what happened to the recipient list. `skipped` covers addresses the
// caller never tried to send (none here — the action pre-filters), kept for
// symmetry with the other dispatchers and so callers always get a stable shape.
export interface GroupInviteSendResult {
  sent: number;
  failed: number;
  skipped: number;
}

// Builds the resolved, value-bearing copy for the invite email. Subject,
// heading, and intro are interpolated with the inviter and group names.
export function buildGroupInviteEmailStrings(
  t: Translator,
  opts: { inviterName: string; groupName: string },
): GroupInviteEmailStrings {
  return {
    subject: t("subject", { inviter: opts.inviterName, group: opts.groupName }),
    preheader: t("preheader", { group: opts.groupName }),
    eyebrow: t("eyebrow"),
    heading: t("heading", { group: opts.groupName }),
    intro: t("intro", { inviter: opts.inviterName, group: opts.groupName }),
    joinCta: t("joinCta"),
    footer: t("footer"),
  };
}

// Sends a group join-link invite to each (already validated + de-duplicated)
// recipient address. Best-effort and consistent with the other dispatchers:
//   - No-ops (logs + returns) when RESEND_API_KEY is unset; writes no ledger.
//   - Renders localized copy at the inviter's request locale and builds the
//     join URL with that same locale so the recipient lands sensibly.
//   - On each accepted send, records a `group_invite_log` row via the admin
//     client (so rate-limit counts reflect real sends).
//   - Catches and counts per-recipient failures without throwing, so one bad
//     address never aborts the rest or breaks the action.
export async function sendGroupInviteEmails(opts: {
  groupId: string;
  groupName: string;
  inviterId: string;
  inviterName: string;
  joinCode: string;
  locale: Locale;
  recipients: string[];
}): Promise<GroupInviteSendResult> {
  const { groupId, groupName, inviterId, inviterName, joinCode, locale, recipients } =
    opts;

  if (!env.resendApiKey) {
    console.log("[group-invite-email] RESEND_API_KEY unset — skipping send");
    return { sent: 0, failed: 0, skipped: recipients.length };
  }

  if (recipients.length === 0) {
    return { sent: 0, failed: 0, skipped: 0 };
  }

  const admin = createAdminSupabaseClient();

  const t = (await getTranslations({
    locale,
    namespace: "groupInvite",
  })) as Translator;

  const joinUrl = `${env.siteUrl}${localePath(locale, `/groups/join/${joinCode}`)}`;
  const { subject, html, text } = renderGroupInviteEmail({
    inviterName,
    groupName,
    joinUrl,
    strings: buildGroupInviteEmailStrings(t, { inviterName, groupName }),
  });

  const resend = new Resend(env.resendApiKey);

  let sent = 0;
  let failed = 0;

  for (const recipient of recipients) {
    try {
      const { error } = await resend.emails.send({
        from: env.emailFrom,
        replyTo: env.emailReplyTo,
        to: [recipient],
        subject,
        html,
        text,
      });
      if (error) {
        failed++;
        console.error(
          `[group-invite-email] send to ${recipient} failed:`,
          error.message,
        );
        continue;
      }

      // Record the accepted send for rate limiting / abuse audit. A failed log
      // write does not undo the send — surface it loudly rather than retrying.
      const { error: logErr } = await admin.from("group_invite_log").insert({
        group_id: groupId,
        inviter_id: inviterId,
        recipient_email: recipient,
      });
      if (logErr) {
        console.error("[group-invite-email] ledger write failed:", logErr.message);
      }
      sent++;
    } catch (err) {
      failed++;
      console.error(`[group-invite-email] send to ${recipient} threw:`, err);
    }
  }

  console.log(`[group-invite-email] sent=${sent} failed=${failed}`);
  return { sent, failed, skipped: 0 };
}
