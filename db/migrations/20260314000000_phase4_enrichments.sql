-- Phase 4: Polish & Production Hardening
-- Migration: 20260314000000_phase4_enrichments
--
-- Adds lifecycle status, source provenance, handoff metadata, cross-cutting
-- flag, full-text search indexes, and composite performance indexes.

-- ============================================================================
-- Task lifecycle status (current/proposed/discontinued)
-- ============================================================================

ALTER TABLE tasks ADD COLUMN lifecycle text
  CHECK (lifecycle IN ('current', 'proposed', 'discontinued'))
  DEFAULT 'current';

-- Task source provenance
ALTER TABLE tasks ADD COLUMN source_type text
  CHECK (source_type IN ('research', 'transcript', 'scope-doc', 'both', 'ingestion'));

-- Task source excerpt (the specific text that spawned this task)
ALTER TABLE tasks ADD COLUMN source_excerpt text;

-- ============================================================================
-- Step-task handoff metadata
-- ============================================================================

ALTER TABLE step_tasks ADD COLUMN role_in_journey text
  CHECK (role_in_journey IN ('owner', 'handoff', 'shared'))
  DEFAULT 'owner';

ALTER TABLE step_tasks ADD COLUMN handoff_label text;

-- ============================================================================
-- Cross-cutting question flag
-- ============================================================================

ALTER TABLE questions ADD COLUMN is_cross_cutting boolean DEFAULT false;

-- ============================================================================
-- GIN indexes for full-text search
-- ============================================================================

CREATE INDEX idx_tasks_fts ON tasks
  USING GIN (to_tsvector('english', coalesce(title,'') || ' ' || coalesce(user_story,'')));

CREATE INDEX idx_questions_fts ON questions
  USING GIN (to_tsvector('english', coalesce(question,'') || ' ' || coalesce(answer,'')));

-- ============================================================================
-- Composite performance indexes
-- ============================================================================

CREATE INDEX idx_tasks_project_org ON tasks (project_id, org_id);
CREATE INDEX idx_tasks_lifecycle ON tasks (project_id, lifecycle);
CREATE INDEX idx_tasks_source_type ON tasks (project_id, source_type);
CREATE INDEX idx_steps_activity ON steps (activity_id);
CREATE INDEX idx_step_tasks_step ON step_tasks (step_id);
CREATE INDEX idx_step_tasks_role_in_journey ON step_tasks (role_in_journey);
CREATE INDEX idx_questions_project ON questions (project_id, org_id);
CREATE INDEX idx_questions_cross_cutting ON questions (project_id)
  WHERE is_cross_cutting;
CREATE INDEX idx_audit_log_project ON audit_log (project_id, org_id);
CREATE INDEX idx_audit_log_entity ON audit_log (project_id, entity_type, created_at DESC);
