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

describe('sessions tenant isolation', () => {
  it('createSession rejects a conversation owned by another tenant', async () => {
    const convA = await t.repos.conversations.getOrCreateConversation(seed.tenantA.id, {
      channel: 'console',
      endUserId: 'phone:+905550000004',
    });
    await expect(
      t.repos.sessions.createSession(seed.tenantB.id, {
        conversationId: convA.id,
        agentId: seed.agentB.id,
      }),
    ).rejects.toThrow(TenantScopeError);
  });

  it('createSession rejects an agent owned by another tenant', async () => {
    const convA = await t.repos.conversations.getOrCreateConversation(seed.tenantA.id, {
      channel: 'console',
      endUserId: 'phone:+905550000005',
    });
    await expect(
      t.repos.sessions.createSession(seed.tenantA.id, {
        conversationId: convA.id,
        agentId: seed.agentB.id,
      }),
    ).rejects.toThrow(TenantScopeError);
  });

  it('findOpenSession and closeSession never cross tenants', async () => {
    const convA = await t.repos.conversations.getOrCreateConversation(seed.tenantA.id, {
      channel: 'console',
      endUserId: 'phone:+905550000006',
    });
    const sessA = await t.repos.sessions.createSession(seed.tenantA.id, {
      conversationId: convA.id,
      agentId: seed.agentA.id,
    });

    expect(
      await t.repos.sessions.findOpenSession(seed.tenantB.id, convA.id),
    ).toBeUndefined();

    expect(
      await t.repos.sessions.closeSession(seed.tenantB.id, sessA.id, 'manual'),
    ).toBeUndefined();
    const stillOpen = await t.repos.sessions.findOpenSession(seed.tenantA.id, convA.id);
    expect(stillOpen?.id).toBe(sessA.id);
  });

  it('closeSession persists the reason and a second close returns undefined', async () => {
    const convA = await t.repos.conversations.getOrCreateConversation(seed.tenantA.id, {
      channel: 'console',
      endUserId: 'phone:+905550000007',
    });
    const sessA = await t.repos.sessions.createSession(seed.tenantA.id, {
      conversationId: convA.id,
      agentId: seed.agentA.id,
    });

    const closed = await t.repos.sessions.closeSession(seed.tenantA.id, sessA.id, 'handoff');
    expect(closed?.status).toBe('closed');
    expect(closed?.closedReason).toBe('handoff');

    expect(
      await t.repos.sessions.closeSession(seed.tenantA.id, sessA.id, 'manual'),
    ).toBeUndefined();
    expect(
      await t.repos.sessions.findOpenSession(seed.tenantA.id, convA.id),
    ).toBeUndefined();
  });
});
