import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { runners } from './db/schema';
import { chatWithPeacemaker } from './services/peacemaker';
import { PeacemakerChatRequestSchema } from '@ruwt/shared';

const app = new Hono();

// CORS: Allow everything for now to avoid mobile connection issues
app.use('/*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// Database connection
const connectionString = process.env.DATABASE_URL || 'postgres://postgres:password@127.0.0.1:5432/ruwt';
console.log('Connecting to DB with:', connectionString.replace(/:[^:@]+@/, ':***@')); 
const client = postgres(connectionString);
const db = drizzle(client);

app.get('/', (c) => c.text('Ruwt API is running on Bun with Postgres!'));

app.get('/runners', async (c) => {
  try {
    const allRunners = await db.select().from(runners);
    console.log(`Fetched ${allRunners.length} runners`);
    return c.json(allRunners);
  } catch (error) {
    console.error('DB Connection Error:', error); // Log detailed error
    return c.json({ error: 'Failed to fetch runners', details: String(error) }, 500);
  }
});

app.post('/runners/peacemaker/chat', async (c) => {
  try {
    const body = await c.req.json();
    const payload = PeacemakerChatRequestSchema.parse(body);
    
    const response = await chatWithPeacemaker(payload);
    
    if (!response) {
      return c.json({ error: 'Peacemaker failed to respond' }, 500);
    }

    return c.json(response);
  } catch (error) {
    console.error(error);
    return c.json({ error: 'Invalid request or server error' }, 400);
  }
});

const port = parseInt(process.env.PORT || '3000');
console.log(`Server is running on port ${port}`);

export default {
  port,
  fetch: app.fetch,
  hostname: '0.0.0.0' // Explicitly listen on all network interfaces
};
