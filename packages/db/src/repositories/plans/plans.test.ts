import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDb } from '../../test/pglite.js';

let t: Awaited<ReturnType<typeof createTestDb>>;

beforeAll(async () => {
  t = await createTestDb();
});

afterAll(async () => {
  await t.close();
});

describe('plans repository', () => {
  it('upsertPlan is idempotent and updates limits', async () => {
    const first = await t.repos.plans.upsertPlan({
      name: 'starter',
      monthlyTokens: 100,
      messagesPerMinute: 5,
    });
    const second = await t.repos.plans.upsertPlan({
      name: 'starter',
      monthlyTokens: 200,
      messagesPerMinute: 10,
    });
    expect(second.id).toBe(first.id);
    expect(second.monthlyTokens).toBe(200);
  });
});
