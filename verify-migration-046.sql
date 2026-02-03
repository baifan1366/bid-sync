-- Verify Migration 046 was applied correctly

\echo '=== Checking if migration 046 was applied ==='
\echo ''

-- Check if old policy was dropped
\echo '1. Checking if old policy "workspaces_owner_select" was dropped:'
SELECT 
    CASE 
        WHEN COUNT(*) = 0 THEN '✅ Old policy dropped successfully'
        ELSE '❌ Old policy still exists - migration may have failed'
    END as status
FROM pg_policies 
WHERE tablename = 'workspaces' 
AND policyname = 'workspaces_owner_select';

\echo ''

-- Check if new policy was created
\echo '2. Checking if new policy "workspaces_team_select" was created:'
SELECT 
    CASE 
        WHEN COUNT(*) = 1 THEN '✅ New policy created successfully'
        ELSE '❌ New policy not found - migration may have failed'
    END as status
FROM pg_policies 
WHERE tablename = 'workspaces' 
AND policyname = 'workspaces_team_select';

\echo ''

-- Show the new policy details
\echo '3. New policy details:'
SELECT 
    policyname,
    cmd as command,
    permissive,
    qual as using_clause
FROM pg_policies 
WHERE tablename = 'workspaces' 
AND policyname = 'workspaces_team_select';

\echo ''

-- Check all current policies on workspaces
\echo '4. All current policies on workspaces table:'
SELECT 
    policyname,
    cmd as command
FROM pg_policies 
WHERE tablename = 'workspaces'
ORDER BY policyname;

\echo ''
\echo '=== Migration 046 Verification Complete ==='
\echo ''
\echo 'Expected results:'
\echo '  - Old policy "workspaces_owner_select" should be dropped'
\echo '  - New policy "workspaces_team_select" should exist'
\echo '  - New policy should allow SELECT for leads and team members'
