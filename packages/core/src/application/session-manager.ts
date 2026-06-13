import type { ConversationKey } from '../domain/conversation.js';
import { isExpired } from '../domain/session.js';
import { createKeyedLock } from '../keyed-lock.js';
import type {
  ResolveSessionDeps,
  ResolveSessionParams,
  ResolveSessionResult,
  ResolveSessionPorts,
} from './session-manager.types.js';

// One process-wide lock so concurrent turns on the same conversation serialize by default.
const defaultDeps: ResolveSessionDeps = {
  lock: createKeyedLock(),
  now: () => new Date(),
};

export function resolveSession(
  ports: ResolveSessionPorts,
  params: ResolveSessionParams,
  deps: ResolveSessionDeps = defaultDeps,
): Promise<ResolveSessionResult> {
  const { tenantId, conversationKey, agentId, timeoutHours } = params;
  const { conversations, sessions } = ports;
  const { lock, now } = deps;

  return lock.run(lockKeyFor(tenantId, conversationKey), async () => {
    const { id: conversationId } = await conversations.getOrCreateConversation(
      tenantId,
      conversationKey,
    );
    const open = await sessions.findOpenSession(tenantId, conversationId);

    if (open && !isExpired(open, now(), timeoutHours)) {
      // Holding the per-conversation lock, no concurrent close can race us.
      const touched = await sessions.touchSession(tenantId, open.id);
      return { session: touched ?? open, reused: true };
    }
    if (open) {
      await sessions.closeSession(tenantId, open.id, 'timeout');
    }

    const session = await sessions.createSession(tenantId, { conversationId, agentId });
    return { session, reused: false };
  });
}

function lockKeyFor(tenantId: string, key: ConversationKey): string {
  return `${tenantId}:${key.channel}:${key.endUserId}`;
}
