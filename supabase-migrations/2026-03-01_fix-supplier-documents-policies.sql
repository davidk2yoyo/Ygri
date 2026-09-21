-- Fix supplier_documents RLS policies
-- Run this in Supabase Dashboard > SQL Editor

-- First, disable RLS temporarily to check if table exists
ALTER TABLE supplier_documents DISABLE ROW LEVEL SECURITY;

-- Re-enable RLS
ALTER TABLE supplier_documents ENABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies (including old ones)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'supplier_documents') LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON supplier_documents';
    END LOOP;
END $$;

-- Create policies that allow ALL roles (not just authenticated)
-- This is more permissive but will help us debug

CREATE POLICY "Enable read access for all users" ON supplier_documents
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for all users" ON supplier_documents
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for all users" ON supplier_documents
    FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Enable delete for all users" ON supplier_documents
    FOR DELETE USING (true);

-- Verify policies were created
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies
WHERE tablename = 'supplier_documents'
ORDER BY policyname;
