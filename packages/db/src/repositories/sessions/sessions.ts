import { and, desc, eq, sql } from 'drizzle-orm';
import type { Db } from '../../client.js';
import { sessions, type Session } from '../../schema/sessions.js';
import type { ClosedReason } from '../../types.js';
import { one } from '../../utils.js';
import { assertAgentOwned } from '../agents/agents.guard.js';
import { assertConversationOwned } from '../conversations/conversations.guard.js';
import type { CreateSessionInput } from './sessions.types.js';

export function createSessionsRepository(db: Db) {
  return {
    async createSession(tenantId: string, input: CreateSessionInput): Promise<Session> {
      await assertConversationOwned(db, tenantId, input.conversationId);
      await assertAgentOwned(db, tenantId, input.agentId);
      return one(await db.insert(sessions).values({ tenantId, ...input }).returning());
    },

    async findOpenSession(
      tenantId: string,
      conversationId: string,
    ): Promise<Session | undefined> {
      const rows = await db
        .select()
        .from(sessions)
        .where(
          and(
            eq(sessions.tenantId, tenantId),
            eq(sessions.conversationId, conversationId),
            eq(sessions.status, 'open'),
          ),
        )
        .orderBy(desc(sessions.createdAt))
        .limit(1);
      return rows[0];
    },

    // undefined = not found, not this tenant's, or already closed.
    async touchSession(tenantId: string, sessionId: string): Promise<Session | undefined> {
      const rows = await db
        .update(sessions)
        .set({ lastActivityAt: sql`now()` })
        .where(
          and(
            eq(sessions.id, sessionId),
            eq(sessions.tenantId, tenantId),
            eq(sessions.status, 'open'),
          ),
        )
        .returning();
      return rows[0];
    },

    // undefined = not found, not this tenant's, or already closed.
    async closeSession(
      tenantId: string,
      sessionId: string,
      reason: ClosedReason,
    ): Promise<Session | undefined> {
      const rows = await db
        .update(sessions)
        .set({ status: 'closed', closedReason: reason, closedAt: sql`now()` })
        .where(
          and(
            eq(sessions.id, sessionId),
            eq(sessions.tenantId, tenantId),
            eq(sessions.status, 'open'),
          ),
        )
        .returning();
      return rows[0];
    },
  };
}
