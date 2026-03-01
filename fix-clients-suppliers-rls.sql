-- Fix RLS policies for clients and suppliers tables to allow reading from email threads page

-- Check current policies on clients table
-- DROP all existing policies and create a simple one that allows all access
DROP POLICY IF EXISTS "Enable read access for all users" ON clients;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON clients;
DROP POLICY IF EXISTS "Enable update for users based on email" ON clients;

-- Create simple policy that allows all operations for authenticated users
CREATE POLICY "Enable all access for authenticated users" ON clients
  FOR ALL USING (true);

-- Same for suppliers
DROP POLICY IF EXISTS "Enable read access for all users" ON suppliers;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON suppliers;
DROP POLICY IF EXISTS "Enable update for users based on email" ON suppliers;

CREATE POLICY "Enable all access for authenticated users" ON suppliers
  FOR ALL USING (true);
