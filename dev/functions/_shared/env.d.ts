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
  OPENAI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  PISTON_API_URL?: string;
  ENCRYPTION_KEY?: string;
  GOOGLE_AI_API_KEY?: string;
}
