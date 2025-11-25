import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { runners } from './db/schema';

const sqlite = new Database('ruwt.db');
const db = drizzle(sqlite);

async function seed() {
  console.log('Seeding database...');
  await db.insert(runners).values({
    name: 'Ratzim Alpha',
    personality: 'Helpful and swift',
    embedding: JSON.stringify([0.1, 0.2, 0.3]), // Mock embedding
  });
  console.log('Seeding complete!');
}

seed().catch(console.error);
