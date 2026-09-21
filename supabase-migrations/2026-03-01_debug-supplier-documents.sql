-- Debug supplier_documents table permissions
-- Run this in Supabase Dashboard > SQL Editor

-- 1. Check which schema the table is in
SELECT
    schemaname,
    tablename,
    tableowner,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename = 'supplier_documents';

-- 2. Check table privileges
SELECT
    grantee,
    privilege_type
FROM information_schema.role_table_grants
WHERE table_name = 'supplier_documents';

-- 3. Grant all privileges to anon and authenticated roles
GRANT ALL ON supplier_documents TO anon;
GRANT ALL ON supplier_documents TO authenticated;
GRANT ALL ON supplier_documents TO service_role;

-- 4. Also grant usage on the sequence (for ID generation)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- 5. Verify grants were applied
SELECT
    grantee,
    privilege_type
FROM information_schema.role_table_grants
WHERE table_name = 'supplier_documents'
ORDER BY grantee, privilege_type;
