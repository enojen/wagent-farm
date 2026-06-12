import { and, eq, getTableName } from 'drizzle-orm';
import type { Db } from '../../client.js';
import { TenantScopeError } from '../../errors.js';
import { conversations } from '../../schema/conversations.js';

export async function assertConversationOwned(
  db: Db,
  tenantId: string,
  conversationId: string,
): Promise<void> {
  const rows = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(and(eq(conversations.id, conversationId), eq(conversations.tenantId, tenantId)))
    .limit(1);
  if (!rows[0]) {
    throw new TenantScopeError(getTableName(conversations), conversationId);
  }
}
