import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { runners } from './db/schema';

const connectionString = 'postgres://postgres:password@localhost:5432/ruwt';
const client = postgres(connectionString);
const db = drizzle(client);

async function seed() {
  console.log('Seeding database...');
  await db.insert(runners).values({
    name: 'Ratzim Alpha',
    personality: 'Helpful and swift',
    embedding: [0.1, 0.2, 0.3], // Mock embedding
  });
  console.log('Seeding complete!');
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
