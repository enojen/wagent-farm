import type { Db } from '../../client.js';
import { usageEvents, type UsageEvent } from '../../schema/usage-events.js';
import { one } from '../../utils.js';
import { assertSessionOwned } from '../sessions/sessions.guard.js';
import type { InsertUsageEventInput } from './usage-events.types.js';

export function createUsageEventsRepository(db: Db) {
  return {
    async insertUsageEvent(
      tenantId: string,
      input: InsertUsageEventInput,
    ): Promise<UsageEvent> {
      if (input.sessionId !== undefined) {
        await assertSessionOwned(db, tenantId, input.sessionId);
      }
      return one(
        await db
          .insert(usageEvents)
          .values({
            tenantId,
            kind: input.kind,
            sessionId: input.sessionId ?? null,
            tokensIn: input.tokensIn ?? 0,
            tokensOut: input.tokensOut ?? 0,
            costEstimate: input.costEstimate ?? null,
          })
          .returning(),
      );
    },
  };
}
