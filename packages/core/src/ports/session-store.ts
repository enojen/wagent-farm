import type { ClosedReason, Session } from '../domain/session.js';

export interface CreateSessionInput {
  conversationId: string;
  agentId: string;
}

// Driven port: the session persistence core depends on. `undefined` = not found, not this
// tenant's, or already closed. The db sessions repository is one adapter; tests use a fake.
export interface SessionStore {
  findOpenSession(tenantId: string, conversationId: string): Promise<Session | undefined>;
  createSession(tenantId: string, input: CreateSessionInput): Promise<Session>;
  closeSession(
    tenantId: string,
    sessionId: string,
    reason: ClosedReason,
  ): Promise<Session | undefined>;
  touchSession(tenantId: string, sessionId: string): Promise<Session | undefined>;
}
