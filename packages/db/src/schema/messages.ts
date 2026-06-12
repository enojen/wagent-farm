import { jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { messageRole } from './enums.js';
import { sessions } from './sessions.js';
import { tenants } from './tenants.js';

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

export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
