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

describe('messages tenant isolation', () => {
  it('insertMessage rejects a session owned by another tenant', async () => {
    const convA = await t.repos.conversations.getOrCreateConversation(seed.tenantA.id, {
      channel: 'console',
      endUserId: 'phone:+905550000008',
    });
    const sessA = await t.repos.sessions.createSession(seed.tenantA.id, {
      conversationId: convA.id,
      agentId: seed.agentA.id,
    });
    await expect(
      t.repos.messages.insertMessage(seed.tenantB.id, {
        sessionId: sessA.id,
        role: 'user',
        content: 'smuggled',
      }),
    ).rejects.toThrow(TenantScopeError);
  });

  it('listSessionMessages returns ordered rows for the owner, none for others', async () => {
    const convA = await t.repos.conversations.getOrCreateConversation(seed.tenantA.id, {
      channel: 'console',
      endUserId: 'phone:+905550000009',
    });
    const sessA = await t.repos.sessions.createSession(seed.tenantA.id, {
      conversationId: convA.id,
      agentId: seed.agentA.id,
    });
    await t.repos.messages.insertMessage(seed.tenantA.id, {
      sessionId: sessA.id,
      role: 'user',
      content: 'hello',
    });
    await t.repos.messages.insertMessage(seed.tenantA.id, {
      sessionId: sessA.id,
      role: 'assistant',
      content: 'hi there',
      envelope: { channel: 'console' },
    });

    const mine = await t.repos.messages.listSessionMessages(seed.tenantA.id, sessA.id);
    expect(mine.map((m) => m.content)).toEqual(['hello', 'hi there']);
    expect(mine[1]?.envelope).toEqual({ channel: 'console' });

    expect(
      await t.repos.messages.listSessionMessages(seed.tenantB.id, sessA.id),
    ).toEqual([]);
  });
});
