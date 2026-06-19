import { NextResponse, type NextRequest } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { normalizeEmailPrefs } from "@/lib/email-prefs";

// One-click unsubscribe for the comeback (re-engagement) email. Reached from the
// email's footer link (GET) and from RFC 8058 one-click clients (POST). No auth:
// the opaque `unsubscribe_token` IS the credential, so a logged-out recipient
// can opt out. Idempotent and non-enumerating — every call returns the same
// friendly confirmation regardless of whether the token matched. Sets only the
// comeback opt-out in email_prefs, leaving every other preference untouched.
// Unlike the prediction reminder, there is no legacy boolean column for this new
// type, so only the jsonb key is written.

const CONFIRMATION =
  "You've been unsubscribed from comeback emails. You can still make your picks anytime from the app.";

// The token is a UUID (profiles.unsubscribe_token). Reject anything that isn't
// well-formed before touching the service-role client, so junk/probe input
// never reaches the database.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function optOut(token: string | null): Promise<void> {
  if (!token || !UUID_RE.test(token)) return;
  try {
    const admin = createAdminSupabaseClient();
    // Service role bypasses RLS; scope strictly to the matching token. Read the
    // current email_prefs so the in-app source of truth stays in sync: a footer
    // opt-out must show as off in the account menu and be reversible there.
    const { data: profile } = await admin
      .from("profiles")
      .select("email_prefs")
      .eq("unsubscribe_token", token)
      .maybeSingle();
    if (!profile) return;
    const email_prefs = {
      ...normalizeEmailPrefs(profile.email_prefs),
      comeback: false,
    };
    const { error } = await admin
      .from("profiles")
      .update({ email_prefs })
      .eq("unsubscribe_token", token);
    if (error) {
      console.error("[comeback-emails:unsubscribe] update failed:", error.message);
    }
  } catch (err) {
    console.error("[comeback-emails:unsubscribe] threw:", err);
  }
}

function confirmation() {
  return new NextResponse(CONFIRMATION, {
    status: 200,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

export async function GET(request: NextRequest) {
  await optOut(request.nextUrl.searchParams.get("token"));
  return confirmation();
}

// RFC 8058 List-Unsubscribe-Post: mailbox providers POST to the same URL.
export async function POST(request: NextRequest) {
  await optOut(request.nextUrl.searchParams.get("token"));
  return confirmation();
}
