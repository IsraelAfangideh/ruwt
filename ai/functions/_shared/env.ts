export interface Env {
  DB: D1Database;
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  RESEND_API_KEY?: string;
  ERROR_ALERT_EMAIL?: string;
}
