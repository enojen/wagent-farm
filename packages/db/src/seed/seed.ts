import type { Repositories } from '../repositories/index.js';
import { demoPlan, demoTenants } from './demo-data.js';

// Idempotency comes from the upserts' unique targets: plans.name,
// tenants.slug, agents (tenant_id, key), agent_configs (agent_id, version).
export async function seedDemo(repos: Repositories): Promise<Record<string, string>> {
  const plan = await repos.plans.upsertPlan(demoPlan);
  const tenantIds: Record<string, string> = {};

  for (const demoTenant of demoTenants) {
    const tenant = await repos.tenants.upsertTenant({
      slug: demoTenant.slug,
      name: demoTenant.name,
      planId: plan.id,
    });
    tenantIds[demoTenant.slug] = tenant.id;

    for (const demoAgent of demoTenant.agents) {
      const agent = await repos.agents.upsertAgent(tenant.id, {
        key: demoAgent.key,
        name: demoAgent.name,
      });
      await repos.agentConfigs.upsertAgentConfig(tenant.id, {
        agentId: agent.id,
        version: 1,
        config: demoAgent.config,
      });
    }
  }

  return tenantIds;
}
