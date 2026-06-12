import { drizzle } from 'drizzle-orm/node-postgres';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { Pool } from 'pg';
import * as schema from './schema/index.js';

// Driver-agnostic handle so repositories work on node-postgres (production)
// and PGlite (tests) alike.
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

export function createDb(connectionString = process.env.DATABASE_URL): Db {
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
  }
  const pool = new Pool({ connectionString });
  return drizzle(pool, { schema });
}
