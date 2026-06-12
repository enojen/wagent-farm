import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDb, seedTwoTenants } from '../../test/pglite.js';

let t: Awaited<ReturnType<typeof createTestDb>>;
let seed: Awaited<ReturnType<typeof seedTwoTenants>>;

beforeAll(async () => {
  t = await createTestDb();
  seed = await seedTwoTenants(t.repos);
});

afterAll(async () => {
  await t.close();
});

describe('agents repository tenant isolation', () => {
  it('getAgentByKey does not cross tenants even on a shared key', async () => {
    const found = await t.repos.agents.getAgentByKey(seed.tenantA.id, 'sales');
    expect(found?.id).toBe(seed.agentA.id);
    expect(found?.name).toBe('Sales A');
  });

  it('getAgentByKey returns undefined for an unknown key', async () => {
    expect(await t.repos.agents.getAgentByKey(seed.tenantA.id, 'nope')).toBeUndefined();
  });

  it('listAgents excludes the other tenant rows', async () => {
    const list = await t.repos.agents.listAgents(seed.tenantB.id);
    expect(list.map((a) => a.id)).toEqual([seed.agentB.id]);
  });

  it('upsertAgent is idempotent per (tenant, key)', async () => {
    const again = await t.repos.agents.upsertAgent(seed.tenantA.id, {
      key: 'sales',
      name: 'Sales A v2',
    });
    expect(again.id).toBe(seed.agentA.id);
    expect(again.name).toBe('Sales A v2');
  });
});
