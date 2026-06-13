import { pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';
import { agents } from './agents.js';
import { closedReason, sessionStatus } from './enums.js';
import { conversations } from './conversations.js';
import { tenants } from './tenants.js';

// The session: one agent handling one "current concern" = one workflow. Sequential agents
// in a conversation = sequential sessions; an agent→agent transfer closes with `handoff`.
export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  conversationId: uuid('conversation_id')
    .notNull()
    .references(() => conversations.id, { onDelete: 'cascade' }),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  agentId: uuid('agent_id')
    .notNull()
    .references(() => agents.id, { onDelete: 'cascade' }),
  status: sessionStatus('status').notNull().default('open'),
  closedReason: closedReason('closed_reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  lastActivityAt: timestamp('last_activity_at', { withTimezone: true }).defaultNow().notNull(),
  closedAt: timestamp('closed_at', { withTimezone: true }),
});

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
