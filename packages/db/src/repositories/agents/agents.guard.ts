import { and, eq, getTableName } from 'drizzle-orm';
import type { Db } from '../../client.js';
import { TenantScopeError } from '../../errors.js';
import { agents } from '../../schema/agents.js';

export async function assertAgentOwned(
  db: Db,
  tenantId: string,
  agentId: string,
): Promise<void> {
  const rows = await db
    .select({ id: agents.id })
    .from(agents)
    .where(and(eq(agents.id, agentId), eq(agents.tenantId, tenantId)))
    .limit(1);
  if (!rows[0]) {
    throw new TenantScopeError(getTableName(agents), agentId);
  }
}
