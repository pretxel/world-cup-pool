import "server-only";
import { Resend } from "resend";
import { getTranslations } from "next-intl/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { DEFAULT_LOCALE, localePath } from "@/lib/i18n";
import { isOptedIn } from "@/lib/email-prefs";
import { checkEmailSenderConfig } from "./email-sender-config";
import { isSendableEmail, type DispatchSummary } from "./result-emails";
import {
  renderWinnersEmail,
  type WinnersEmailStrings,
  type WinnersPodiumRow,
} from "./winners-email-template";

// Resend caps a single batch.send call at 100 messages; the podium is far
// smaller, but keep the ceiling for safety with pathological tie counts.
const RESEND_BATCH_LIMIT = 100;

// Podium cutoff: every player with a final overall rank at or above this
// receives the congratulation, ties included.
const PODIUM_MAX_RANK = 3;

// Run summary: `winners` = podium size found, so the admin overview shows why
// emailed can be lower (skips) without reading logs.
export interface WinnersDispatchSummary extends DispatchSummary {
  winners: number;
}

const ZERO: WinnersDispatchSummary = { winners: 0, emailed: 0, failed: 0, skipped: 0 };

// One podium player as read from v_leaderboard_overall.
export interface WinnerRow {
  user_id: string;
  display_name: string | null;
  rank: number;
  total_points: number;
}

// Emits one clear warning when the production email sender is misconfigured
// and reports that the run summary should carry the flag. Pure detection:
// never throws, never changes the resolved sender.
function warnIfSenderMisconfigured(context: string): boolean {
  const check = checkEmailSenderConfig();
  if (check.shouldWarn) {
    console.warn(`[winners-email] ${context}: ${check.message}`);
  }
  return check.shouldWarn;
}

// `From: Display Name <addr>` when a competition display name is provided.
function withFromName(emailFrom: string, fromName?: string): string {
  if (!fromName) return emailFrom;
  const m = emailFrom.match(/<([^>]+)>/);
  return `${fromName} <${m ? m[1] : emailFrom}>`;
}

// Pure: from the podium, drop players already in the send-once ledger and
// players opted out of the results-digest family (this email shares that
// preference key — no new opt-out category, same as score-rules). An absent/
// malformed preference reads as opted-in. Exported for unit testing.
export function computePendingWinners(
  winners: WinnerRow[],
  prefsById: Map<string, unknown>,
  alreadySent: { user_id: string }[],
): WinnerRow[] {
  const sent = new Set(alreadySent.map((r) => r.user_id));
  return winners.filter(
    (w) => !sent.has(w.user_id) && isOptedIn(prefsById.get(w.user_id), "results_digest"),
  );
}

// Minimal translator shape so this stays decoupled from next-intl internals.
type Translator = (key: string, values?: Record<string, unknown>) => string;

// Builds the resolved, value-bearing copy for one recipient. Rank phrasing
// (champion / second / third) is selected inside the messages via ICU select,
// so code never branches on medal wording.
export function buildWinnersEmailStrings(
  t: Translator,
  opts: { displayName: string | null; rank: number; totalPoints: number },
): WinnersEmailStrings {
  const values = { rank: String(opts.rank), points: opts.totalPoints };
  return {
    subject: t("subject", values),
    preheader: t("preheader", values),
    eyebrow: t("eyebrow"),
    heading: opts.displayName
      ? t("heading", { ...values, name: opts.displayName })
      : t("headingNoName", values),
    intro: t("intro", values),
    podiumLabel: t("podiumLabel"),
    rankLabel: t("rankLabel"),
    playerLabel: t("playerLabel"),
    pointsLabel: t("pointsLabel"),
    youLabel: t("youLabel"),
    ctaLabel: t("ctaLabel"),
    footer: t("footer"),
    madeWithLove: t("madeWithLove"),
    comingSoon: t("comingSoon"),
  };
}

type AdminClient = ReturnType<typeof createAdminSupabaseClient>;

// Player emails live only in auth.users — reachable via the service-role admin
// client. Returns null (→ skip) on any error or missing address.
async function resolveEmail(admin: AdminClient, userId: string): Promise<string | null> {
  try {
    const { data, error } = await admin.auth.admin.getUserById(userId);
    if (error) {
      console.error(`[winners-email] getUserById ${userId} failed:`, error.message);
      return null;
    }
    return data.user?.email ?? null;
  } catch (err) {
    console.error(`[winners-email] getUserById ${userId} threw:`, err);
    return null;
  }
}

