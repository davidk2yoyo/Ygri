-- Project milestones: key dates linked to a project (track)
CREATE TABLE IF NOT EXISTS project_milestones (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id       uuid NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  track_stage_id uuid REFERENCES track_stages(id) ON DELETE SET NULL,
  type           text NOT NULL DEFAULT 'custom',
  label          text,          -- custom label override
  date           date NOT NULL,
  notes          text,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS project_milestones_track_id_idx ON project_milestones(track_id);
CREATE INDEX IF NOT EXISTS project_milestones_date_idx     ON project_milestones(date);

ALTER TABLE project_milestones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated full access" ON project_milestones
  FOR ALL USING (auth.role() = 'authenticated');

-- History of date changes for each milestone
CREATE TABLE IF NOT EXISTS milestone_date_history (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  milestone_id  uuid NOT NULL REFERENCES project_milestones(id) ON DELETE CASCADE,
  previous_date date NOT NULL,
  new_date      date NOT NULL,
  reason        text,
  changed_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS milestone_date_history_milestone_idx ON milestone_date_history(milestone_id);

ALTER TABLE milestone_date_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated full access" ON milestone_date_history
  FOR ALL USING (auth.role() = 'authenticated');

-- Add supplier association to milestones
ALTER TABLE project_milestones
  ADD COLUMN IF NOT EXISTS supplier_id uuid REFERENCES suppliers(id) ON DELETE SET NULL;
