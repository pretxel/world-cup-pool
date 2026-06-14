import { NextResponse, type NextRequest } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

// One-click unsubscribe for daily prediction reminders. Reached from the email's
// footer link (GET) and from RFC 8058 one-click clients (POST). No auth: the
// opaque `unsubscribe_token` IS the credential, so a logged-out recipient can
// opt out. Idempotent and non-enumerating — every call returns the same
// friendly confirmation regardless of whether the token matched. Sets only the
// prediction opt-out, leaving any quiz-reminder preference untouched.

const CONFIRMATION =
  "You've been unsubscribed from daily prediction reminders. You can still make your picks anytime from the app.";

// The token is a UUID (profiles.unsubscribe_token). Reject anything that isn't
// well-formed before touching the service-role client, so junk/probe input
// never reaches the database.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function optOut(token: string | null): Promise<void> {
  if (!token || !UUID_RE.test(token)) return;
  try {
    const admin = createAdminSupabaseClient();
    // Service role bypasses RLS; scope strictly to the matching token.
    const { error } = await admin
      .from("profiles")
      .update({ prediction_reminder_opt_out: true })
      .eq("unsubscribe_token", token);
    if (error) {
      console.error("[prediction-reminders:unsubscribe] update failed:", error.message);
    }
  } catch (err) {
    console.error("[prediction-reminders:unsubscribe] threw:", err);
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