// The final podium: every ranked row at PODIUM_MAX_RANK or better, ties
// included (the view assigns equal ranks to ties).
async function loadPodium(admin: AdminClient): Promise<WinnerRow[]> {
  const { data, error } = await admin
    .from("v_leaderboard_overall")
    .select("user_id, display_name, rank, total_points")
    .lte("rank", PODIUM_MAX_RANK)
    .order("rank", { ascending: true });
  if (error) throw new Error(`[winners-email] load podium: ${error.message}`);
  return (data ?? []).flatMap((r) =>
    r.user_id && r.rank != null
      ? [
          {
            user_id: r.user_id,
            display_name: r.display_name,
            rank: r.rank,
            total_points: r.total_points ?? 0,
          },
        ]
      : [],
  );
}

// Email prefs for the podium ids, keyed by user id.
async function loadPrefs(admin: AdminClient, ids: string[]): Promise<Map<string, unknown>> {
  if (ids.length === 0) return new Map();
  const { data, error } = await admin
    .from("profiles")
    .select("id, email_prefs")
    .in("id", ids);
  if (error) throw new Error(`[winners-email] load prefs: ${error.message}`);
  return new Map((data ?? []).map((p) => [p.id, p.email_prefs as unknown]));
}

// Dispatches the one-off winners congratulation to the final podium (overall
// rank ≤ 3, ties included): personalized subject/heading per recipient, the
// shared podium table with the recipient's row marked, and the send-once
// winners_email_log ledger for at-most-once delivery. No-ops when
// RESEND_API_KEY is unset or no winner is pending. Ledger rows are written
// only after Resend accepted the batch, so failures retry on the next manual
// run. Fired manually from the admin operations overview — never from cron.
export async function dispatchWinnersEmail(fromName?: string): Promise<WinnersDispatchSummary> {
  const senderMisconfigured = warnIfSenderMisconfigured("dispatch");
  const withFlag = (s: WinnersDispatchSummary): WinnersDispatchSummary =>
    senderMisconfigured ? { ...s, senderMisconfigured } : s;

  if (!env.resendApiKey) {
    console.log("[winners-email] RESEND_API_KEY unset — skipping dispatch");
    return withFlag({ ...ZERO });
  }

  const admin = createAdminSupabaseClient();

  const podium = await loadPodium(admin);
  if (podium.length === 0) {
    console.log("[winners-email] leaderboard has no podium — nothing to send");
    return withFlag({ ...ZERO });
  }

  const prefsById = await loadPrefs(admin, podium.map((w) => w.user_id));
  const { data: sentRows, error: sentErr } = await admin
    .from("winners_email_log")
    .select("user_id");
  if (sentErr) throw new Error(`[winners-email] load ledger: ${sentErr.message}`);

  const pending = computePendingWinners(podium, prefsById, sentRows ?? []);
  let skipped = podium.length - pending.length;
  if (pending.length === 0) {
    console.log("[winners-email] no pending winners");
    return withFlag({ ...ZERO, winners: podium.length, skipped });
  }

  const t = (await getTranslations({
    locale: DEFAULT_LOCALE,
    namespace: "winnersEmail",
  })) as Translator;
  const leaderboardUrl = `${env.siteUrl}${localePath(DEFAULT_LOCALE, "/leaderboard")}`;
  const fromAddress = withFromName(env.emailFrom, fromName);
  const resend = new Resend(env.resendApiKey);

  // One personalized message per pending winner; the podium rows are shared,
  // only the you-marker and heading vary.
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
  for (const w of pending) {
    const email = await resolveEmail(admin, w.user_id);
    if (!email || !isSendableEmail(email)) {
      skipped += 1;
      continue;
    }
    const podiumRows: WinnersPodiumRow[] = podium.map((p) => ({
      rank: p.rank,
      displayName: p.display_name,
      totalPoints: p.total_points,
      isYou: p.user_id === w.user_id,
    }));
    const { subject, html, text } = renderWinnersEmail({
      displayName: w.display_name,
      rank: w.rank,
      totalPoints: w.total_points,
      podium: podiumRows,
      leaderboardUrl,
      strings: buildWinnersEmailStrings(t, {
        displayName: w.display_name,
        rank: w.rank,
        totalPoints: w.total_points,
      }),
    });
    prepared.push({
      payload: {
        from: fromAddress,
        replyTo: env.emailReplyTo,
        to: [email],
        subject,
        html,
        text,
      },
      row: { user_id: w.user_id },
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
        .from("winners_email_log")
        .upsert(rows, { onConflict: "user_id", ignoreDuplicates: true });
      if (insErr) {
        // The email went out; failing to log it risks a duplicate on the next
        // run, but never a lost send. Surface it loudly.
        console.error("[winners-email] ledger write failed:", insErr.message);
      }
      emailed += chunk.length;
    } catch (err) {
      failed += chunk.length;
      console.error("[winners-email] batch send failed:", err);
    }
  }

  console.log(
    `[winners-email] winners=${podium.length} emailed=${emailed} failed=${failed} skipped=${skipped}`,
  );
  return withFlag({ winners: podium.length, emailed, failed, skipped });
}
