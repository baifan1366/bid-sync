-- Verify RLS policy was applied correctly

-- 1. Check all policies on workspaces table
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual as using_expression
FROM pg_policies 
WHERE tablename = 'workspaces'
ORDER BY policyname;

-- 2. Check if RLS is enabled
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename = 'workspaces';

-- 3. Test the actual query that the browser is making
-- This simulates what Supabase client does
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims TO '{"sub": "d0499dba-43f2-4988-9e62-b1726e2eb7f1"}';

SELECT 
    project_id,
    lead_id,
    proposal_id,
    name
FROM workspaces
WHERE id = '45a99ca8-2066-44ff-b3e6-ea81588902e2';

-- Reset
RESET ROLE;
