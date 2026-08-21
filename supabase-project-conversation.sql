-- ============================================================
-- PROJECT-LEVEL CONVERSATION (Slack-like) — Foundation
-- One conversation per project (track), messages optionally tagged
-- to a stage/quotation. Additive only — does not touch stage_comments
-- or its RPCs, which are left as-is and simply stop being called by
-- new frontend code once the Conversation tab replaces the old panel.
-- Run this in Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS project_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id uuid NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  track_stage_id uuid REFERENCES track_stages(id) ON DELETE SET NULL,
  quotation_id uuid REFERENCES quotations(id) ON DELETE SET NULL,
  user_id uuid REFERENCES profiles(id),
  message_type text NOT NULL DEFAULT 'message' CHECK (message_type IN ('message', 'system_event', 'ai_message')),
  body text,
  metadata jsonb NOT NULL DEFAULT '{}',
  parent_message_id uuid REFERENCES project_messages(id) ON DELETE CASCADE,
  edited_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS message_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES project_messages(id) ON DELETE CASCADE,
  file_path text NOT NULL,
  file_name text,
  file_size integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS message_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES project_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id),
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(message_id, user_id, emoji)
);

CREATE TABLE IF NOT EXISTS message_mentions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES project_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE project_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_mentions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all_project_messages" ON project_messages FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_message_attachments" ON message_attachments FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_message_reactions" ON message_reactions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_message_mentions" ON message_mentions FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Table-level GRANTs (required on this project — RLS alone is not enough)
GRANT SELECT, INSERT, UPDATE, DELETE ON project_messages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON message_attachments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON message_reactions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON message_mentions TO authenticated;

CREATE INDEX IF NOT EXISTS idx_project_messages_track_id ON project_messages(track_id, created_at);
CREATE INDEX IF NOT EXISTS idx_project_messages_parent ON project_messages(parent_message_id);
CREATE INDEX IF NOT EXISTS idx_message_attachments_message_id ON message_attachments(message_id);
CREATE INDEX IF NOT EXISTS idx_message_reactions_message_id ON message_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_message_mentions_message_id ON message_mentions(message_id);

-- Enable Realtime on the messages table
ALTER PUBLICATION supabase_realtime ADD TABLE project_messages;

-- One-time backfill: copy existing stage_comments into the new project-level
-- feed, tagged with their originating stage. stage_comments itself is left
-- untouched — nothing is deleted or migrated destructively.
INSERT INTO project_messages (id, track_id, track_stage_id, user_id, message_type, body, created_at)
SELECT sc.id, ts.track_id, sc.track_stage_id, sc.user_id, 'message', sc.body, sc.created_at
FROM stage_comments sc
JOIN track_stages ts ON ts.id = sc.track_stage_id
ON CONFLICT (id) DO NOTHING;
