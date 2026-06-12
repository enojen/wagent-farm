import { bigint, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

// Package definition: limits live as data, never as code (project-notes §3).
// Per tenant — a tenant's agents share its plan/limits.
export const plans = pgTable('plans', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
  monthlyTokens: bigint('monthly_tokens', { mode: 'number' }).notNull(),
  messagesPerMinute: integer('messages_per_minute').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export type Plan = typeof plans.$inferSelect;
export type NewPlan = typeof plans.$inferInsert;
