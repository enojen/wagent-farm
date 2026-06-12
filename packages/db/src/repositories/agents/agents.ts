import { and, eq } from 'drizzle-orm';
import type { Db } from '../../client.js';
import { agents, type Agent } from '../../schema/agents.js';
import { one } from '../../utils.js';
import type { UpsertAgentInput } from './agents.types.js';

export function createAgentsRepository(db: Db) {
  return {
    async upsertAgent(tenantId: string, input: UpsertAgentInput): Promise<Agent> {
      return one(
        await db
          .insert(agents)
          .values({ tenantId, ...input })
          .onConflictDoUpdate({
            target: [agents.tenantId, agents.key],
            set: { name: input.name },
          })
          .returning(),
      );
    },

    async getAgentByKey(tenantId: string, key: string): Promise<Agent | undefined> {
      const rows = await db
        .select()
        .from(agents)
        .where(and(eq(agents.tenantId, tenantId), eq(agents.key, key)))
        .limit(1);
      return rows[0];
    },

    async listAgents(tenantId: string): Promise<Agent[]> {
      return db.select().from(agents).where(eq(agents.tenantId, tenantId));
    },
  };
}
