import { and, desc, eq, getTableColumns } from 'drizzle-orm';
import type { Db } from '../../client.js';
import { agents } from '../../schema/agents.js';
import { agentConfigs, type AgentConfig } from '../../schema/agent-configs.js';
import { one } from '../../utils.js';
import { assertAgentOwned } from '../agents/agents.guard.js';
import type { UpsertAgentConfigInput } from './agent-configs.types.js';

// agent_configs has no tenant_id column; scope comes from the owning agent.
export function createAgentConfigsRepository(db: Db) {
  return {
    async upsertAgentConfig(
      tenantId: string,
      input: UpsertAgentConfigInput,
    ): Promise<AgentConfig> {
      await assertAgentOwned(db, tenantId, input.agentId);
      return one(
        await db
          .insert(agentConfigs)
          .values(input)
          .onConflictDoUpdate({
            target: [agentConfigs.agentId, agentConfigs.version],
            set: { config: input.config },
          })
          .returning(),
      );
    },

    async getLatestAgentConfig(
      tenantId: string,
      agentId: string,
    ): Promise<AgentConfig | undefined> {
      const rows = await db
        .select(getTableColumns(agentConfigs))
        .from(agentConfigs)
        .innerJoin(agents, eq(agentConfigs.agentId, agents.id))
        .where(and(eq(agents.tenantId, tenantId), eq(agentConfigs.agentId, agentId)))
        .orderBy(desc(agentConfigs.version))
        .limit(1);
      return rows[0];
    },
  };
}
