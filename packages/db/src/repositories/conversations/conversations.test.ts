import { afterAll, beforeAll, describe, expect, it } from 'vitest';
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

describe('conversations tenant isolation', () => {
  it('same (channel, endUserId) yields distinct rows per tenant', async () => {
    const convA = await t.repos.conversations.getOrCreateConversation(seed.tenantA.id, {
      channel: 'console',
      endUserId: 'phone:+905550000001',
    });
    const convB = await t.repos.conversations.getOrCreateConversation(seed.tenantB.id, {
      channel: 'console',
      endUserId: 'phone:+905550000001',
    });
    expect(convA.id).not.toBe(convB.id);
  });

  it('getOrCreateConversation returns the existing row on repeat', async () => {
    const first = await t.repos.conversations.getOrCreateConversation(seed.tenantA.id, {
      channel: 'console',
      endUserId: 'phone:+905550000002',
    });
    const second = await t.repos.conversations.getOrCreateConversation(seed.tenantA.id, {
      channel: 'console',
      endUserId: 'phone:+905550000002',
    });
    expect(second.id).toBe(first.id);
  });

  it('getConversation hides the other tenant rows', async () => {
    const convA = await t.repos.conversations.getOrCreateConversation(seed.tenantA.id, {
      channel: 'console',
      endUserId: 'phone:+905550000003',
    });
    expect(
      await t.repos.conversations.getConversation(seed.tenantB.id, convA.id),
    ).toBeUndefined();
    expect(
      (await t.repos.conversations.getConversation(seed.tenantA.id, convA.id))?.id,
    ).toBe(convA.id);
  });
});
