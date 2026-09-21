-- Fix table-level GRANT permissions for profiles table
-- Needed to display user names in comments timeline

-- Grant read permissions to authenticated users
GRANT SELECT ON profiles TO authenticated;
GRANT SELECT ON profiles TO anon;

-- Also ensure RLS policy allows reading
DROP POLICY IF EXISTS "Enable read access for all users" ON profiles;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON profiles;

CREATE POLICY "Enable read access for all users" ON profiles
  FOR SELECT USING (true);
