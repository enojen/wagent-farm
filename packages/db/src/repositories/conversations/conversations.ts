import { and, eq } from 'drizzle-orm';
import type { Db } from '../../client.js';
import { conversations, type Conversation } from '../../schema/conversations.js';
import { one } from '../../utils.js';
import type { GetOrCreateConversationInput } from './conversations.types.js';

export function createConversationsRepository(db: Db) {
  return {
    async getOrCreateConversation(
      tenantId: string,
      input: GetOrCreateConversationInput,
    ): Promise<Conversation> {
      // No-op conflict update so RETURNING yields the existing row in one round trip.
      return one(
        await db
          .insert(conversations)
          .values({ tenantId, ...input })
          .onConflictDoUpdate({
            target: [conversations.tenantId, conversations.channel, conversations.endUserId],
            set: { endUserId: input.endUserId },
          })
          .returning(),
      );
    },

    async getConversation(
      tenantId: string,
      conversationId: string,
    ): Promise<Conversation | undefined> {
      const rows = await db
        .select()
        .from(conversations)
        .where(
          and(eq(conversations.id, conversationId), eq(conversations.tenantId, tenantId)),
        )
        .limit(1);
      return rows[0];
    },
  };
}
