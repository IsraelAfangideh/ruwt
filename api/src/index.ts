import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { runners } from './db/schema';

const app = new Hono();

// Database connection
const sqlite = new Database('ruwt.db');
const db = drizzle(sqlite);

app.get('/', (c) => c.text('Ruwt API is running on Node with SQLite!'));

app.get('/runners', async (c) => {
  try {
    const allRunners = await db.select().from(runners);
    return c.json(allRunners);
  } catch (error) {
    console.error(error);
    return c.json({ error: 'Failed to fetch runners' }, 500);
  }
});

const port = 3000;
console.log(`Server is running on port ${port}`);

serve({
  fetch: app.fetch,
  port
});
