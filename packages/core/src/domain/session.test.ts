import { describe, expect, it } from 'vitest';
import { isExpired, type Session } from './session.js';

function sessionIdleSince(at: Date): Session {
  return {
    id: 's1',
    tenantId: 't1',
    conversationId: 'c1',
    agentId: 'a1',
    status: 'open',
    closedReason: null,
    createdAt: at,
    lastActivityAt: at,
    closedAt: null,
  };
}

describe('isExpired', () => {
  const last = new Date('2026-01-01T00:00:00Z');
  const session = sessionIdleSince(last);

  it('is false within the timeout window', () => {
    const at = new Date(last.getTime() + 23 * 3_600_000);
    expect(isExpired(session, at, 24)).toBe(false);
  });

  it('is false exactly at the timeout boundary', () => {
    const at = new Date(last.getTime() + 24 * 3_600_000);
    expect(isExpired(session, at, 24)).toBe(false);
  });

  it('is true once idle past the timeout', () => {
    const at = new Date(last.getTime() + 24 * 3_600_000 + 1);
    expect(isExpired(session, at, 24)).toBe(true);
  });
});
