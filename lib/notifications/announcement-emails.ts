import "server-only";
import { Resend } from "resend";
import { getTranslations } from "next-intl/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { DEFAULT_LOCALE } from "@/lib/i18n";
import { isOptedIn } from "@/lib/email-prefs";
import { checkEmailSenderConfig } from "./email-sender-config";
import { isSendableEmail, type DispatchSummary } from "./result-emails";
import {
  renderAnnouncementEmail,
  type AnnouncementEmailStrings,
} from "./announcement-email-template";

// Resend caps a single batch.send call at 100 messages. Unlike the winners
// podium, this broadcast can span the whole player base, so the chunking here
// matters — a run larger than 100 fans out across several batches.
const RESEND_BATCH_LIMIT = 100;

// The announcement drives players to the new WinScore home. Kept as a module
// constant (not env.siteUrl) because the rebrand domain is the whole point of
// this email — it must always point at winscore.me regardless of the app's
// current deployment host.
const WINSCORE_URL = "https://winscore.me";

// A rebrand/product announcement is a "news" message, so it reuses the existing
// recap-digest opt-out rather than introducing a new preference category (see
// design.md). A player who has silenced recap digests also silences this.
const OPT_OUT_KEY = "recap_digest" as const;

// Run summary: `recipients` = eligible players considered, so the admin overview
// shows why emailed can be lower (opt-outs, missing addresses) without logs.
export interface AnnouncementDispatchSummary extends DispatchSummary {
  recipients: number;
}

const ZERO: AnnouncementDispatchSummary = {
  recipients: 0,
  emailed: 0,
  failed: 0,
  skipped: 0,
};

// One player as read from profiles, carrying their raw email-prefs jsonb.
export interface AnnouncementPlayerRow {
  user_id: string;
  email_prefs: unknown;
}

// Emits one clear warning when the production email sender is misconfigured and
// reports that the run summary should carry the flag. Pure detection: never
// throws, never changes the resolved sender.
function warnIfSenderMisconfigured(context: string): boolean {
  const check = checkEmailSenderConfig();
  if (check.shouldWarn) {
    console.warn(`[announcement-email] ${context}: ${check.message}`);
  }
  return check.shouldWarn;
}

// `From: Display Name <addr>` when a competition display name is provided.
function withFromName(emailFrom: string, fromName?: string): string {
  if (!fromName) return emailFrom;
  const m = emailFrom.match(/<([^>]+)>/);
  return `${fromName} <${m ? m[1] : emailFrom}>`;
}

// Pure: from all players, drop those already in the send-once ledger and those
// opted out of the reused announcement category. An absent/malformed preference
// reads as opted-in. Exported for unit testing.
export function computePendingRecipients(
  players: AnnouncementPlayerRow[],
  alreadySent: { user_id: string }[],
): AnnouncementPlayerRow[] {
  const sent = new Set(alreadySent.map((r) => r.user_id));
  return players.filter((p) => !sent.has(p.user_id) && isOptedIn(p.email_prefs, OPT_OUT_KEY));
}

// Minimal translator shape so this stays decoupled from next-intl internals.
type Translator = (key: string, values?: Record<string, unknown>) => string;

// Builds the resolved, localized copy. The feature list is assembled from the
// numbered feature keys — a broadcast is identical for every recipient, so this
// is built once per run.
export function buildAnnouncementEmailStrings(t: Translator): AnnouncementEmailStrings {
  return {
    subject: t("subject"),
    preheader: t("preheader"),
    eyebrow: t("eyebrow"),
    heading: t("heading"),
    intro: t("intro"),
    whatsNewLabel: t("whatsNewLabel"),
    features: [
      { title: t("feature1Title"), body: t("feature1Body") },
      { title: t("feature2Title"), body: t("feature2Body") },
      { title: t("feature3Title"), body: t("feature3Body") },
    ],
    ctaLabel: t("ctaLabel"),
    footer: t("footer"),
    madeWithLove: t("madeWithLove"),
  };
}

type AdminClient = ReturnType<typeof createAdminSupabaseClient>;

// Player emails live only in auth.users — reachable via the service-role admin
// client. Returns null (→ skip) on any error or missing address.
async function resolveEmail(admin: AdminClient, userId: string): Promise<string | null> {
  try {
    const { data, error } = await admin.auth.admin.getUserById(userId);
    if (error) {
      console.error(`[announcement-email] getUserById ${userId} failed:`, error.message);
      return null;
    }
    return data.user?.email ?? null;
  } catch (err) {
    console.error(`[announcement-email] getUserById ${userId} threw:`, err);
    return null;
  }
}

