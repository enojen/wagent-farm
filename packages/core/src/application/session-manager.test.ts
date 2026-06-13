import { beforeEach, describe, expect, it } from 'vitest';
import type { Session } from '../domain/session.js';
import { createKeyedLock } from '../keyed-lock.js';
import type { ConversationStore } from '../ports/conversation-store.js';
import type { SessionStore } from '../ports/session-store.js';
import { resolveSession } from './session-manager.js';
import type {
  ResolveSessionDeps,
  ResolveSessionPorts,
} from './session-manager.types.js';

const TENANT = '11111111-1111-1111-1111-111111111111';
const AGENT = '22222222-2222-2222-2222-222222222222';
const KEY = { channel: 'console' as const, endUserId: 'phone:+905550000001' };

function createFakeStore(now: () => Date) {
  const conversationIds = new Map<string, string>();
  const sessions = new Map<string, Session>();
  let convSeq = 0;
  let sessSeq = 0;

  const conversations: ConversationStore = {
    async getOrCreateConversation(tenantId, key) {
      const k = `${tenantId}:${key.channel}:${key.endUserId}`;
      let id = conversationIds.get(k);
      if (!id) {
        id = `conv-${(convSeq += 1)}`;
        conversationIds.set(k, id);
      }
      return { id };
    },
  };

  const store: SessionStore = {
    async findOpenSession(tenantId, conversationId) {
      const open = [...sessions.values()].filter(
        (s) =>
          s.tenantId === tenantId &&
          s.conversationId === conversationId &&
          s.status === 'open',
      );
      return open[open.length - 1];
    },
    async createSession(tenantId, input) {
      const ts = now();
      const session: Session = {
        id: `sess-${(sessSeq += 1)}`,
        tenantId,
        conversationId: input.conversationId,
        agentId: input.agentId,
        status: 'open',
        closedReason: null,
        createdAt: ts,
        lastActivityAt: ts,
        closedAt: null,
      };
      sessions.set(session.id, session);
      return session;
    },
    async closeSession(tenantId, sessionId, reason) {
      const s = sessions.get(sessionId);
      if (!s || s.tenantId !== tenantId || s.status !== 'open') return undefined;
      const updated: Session = {
        ...s,
        status: 'closed',
        closedReason: reason,
        closedAt: now(),
      };
      sessions.set(sessionId, updated);
      return updated;
    },
    async touchSession(tenantId, sessionId) {
      const s = sessions.get(sessionId);
      if (!s || s.tenantId !== tenantId || s.status !== 'open') return undefined;
      const updated: Session = { ...s, lastActivityAt: now() };
      sessions.set(sessionId, updated);
      return updated;
    },
  };
  const ports: ResolveSessionPorts = { conversations, sessions: store };
  return { ports, sessions };
}

let current: Date;
const now = () => current;
const advanceHours = (h: number) => {
  current = new Date(current.getTime() + h * 3_600_000);
};

function makeDeps(): ResolveSessionDeps {
  return { lock: createKeyedLock(), now };
}

beforeEach(() => {
  current = new Date('2026-01-01T00:00:00Z');
});

describe('resolveSession', () => {
  it('creates a session when none is open', async () => {
    const { ports, sessions } = createFakeStore(now);
    const { session, reused } = await resolveSession(
      ports,
      { tenantId: TENANT, conversationKey: KEY, agentId: AGENT, timeoutHours: 24 },
      makeDeps(),
    );

    expect(reused).toBe(false);
    expect(session.status).toBe('open');
    expect(sessions.size).toBe(1);
  });

  it('reuses an open session within the timeout and advances last activity', async () => {
    const { ports, sessions } = createFakeStore(now);
    const params = {
      tenantId: TENANT,
      conversationKey: KEY,
      agentId: AGENT,
      timeoutHours: 24,
    };
    const deps = makeDeps();

    const first = await resolveSession(ports, params, deps);
    advanceHours(1);
    const second = await resolveSession(ports, params, deps);

    expect(second.reused).toBe(true);
    expect(second.session.id).toBe(first.session.id);
    expect(second.session.lastActivityAt).toEqual(current);
    expect(sessions.size).toBe(1);
  });

  it('closes a timed-out session and opens a new one', async () => {
    const { ports, sessions } = createFakeStore(now);
    const params = {
      tenantId: TENANT,
      conversationKey: KEY,
      agentId: AGENT,
      timeoutHours: 24,
    };
    const deps = makeDeps();

    const first = await resolveSession(ports, params, deps);
    advanceHours(25);
    const second = await resolveSession(ports, params, deps);

    expect(second.reused).toBe(false);
    expect(second.session.id).not.toBe(first.session.id);

    const old = sessions.get(first.session.id);
    expect(old?.status).toBe('closed');
    expect(old?.closedReason).toBe('timeout');
    expect(sessions.size).toBe(2);
  });

  it('serializes concurrent turns on the same conversation', async () => {
    const { ports, sessions } = createFakeStore(now);
    const params = {
      tenantId: TENANT,
      conversationKey: KEY,
      agentId: AGENT,
      timeoutHours: 24,
    };
    const deps = makeDeps();

    const [a, b] = await Promise.all([
      resolveSession(ports, params, deps),
      resolveSession(ports, params, deps),
    ]);

    expect(sessions.size).toBe(1);
    expect(a.session.id).toBe(b.session.id);
    expect([a.reused, b.reused].sort()).toEqual([false, true]);
  });

  it('keeps distinct conversations independent under one lock', async () => {
    const { ports, sessions } = createFakeStore(now);
    const deps = makeDeps();
    const base = { tenantId: TENANT, agentId: AGENT, timeoutHours: 24 };

    const [a, b] = await Promise.all([
      resolveSession(ports, { ...base, conversationKey: KEY }, deps),
      resolveSession(
        ports,
        { ...base, conversationKey: { channel: 'console', endUserId: 'phone:+905550000002' } },
        deps,
      ),
    ]);

    expect(a.reused).toBe(false);
    expect(b.reused).toBe(false);
    expect(a.session.id).not.toBe(b.session.id);
    expect(sessions.size).toBe(2);
  });
});
