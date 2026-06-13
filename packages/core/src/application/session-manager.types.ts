import type { ConversationKey } from '../domain/conversation.js';
import type { Session } from '../domain/session.js';
import type { KeyedLock } from '../keyed-lock.js';
import type { ConversationStore } from '../ports/conversation-store.js';
import type { SessionStore } from '../ports/session-store.js';

export interface ResolveSessionPorts {
  conversations: ConversationStore;
  sessions: SessionStore;
}

export interface ResolveSessionParams {
  tenantId: string;
  conversationKey: ConversationKey;
  agentId: string;
  timeoutHours: number;
}

export interface ResolveSessionDeps {
  lock: KeyedLock;
  now: () => Date;
}

export interface ResolveSessionResult {
  session: Session;
  reused: boolean;
}
