import { integer, numeric, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';
import { usageKind } from './enums.js';
import { sessions } from './conversations.js';
import { tenants } from './tenants.js';

// Metered from the first turn, never retroactively (project-notes §3). One row per event.
export const usageEvents = pgTable('usage_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  sessionId: uuid('session_id').references(() => sessions.id, { onDelete: 'set null' }),
  kind: usageKind('kind').notNull(),
  tokensIn: integer('tokens_in').notNull().default(0),
  tokensOut: integer('tokens_out').notNull().default(0),
  costEstimate: numeric('cost_estimate', { precision: 12, scale: 6 }),
  ts: timestamp('ts', { withTimezone: true }).defaultNow().notNull(),
});

export type UsageEvent = typeof usageEvents.$inferSelect;
export type NewUsageEvent = typeof usageEvents.$inferInsert;
