import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env.local from project root (dev/) when running from scripts/
config({ path: resolve(process.cwd(), '.env.local') });
