-- Ygri Copilot — persistent, per-user chat sessions (so context survives a
-- page reload / reopening the widget, instead of resetting every time).
-- Additive only.

CREATE TABLE IF NOT EXISTS ai_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id),
  title text,
  page_context jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ai_conversations_user_updated ON ai_conversations(user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS ai_conversation_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id),
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text,
  plan_id uuid REFERENCES ai_action_plans(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ai_conversation_messages_conv_created ON ai_conversation_messages(conversation_id, created_at);

ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_conversation_messages ENABLE ROW LEVEL SECURITY;

-- Unlike ai_action_plans/ai_executions, chat history is genuinely personal —
-- no "staff can view others'" exception here.
DROP POLICY IF EXISTS "own conversations" ON ai_conversations;
CREATE POLICY "own conversations" ON ai_conversations
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "own conversation messages" ON ai_conversation_messages;
CREATE POLICY "own conversation messages" ON ai_conversation_messages
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON ai_conversations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ai_conversation_messages TO authenticated;
