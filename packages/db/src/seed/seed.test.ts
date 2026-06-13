import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { agentConfigs } from '../schema/agent-configs.js';
import { agents } from '../schema/agents.js';
import { plans } from '../schema/plans.js';
import { tenants } from '../schema/tenants.js';
import { createTestDb } from '../test/pglite.js';
import { demoTenants } from './demo-data.js';
import { seedDemo } from './seed.js';

let t: Awaited<ReturnType<typeof createTestDb>>;

beforeAll(async () => {
  t = await createTestDb();
});

afterAll(async () => {
  await t.close();
});

describe('seedDemo', () => {
  it('seeds both demo tenants with their agents and configs', async () => {
    const tenantIds = await seedDemo(t.repos);

    expect(Object.keys(tenantIds).sort()).toEqual(['otosor-demo', 'shopify-demo']);

    for (const demoTenant of demoTenants) {
      const tenantId = tenantIds[demoTenant.slug];
      expect(tenantId).toBeDefined();
      const seededAgents = await t.repos.agents.listAgents(tenantId!);
      expect(seededAgents.map((a) => a.key).sort()).toEqual(
        demoTenant.agents.map((a) => a.key).sort(),
      );

      for (const demoAgent of demoTenant.agents) {
        const agent = await t.repos.agents.getAgentByKey(tenantId!, demoAgent.key);
        const config = await t.repos.agentConfigs.getLatestAgentConfig(
          tenantId!,
          agent!.id,
        );
        expect(config?.version).toBe(1);
        expect(config?.config).toEqual(demoAgent.config);
      }
    }
  });

  it('is idempotent: a second run returns the same ids and adds no rows', async () => {
    const first = await seedDemo(t.repos);
    const counts = async () => ({
      plans: (await t.db.select().from(plans)).length,
      tenants: (await t.db.select().from(tenants)).length,
      agents: (await t.db.select().from(agents)).length,
      agentConfigs: (await t.db.select().from(agentConfigs)).length,
    });
    const before = await counts();

    const second = await seedDemo(t.repos);

    expect(second).toEqual(first);
    expect(await counts()).toEqual(before);
  });
});
