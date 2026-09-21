-- Fix RLS policies for email_threads to allow reading related clients/suppliers and updating
-- This matches the pattern used in clients/suppliers tables and allows n8n integration to work

-- Drop all existing policies
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON email_threads;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON email_threads;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON email_threads;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON email_threads;
DROP POLICY IF EXISTS "Enable all access for service role" ON email_threads;
DROP POLICY IF EXISTS "Enable read for authenticated users" ON email_threads;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON email_threads;

-- Create simple policy that allows all operations (matches clients/suppliers pattern)
CREATE POLICY "Enable all access for authenticated users" ON email_threads
  FOR ALL USING (true);

-- Same for email_messages
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON email_messages;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON email_messages;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON email_messages;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON email_messages;
DROP POLICY IF EXISTS "Enable all access for service role" ON email_messages;
DROP POLICY IF EXISTS "Enable read for authenticated users" ON email_messages;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON email_messages;

CREATE POLICY "Enable all access for authenticated users" ON email_messages
  FOR ALL USING (true);
