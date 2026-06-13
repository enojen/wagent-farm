import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { createRepositories } from '../repositories/index.js';
import * as schema from '../schema/index.js';
import { seedDemo } from './seed.js';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set');
}
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const tenantIds = await seedDemo(createRepositories(drizzle(pool, { schema })));
for (const [slug, id] of Object.entries(tenantIds)) {
  console.log(`${slug}: ${id}`);
}

await pool.end();
