-- Track read/unread state for @mention notifications
ALTER TABLE message_mentions ADD COLUMN IF NOT EXISTS read_at timestamptz;

-- Enable Realtime so the notification bell updates live when someone mentions you
ALTER PUBLICATION supabase_realtime ADD TABLE message_mentions;
