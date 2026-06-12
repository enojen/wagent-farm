import { pgTable, text, timestamp, uuid, vector } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';

// Embedding width — must match the embedding model. text-embedding-3-small = 1536.
// Change here + one migration to swap models; stays under pgvector's 2000-dim HNSW limit.
export const EMBEDDING_DIMENSIONS = 1536;

// The raw source is kept for traceability; documents go through the ingestion pipeline.
export const documents = pgTable('documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  source: text('source').notNull(),
  title: text('title').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

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

export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;
export type Chunk = typeof chunks.$inferSelect;
export type NewChunk = typeof chunks.$inferInsert;
