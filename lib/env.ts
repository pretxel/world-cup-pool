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
  supabaseUrl: required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
  supabaseAnonKey: required("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  siteUrl: resolveSiteUrl(),
  // Nullable on purpose — the cron route returns 204 with x-skipped: missing-env
  // when these are absent, so the build doesn't crash on cold envs.
  footballDataToken: process.env.FOOTBALL_DATA_TOKEN ?? null,
  cronSecret: process.env.CRON_SECRET ?? null,
  // Optional — when set, emits <meta property="fb:app_id"> so the page can be
  // tied to a Facebook app (Insights, Domain Insights, Comments moderation).
  facebookAppId: process.env.NEXT_PUBLIC_FACEBOOK_APP_ID ?? null,
};

export function requireServiceRoleKey(): string {
  return required("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY);
}
