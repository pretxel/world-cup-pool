function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function resolveSiteUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  // Vercel injects this at runtime for production deployments.
  const vercelProd = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercelProd) return `https://${vercelProd}`;
  // Preview / branch deployments expose VERCEL_URL.
  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl) return `https://${vercelUrl}`;
  return "http://localhost:3000";
}

export const env = {
  // Browser code reads the build-time-inlined NEXT_PUBLIC_SUPABASE_URL (Next
  // inlines NEXT_PUBLIC_* into BOTH client and server bundles at build). In
  // Docker the browser and server need different origins (browser: host
  // localhost:8000, server: in-network http://kong:8000), so server code
  // prefers a non-public SUPABASE_URL that is read at RUNTIME (not inlined).
  // On the client process.env.SUPABASE_URL is undefined → falls back to the
  // inlined public URL. On Vercel SUPABASE_URL is unset → same value as before.
  supabaseUrl:
    process.env.SUPABASE_URL ||
    required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
  supabaseAnonKey: required("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  siteUrl: resolveSiteUrl(),
  // Nullable on purpose — the cron route returns 204 with x-skipped: missing-env
  // when these are absent, so the build doesn't crash on cold envs.
  footballDataToken: process.env.FOOTBALL_DATA_TOKEN ?? null,
  cronSecret: process.env.CRON_SECRET ?? null,
  // News feed for the /news section. Token is required for sync-news to run;
  // URL overrides the default provider endpoint. Both nullable so cold envs
  // skip the sync gracefully instead of crashing the build.
  newsApiToken: process.env.NEWS_API_TOKEN ?? null,
  newsApiUrl: process.env.NEWS_API_URL ?? null,
  // Resend transactional email. Nullable so the result-email dispatch step
  // no-ops (like the cron's missing-env short-circuit) when unset instead of
  // crashing. `emailFrom` must be a Resend verified-domain sender in
  // production; the default is dev-only.
  resendApiKey: process.env.RESEND_API_KEY ?? null,
  emailFrom: process.env.EMAIL_FROM ?? "World Cup Pools <onboarding@resend.dev>",
  // Reply-To for every transactional send: recipients can reply (and spam
  // filters trust a two-way address). Defaults to the From address so a
  // Reply-To is always present even if EMAIL_REPLY_TO is unset; the `<addr>`
  // is extracted from the `Name <addr>` form when present.
  emailReplyTo:
    process.env.EMAIL_REPLY_TO ??
    (process.env.EMAIL_FROM ?? "World Cup Pools <onboarding@resend.dev>").match(
      /<([^>]+)>/,
    )?.[1] ??
    (process.env.EMAIL_FROM ?? "onboarding@resend.dev"),
  // OpenRouter (server only) for the post-final AI match recap. Nullable on
  // purpose — when the key is unset the generation step short-circuits (no
  // request, no row) instead of throwing, so the feature stays dormant until
  // configured. `openrouterModel` defaults to a small, cheap instruct model.
  openrouterApiKey: process.env.OPENROUTER_API_KEY ?? null,
  openrouterModel: process.env.OPENROUTER_MODEL ?? "openai/gpt-4o-mini",
  // Leonardo.ai image generation (server only) — renders a recap's image_prompt
  // into the comic strip. Nullable/dormant: with no key the render step no-ops
  // (no Leonardo call, no render row). `leonardoWebhookSecret` authenticates the
  // /api/callback-image webhook; when unset the webhook rejects every request.
  // The secret must equal the "webhook callback API key" bound to the Leonardo
  // production API key. `leonardoModel` defaults to the GPT-Image-2 model.
  leonardoApiKey: process.env.LEONARDO_API_KEY ?? null,
  leonardoWebhookSecret: process.env.LEONARDO_WEBHOOK_SECRET ?? null,
  leonardoModel: process.env.LEONARDO_MODEL ?? "gpt-image-2",
  // Shared secret for the Supabase Auth "Send Email Hook" (Standard Webhooks
  // format: "v1,whsec_<base64>"). The send-email route verifies every hook
  // request against this. Nullable so the route returns 401 (not a crash) when
  // unset, and so cold/dev envs don't fail the build.
  sendEmailHookSecret: process.env.SEND_EMAIL_HOOK_SECRET ?? null,
  // Optional — when set, emits <meta property="fb:app_id"> so the page can be
  // tied to a Facebook app (Insights, Domain Insights, Comments moderation).
  facebookAppId: process.env.NEXT_PUBLIC_FACEBOOK_APP_ID ?? null,
  // Google Analytics 4 measurement ID. Defaults to the project's stream so
  // analytics works without extra config; override per-environment if needed.
  gaMeasurementId: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? "G-18P5786JW2",
  // Web Push (VAPID). The public key is client-readable (the subscribe flow
  // passes it to pushManager.subscribe); the private key + subject are
  // server-only (the send path signs with them). All nullable on purpose — when
  // any is unset every push send path no-ops (logs and sends nothing) and the
  // subscribe UI stays off, so the feature is fully dormant until configured,
  // mirroring the resendApiKey/footballDataToken posture. Generate once with
  // `npx web-push generate-vapid-keys`. `vapidSubject` is a `mailto:` or https
  // contact URL the push services use to reach the application server operator.
  vapidPublicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null,
  vapidPrivateKey: process.env.VAPID_PRIVATE_KEY ?? null,
  vapidSubject: process.env.VAPID_SUBJECT ?? null,
};

export function requireServiceRoleKey(): string {
  return required("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY);
}
