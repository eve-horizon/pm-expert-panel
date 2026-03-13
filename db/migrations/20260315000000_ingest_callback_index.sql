-- Index for Eve ingest callback lookups
--
-- The ingest-complete webhook looks up sources by eve_ingest_id.
-- Partial index excludes rows that were never sent to Eve.

CREATE INDEX idx_ingestion_sources_eve_ingest_id ON ingestion_sources (eve_ingest_id)
  WHERE eve_ingest_id IS NOT NULL;
