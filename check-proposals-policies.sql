-- Check the actual definition of proposals policies
-- This will show us which ones reference bid_team_members

SELECT 
    policyname,
    cmd as policy_type,
    qual::text as using_clause,
    with_check::text as with_check_clause
FROM pg_policies
WHERE tablename = 'proposals'
AND schemaname = 'public'
ORDER BY policyname;
