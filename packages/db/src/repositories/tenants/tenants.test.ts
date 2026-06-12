import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDb } from '../../test/pglite.js';

let t: Awaited<ReturnType<typeof createTestDb>>;

beforeAll(async () => {
  t = await createTestDb();
});

afterAll(async () => {
  await t.close();
});

describe('tenants repository', () => {
  it('upsertTenant is idempotent and getTenantBySlug round-trips', async () => {
    const plan = await t.repos.plans.upsertPlan({
      name: 'pro',
      monthlyTokens: 1000,
      messagesPerMinute: 30,
    });
    const first = await t.repos.tenants.upsertTenant({
      slug: 'acme',
      name: 'Acme',
      planId: plan.id,
    });
    const second = await t.repos.tenants.upsertTenant({
      slug: 'acme',
      name: 'Acme Inc',
      planId: plan.id,
    });
    expect(second.id).toBe(first.id);
    expect(second.name).toBe('Acme Inc');

    const found = await t.repos.tenants.getTenantBySlug('acme');
    expect(found?.id).toBe(first.id);
    expect(await t.repos.tenants.getTenantBySlug('nope')).toBeUndefined();
  });
});
