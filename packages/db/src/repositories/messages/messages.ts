import { and, asc, eq } from 'drizzle-orm';
import type { Db } from '../../client.js';
import { messages, type Message } from '../../schema/messages.js';
import { one } from '../../utils.js';
import { assertSessionOwned } from '../sessions/sessions.guard.js';
import type { InsertMessageInput } from './messages.types.js';

export function createMessagesRepository(db: Db) {
  return {
    async insertMessage(tenantId: string, input: InsertMessageInput): Promise<Message> {
      await assertSessionOwned(db, tenantId, input.sessionId);
      return one(
        await db
          .insert(messages)
          .values({
            tenantId,
            sessionId: input.sessionId,
            role: input.role,
            content: input.content,
            envelope: input.envelope ?? null,
          })
          .returning(),
      );
    },

    async listSessionMessages(tenantId: string, sessionId: string): Promise<Message[]> {
      return db
        .select()
        .from(messages)
        .where(and(eq(messages.tenantId, tenantId), eq(messages.sessionId, sessionId)))
        .orderBy(asc(messages.createdAt));
    },
  };
}
