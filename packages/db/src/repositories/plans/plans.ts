import type { Db } from '../../client.js';
import { plans, type Plan } from '../../schema/plans.js';
import { one } from '../../utils.js';
import type { UpsertPlanInput } from './plans.types.js';

// Platform-level billing data — plans carry no tenant_id, so no tenantId arg.
export function createPlansRepository(db: Db) {
  return {
    async upsertPlan(input: UpsertPlanInput): Promise<Plan> {
      return one(
        await db
          .insert(plans)
          .values(input)
          .onConflictDoUpdate({
            target: plans.name,
            set: {
              monthlyTokens: input.monthlyTokens,
              messagesPerMinute: input.messagesPerMinute,
            },
          })
          .returning(),
      );
    },
  };
}
