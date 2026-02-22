/**
 * Cloudflare Pages Functions environment.
 * DB is bound in wrangler.toml; other vars from dashboard or .dev.vars.
 */
interface Env {
  DB: D1Database;
  VITE_SUPABASE_URL: string;
  VITE_SUPABASE_ANON_KEY: string;
  STRIPE_WEBHOOK_SECRET?: string;
  STRIPE_SECRET_KEY?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_API_TOKEN?: string;
  PISTON_API_URL?: string;
  ADMIN_USER_IDS?: string;
  RESEND_API_KEY?: string;
  CRON_SECRET?: string;
  GITHUB_TOKEN?: string;
  ERROR_ALERT_EMAIL?: string;
  SENTRY_DSN?: string;
}
