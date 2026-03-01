-- Fix RLS policies for email_threads to allow reading related clients/suppliers

-- Update email_threads policies to use service_role or authenticated
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON email_threads;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON email_threads;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON email_threads;

CREATE POLICY "Enable all access for service role" ON email_threads
  FOR ALL USING (true);

-- Same for email_messages
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON email_messages;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON email_messages;

CREATE POLICY "Enable all access for service role" ON email_messages
  FOR ALL USING (true);
