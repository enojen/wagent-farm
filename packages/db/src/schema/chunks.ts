import { pgTable, text, timestamp, uuid, vector } from 'drizzle-orm/pg-core';
import { documents } from './documents.js';
import { tenants } from './tenants.js';

// Embedding width — must match the embedding model. text-embedding-3-small = 1536.
// Change here + one migration to swap models; stays under pgvector's 2000-dim HNSW limit.
export const EMBEDDING_DIMENSIONS = 1536;

// One vector namespace per tenant; every retrieval carries a mandatory tenant filter (§12.2).
export const chunks = pgTable('chunks', {
  id: uuid('id').primaryKey().defaultRandom(),
  documentId: uuid('document_id')
    .notNull()
    .references(() => documents.id, { onDelete: 'cascade' }),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  namespace: text('namespace').notNull(),
  content: text('content').notNull(),
  embedding: vector('embedding', { dimensions: EMBEDDING_DIMENSIONS }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export type Chunk = typeof chunks.$inferSelect;
export type NewChunk = typeof chunks.$inferInsert;
