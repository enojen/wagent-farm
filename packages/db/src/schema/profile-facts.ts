import { pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';

// Durable per-user facts (name, last order, vehicle interest) — a separate memory block (§4).
export const profileFacts = pgTable(
  'profile_facts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    endUserId: text('end_user_id').notNull(),
    key: text('key').notNull(),
    value: text('value').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex('profile_facts_tenant_user_key_uq').on(t.tenantId, t.endUserId, t.key)],
);

export type ProfileFact = typeof profileFacts.$inferSelect;
export type NewProfileFact = typeof profileFacts.$inferInsert;
