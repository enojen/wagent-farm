import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TenantScopeError } from '../../errors.js';
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

describe('agent configs tenant isolation (scoped via owning agent)', () => {
  it('upsertAgentConfig rejects an agent owned by another tenant', async () => {
    await expect(
      t.repos.agentConfigs.upsertAgentConfig(seed.tenantB.id, {
        agentId: seed.agentA.id,
        version: 1,
        config: { stolen: true },
      }),
    ).rejects.toThrow(TenantScopeError);
  });

  it('getLatestAgentConfig picks the highest version, only for the owner', async () => {
    await t.repos.agentConfigs.upsertAgentConfig(seed.tenantA.id, {
      agentId: seed.agentA.id,
      version: 1,
      config: { v: 1 },
    });
    await t.repos.agentConfigs.upsertAgentConfig(seed.tenantA.id, {
      agentId: seed.agentA.id,
      version: 2,
      config: { v: 2 },
    });

    const latest = await t.repos.agentConfigs.getLatestAgentConfig(
      seed.tenantA.id,
      seed.agentA.id,
    );
    expect(latest?.version).toBe(2);

    expect(
      await t.repos.agentConfigs.getLatestAgentConfig(seed.tenantB.id, seed.agentA.id),
    ).toBeUndefined();
  });

  it('upsertAgentConfig is idempotent per (agent, version)', async () => {
    const updated = await t.repos.agentConfigs.upsertAgentConfig(seed.tenantA.id, {
      agentId: seed.agentA.id,
      version: 2,
      config: { v: '2b' },
    });
    expect(updated.config).toEqual({ v: '2b' });
  });
});
