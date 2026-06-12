import { and, eq, getTableName } from 'drizzle-orm';
import type { Db } from '../../client.js';
import { TenantScopeError } from '../../errors.js';
import { sessions } from '../../schema/sessions.js';

export async function assertSessionOwned(
  db: Db,
  tenantId: string,
  sessionId: string,
): Promise<void> {
  const rows = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(and(eq(sessions.id, sessionId), eq(sessions.tenantId, tenantId)))
    .limit(1);
  if (!rows[0]) {
    throw new TenantScopeError(getTableName(sessions), sessionId);
  }
}
