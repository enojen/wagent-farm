-- pgvector must exist before the chunks table's vector column is created.
CREATE EXTENSION IF NOT EXISTS vector;
