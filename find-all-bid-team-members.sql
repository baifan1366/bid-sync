-- Find ALL remaining bid_team_members references
-- Run this to see what still needs to be fixed

SELECT 
    schemaname,
    tablename,
    policyname,
    'DROP POLICY IF EXISTS "' || policyname || '" ON ' || schemaname || '.' || tablename || ';' as drop_command
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
