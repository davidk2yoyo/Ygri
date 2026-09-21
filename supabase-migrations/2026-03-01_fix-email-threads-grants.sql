-- Fix table-level GRANT permissions for email_threads
-- The RLS policy exists but table permissions were missing

-- Grant all permissions to authenticated users
GRANT ALL ON email_threads TO authenticated;
GRANT ALL ON email_threads TO anon;

-- Same for email_messages
GRANT ALL ON email_messages TO authenticated;
GRANT ALL ON email_messages TO anon;

-- Also grant on the sequence if it exists
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon;
