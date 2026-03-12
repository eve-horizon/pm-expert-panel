-- Phase 2: Changeset System & Ingestion Pipeline
-- Migration: 20260313000000_phase2_changesets
--
-- Extends Phase 1 placeholder tables with columns required for the full
-- changeset lifecycle, per-item review, and Eve ingest integration.

-- ============================================================================
-- ingestion_sources: add Eve ingest tracking + error reporting
-- ============================================================================

ALTER TABLE ingestion_sources
  ADD COLUMN content_type   TEXT,
  ADD COLUMN eve_ingest_id  TEXT,
  ADD COLUMN eve_job_id     TEXT,
  ADD COLUMN file_size      BIGINT,
  ADD COLUMN error_message  TEXT;

ALTER TABLE ingestion_sources
  ALTER COLUMN status SET DEFAULT 'uploaded';

-- ============================================================================
-- changesets: link to source + track actor
-- ============================================================================

ALTER TABLE changesets
  ADD COLUMN source_id UUID REFERENCES ingestion_sources(id) ON DELETE SET NULL,
  ADD COLUMN actor     TEXT;

-- ============================================================================
-- changeset_items: per-item status for partial review + human-readable fields
-- ============================================================================

ALTER TABLE changeset_items
  ADD COLUMN status            TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN description       TEXT,
  ADD COLUMN display_reference TEXT;

-- ============================================================================
-- Indexes for common query patterns
-- ============================================================================

CREATE INDEX idx_changeset_items_changeset ON changeset_items (changeset_id);
CREATE INDEX idx_changesets_project_status ON changesets (project_id, status);
CREATE INDEX idx_ingestion_sources_project_status ON ingestion_sources (project_id, status);
