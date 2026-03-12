export interface Env {
  DB: D1Database;
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  AI: any;  // Cloudflare Workers AI native binding
}
