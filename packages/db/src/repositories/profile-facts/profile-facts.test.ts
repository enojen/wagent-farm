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

describe('profile facts tenant isolation', () => {
  it('same (endUserId, key) holds independent values per tenant', async () => {
    const endUserId = 'phone:+905550000011';
    await t.repos.profileFacts.upsertProfileFact(seed.tenantA.id, {
      endUserId,
      key: 'name',
      value: 'Ali',
    });
    await t.repos.profileFacts.upsertProfileFact(seed.tenantB.id, {
      endUserId,
      key: 'name',
      value: 'Veli',
    });

    const factsA = await t.repos.profileFacts.listProfileFacts(seed.tenantA.id, endUserId);
    const factsB = await t.repos.profileFacts.listProfileFacts(seed.tenantB.id, endUserId);
    expect(factsA.map((f) => f.value)).toEqual(['Ali']);
    expect(factsB.map((f) => f.value)).toEqual(['Veli']);
  });

  it('re-upsert updates the value in place (idempotent)', async () => {
    const endUserId = 'phone:+905550000012';
    const first = await t.repos.profileFacts.upsertProfileFact(seed.tenantA.id, {
      endUserId,
      key: 'vehicle_interest',
      value: 'suv',
    });
    const second = await t.repos.profileFacts.upsertProfileFact(seed.tenantA.id, {
      endUserId,
      key: 'vehicle_interest',
      value: 'sedan',
    });
    expect(second.id).toBe(first.id);
    expect(second.value).toBe('sedan');

    const facts = await t.repos.profileFacts.listProfileFacts(seed.tenantA.id, endUserId);
    expect(facts).toHaveLength(1);
  });
});
