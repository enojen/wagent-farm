import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TenantScopeError } from '../../errors.js';
import { createTestDb, seedTwoTenants } from '../../test/pglite.js';

let t: Awaited<ReturnType<typeof createTestDb>>;
let seed: Awaited<ReturnType<typeof seedTwoTenants>>;

beforeAll(async () => {
  t = await createTestDb();
  seed = await seedTwoTenants(t.repos);
});

afterAll(async () => {
  await t.close();
});

describe('usage events repository tenant isolation', () => {
  it('rejects a session owned by another tenant', async () => {
    const convA = await t.repos.conversations.getOrCreateConversation(seed.tenantA.id, {
      channel: 'console',
      endUserId: 'phone:+905550000010',
    });
    const sessA = await t.repos.sessions.createSession(seed.tenantA.id, {
      conversationId: convA.id,
      agentId: seed.agentA.id,
    });
    await expect(
      t.repos.usageEvents.insertUsageEvent(seed.tenantB.id, {
        kind: 'llm',
        sessionId: sessA.id,
      }),
    ).rejects.toThrow(TenantScopeError);
  });

  it('inserts a sessionless event under the caller tenant with defaults', async () => {
    const event = await t.repos.usageEvents.insertUsageEvent(seed.tenantB.id, {
      kind: 'message',
    });
    expect(event.tenantId).toBe(seed.tenantB.id);
    expect(event.sessionId).toBeNull();
    expect(event.tokensIn).toBe(0);
    expect(event.tokensOut).toBe(0);
  });

  it('persists token counts and cost estimate', async () => {
    const event = await t.repos.usageEvents.insertUsageEvent(seed.tenantA.id, {
      kind: 'llm',
      tokensIn: 120,
      tokensOut: 80,
      costEstimate: '0.001230',
    });
    expect(event.tokensIn).toBe(120);
    expect(event.tokensOut).toBe(80);
    expect(event.costEstimate).toBe('0.001230');
  });
});
