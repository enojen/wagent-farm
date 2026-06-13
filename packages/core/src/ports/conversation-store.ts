import type { ConversationKey, ConversationRef } from '../domain/conversation.js';

// Driven port: how core resolves the permanent conversation thread. The db conversations
// repository is one adapter; tests use an in-memory fake.
export interface ConversationStore {
  getOrCreateConversation(tenantId: string, key: ConversationKey): Promise<ConversationRef>;
}
