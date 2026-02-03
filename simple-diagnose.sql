-- ============================================================
-- SIMPLE DIAGNOSTIC - Find bid_team_members references
-- ============================================================

-- Check policies
SELECT 
    schemaname,
    tablename,
    policyname
FROM pg_policies 
WHERE pg_get_expr(qual, (schemaname||'.'||tablename)::regclass) LIKE '%bid_team_members%'
   OR pg_get_expr(with_check, (schemaname||'.'||tablename)::regclass) LIKE '%bid_team_members%';

-- Check functions
SELECT 
    n.nspname as schema,
    p.proname as function_name
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE pg_get_functiondef(p.oid) LIKE '%bid_team_members%'
AND n.nspname = 'public';
