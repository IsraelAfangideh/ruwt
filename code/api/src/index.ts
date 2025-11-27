import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { runners } from './db/schema';

const app = new Hono();

// Database connection
const connectionString = process.env.DATABASE_URL || 'postgres://postgres:password@localhost:5432/ruwt';
const client = postgres(connectionString);
const db = drizzle(client);

app.get('/', (c) => c.text('Ruwt API is running on Bun with Postgres!'));

app.get('/runners', async (c) => {
  try {
    const allRunners = await db.select().from(runners);
    return c.json(allRunners);
  } catch (error) {
    console.error(error);
    return c.json({ error: 'Failed to fetch runners' }, 500);
  }
});

const port = parseInt(process.env.PORT || '3000');
console.log(`Server is running on port ${port}`);

export default {
  port,
  fetch: app.fetch,
};
