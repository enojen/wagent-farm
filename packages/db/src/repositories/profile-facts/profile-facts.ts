import { and, eq } from 'drizzle-orm';
import type { Db } from '../../client.js';
import { profileFacts, type ProfileFact } from '../../schema/profile-facts.js';
import { one } from '../../utils.js';
import type { UpsertProfileFactInput } from './profile-facts.types.js';

export function createProfileFactsRepository(db: Db) {
  return {
    async upsertProfileFact(
      tenantId: string,
      input: UpsertProfileFactInput,
    ): Promise<ProfileFact> {
      return one(
        await db
          .insert(profileFacts)
          .values({ tenantId, ...input })
          .onConflictDoUpdate({
            target: [profileFacts.tenantId, profileFacts.endUserId, profileFacts.key],
            set: { value: input.value, updatedAt: new Date() },
          })
          .returning(),
      );
    },

    async listProfileFacts(tenantId: string, endUserId: string): Promise<ProfileFact[]> {
      return db
        .select()
        .from(profileFacts)
        .where(
          and(eq(profileFacts.tenantId, tenantId), eq(profileFacts.endUserId, endUserId)),
        );
    },
  };
}
