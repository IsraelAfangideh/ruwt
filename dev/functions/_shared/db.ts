/**
 * D1 + Drizzle for Cloudflare Pages Functions.
 * Use getDb(env) in each handler; env.DB is the D1 binding from wrangler.toml.
 */
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../../drizzle/schema.d1';

export function getDb(env: { DB: D1Database }) {
  return drizzle(env.DB, { schema });
}

export type Db = ReturnType<typeof getDb>;
