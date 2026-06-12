import { jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { agents } from './agents.js';
import { channel, closedReason, messageRole, sessionStatus } from './enums.js';
import { tenants } from './tenants.js';

// The thread: (tenant, channel, end_user) — never closes (project-notes §5).
export const conversations = pgTable(
  'conversations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    channel: channel('channel').notNull(),
    endUserId: text('end_user_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('conversations_tenant_channel_user_uq').on(t.tenantId, t.channel, t.endUserId),
  ],
);

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
});

// Envelope-shaped record of every turn. `envelope` holds attachments / capability flags.
export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id')
    .notNull()
    .references(() => sessions.id, { onDelete: 'cascade' }),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  role: messageRole('role').notNull(),
  content: text('content').notNull(),
  envelope: jsonb('envelope'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
