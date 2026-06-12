import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite/vector';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { fileURLToPath } from 'node:url';
import { createRepositories, type Repositories } from '../repositories/index.js';
import * as schema from '../schema/index.js';

// In-memory Postgres running the real migrations — no Docker needed.
export async function createTestDb() {
  const client = new PGlite({ extensions: { vector } });
  const db = drizzle(client, { schema });
  await migrate(db, {
    migrationsFolder: fileURLToPath(new URL('../../drizzle', import.meta.url)),
  });
  return {
    db,
    repos: createRepositories(db),
    close: () => client.close(),
  };
}

// Seeds via the repositories so the suite only exercises the public API.
export async function seedTwoTenants(repos: Repositories) {
  const plan = await repos.plans.upsertPlan({
    name: 'test-plan',
    monthlyTokens: 1_000_000,
    messagesPerMinute: 60,
  });
  const tenantA = await repos.tenants.upsertTenant({
    slug: 'tenant-a',
    name: 'Tenant A',
    planId: plan.id,
  });
  const tenantB = await repos.tenants.upsertTenant({
    slug: 'tenant-b',
    name: 'Tenant B',
    planId: plan.id,
  });
  const agentA = await repos.agents.upsertAgent(tenantA.id, {
    key: 'sales',
    name: 'Sales A',
  });
  const agentB = await repos.agents.upsertAgent(tenantB.id, {
    key: 'sales',
    name: 'Sales B',
  });
  return { plan, tenantA, tenantB, agentA, agentB };
}