// Every player, with their email-prefs jsonb.
async function loadPlayers(admin: AdminClient): Promise<AnnouncementPlayerRow[]> {
  const { data, error } = await admin.from("profiles").select("id, email_prefs");
  if (error) throw new Error(`[announcement-email] load players: ${error.message}`);
  return (data ?? []).flatMap((p) =>
    p.id ? [{ user_id: p.id, email_prefs: p.email_prefs as unknown }] : [],
  );
}

// Dispatches the one-off WinScore rebrand + new-features announcement to every
// eligible player: identical rendered content for all, gated by the recap-digest
// opt-out, deduped by the announcement_email_log ledger for at-most-once
// delivery. No-ops when RESEND_API_KEY is unset or no player is pending. Ledger
// rows are written only after Resend accepts each batch, so a failed/partial run
// leaves the remainder pending for the next manual run. Fired manually from the
// admin operations overview — never from cron.
export async function dispatchAnnouncementEmail(
  fromName?: string,
): Promise<AnnouncementDispatchSummary> {
  const senderMisconfigured = warnIfSenderMisconfigured("dispatch");
  const withFlag = (s: AnnouncementDispatchSummary): AnnouncementDispatchSummary =>
    senderMisconfigured ? { ...s, senderMisconfigured } : s;

  if (!env.resendApiKey) {
    console.log("[announcement-email] RESEND_API_KEY unset — skipping dispatch");
    return withFlag({ ...ZERO });
  }

  const admin = createAdminSupabaseClient();

  const players = await loadPlayers(admin);
  if (players.length === 0) {
    console.log("[announcement-email] no players — nothing to send");
    return withFlag({ ...ZERO });
  }

  const { data: sentRows, error: sentErr } = await admin
    .from("announcement_email_log")
    .select("user_id");
  if (sentErr) throw new Error(`[announcement-email] load ledger: ${sentErr.message}`);

  const pending = computePendingRecipients(players, sentRows ?? []);
  let skipped = players.length - pending.length;
  if (pending.length === 0) {
    console.log("[announcement-email] no pending recipients");
    return withFlag({ ...ZERO, recipients: players.length, skipped });
  }

  const t = (await getTranslations({
    locale: DEFAULT_LOCALE,
    namespace: "announcementEmail",
  })) as Translator;

  // Identical for every recipient — render once.
  const { subject, html, text } = renderAnnouncementEmail({
    ctaUrl: WINSCORE_URL,
    strings: buildAnnouncementEmailStrings(t),
  });

  const fromAddress = withFromName(env.emailFrom, fromName);
  const resend = new Resend(env.resendApiKey);

  interface PreparedMessage {
    payload: {
      from: string;
      replyTo: typeof env.emailReplyTo;
      to: string[];
      subject: string;
      html: string;
      text: string;
    };
    row: { user_id: string };
  }
  const prepared: PreparedMessage[] = [];
  for (const p of pending) {
    const email = await resolveEmail(admin, p.user_id);
    if (!email || !isSendableEmail(email)) {
      skipped += 1;
      continue;
    }
    prepared.push({
      payload: {
        from: fromAddress,
        replyTo: env.emailReplyTo,
        to: [email],
        subject,
        html,
        text,
      },
      row: { user_id: p.user_id },
    });
  }

  let emailed = 0;
  let failed = 0;
  for (let i = 0; i < prepared.length; i += RESEND_BATCH_LIMIT) {
    const chunk = prepared.slice(i, i + RESEND_BATCH_LIMIT);
    try {
      const { error } = await resend.batch.send(chunk.map((c) => c.payload));
      if (error) throw new Error(error.message ?? "resend batch error");

      const rows = chunk.map((c) => c.row);
      const { error: insErr } = await admin
        .from("announcement_email_log")
        .upsert(rows, { onConflict: "user_id", ignoreDuplicates: true });
      if (insErr) {
        // The email went out; failing to log it risks a duplicate on the next
        // run, but never a lost send. Surface it loudly.
        console.error("[announcement-email] ledger write failed:", insErr.message);
      }
      emailed += chunk.length;
    } catch (err) {
      failed += chunk.length;
      console.error("[announcement-email] batch send failed:", err);
    }
  }

  console.log(
    `[announcement-email] recipients=${players.length} emailed=${emailed} failed=${failed} skipped=${skipped}`,
  );
  return withFlag({ recipients: players.length, emailed, failed, skipped });
}
