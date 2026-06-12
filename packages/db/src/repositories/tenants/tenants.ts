import { eq } from 'drizzle-orm';
import type { Db } from '../../client.js';
import { tenants, type Tenant } from '../../schema/tenants.js';
import { one } from '../../utils.js';
import type { UpsertTenantInput } from './tenants.types.js';

// The exception to the tenantId-first rule: these methods create or resolve
// tenants themselves.
export function createTenantsRepository(db: Db) {
  return {
    async upsertTenant(input: UpsertTenantInput): Promise<Tenant> {
      return one(
        await db
          .insert(tenants)
          .values(input)
          .onConflictDoUpdate({
            target: tenants.slug,
            set: { name: input.name, planId: input.planId },
          })
          .returning(),
      );
    },

    async getTenantBySlug(slug: string): Promise<Tenant | undefined> {
      const rows = await db
        .select()
        .from(tenants)
        .where(eq(tenants.slug, slug))
        .limit(1);
      return rows[0];
    },
  };
}
