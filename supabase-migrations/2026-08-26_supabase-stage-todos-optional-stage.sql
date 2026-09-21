-- Ygri CRM — allow stage_todos to exist without a project stage, for
-- genuine internal/team tasks not tied to any client/project/pipeline.
-- Additive, non-destructive: every existing row already has a non-null
-- track_stage_id, so this affects zero data.
--
-- add_stage_todo() is a bare passthrough insert (confirmed by reading its
-- live body) — it already accepts p_track_stage_id: null cleanly once the
-- column allows it, no RPC change needed. update_stage_todo() never
-- touches track_stage_id at all.

ALTER TABLE stage_todos ALTER COLUMN track_stage_id DROP NOT NULL;
