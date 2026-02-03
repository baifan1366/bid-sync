-- ============================================================
-- VERIFY NO bid_team_members REFERENCES
-- ============================================================
-- Run this script to verify that all bid_team_members references
-- have been successfully removed from your database.
-- ============================================================

-- Check for the table
SELECT 
    'TABLE' as object_type,
    table_name,
    'EXISTS - SHOULD BE REMOVED!' as status
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'bid_team_members'

UNION ALL

-- Check for policies
SELECT 
    'POLICY' as object_type,
    schemaname || '.' || tablename || '.' || policyname as table_name,
    'REFERENCES bid_team_members - SHOULD BE REMOVED!' as status
FROM pg_policies 
WHERE schemaname = 'public'
AND (
    pg_get_expr(qual, (schemaname||'.'||tablename)::regclass) LIKE '%bid_team_members%'
    OR pg_get_expr(with_check, (schemaname||'.'||tablename)::regclass) LIKE '%bid_team_members%'
)

UNION ALL

-- Check for functions
SELECT 
    'FUNCTION' as object_type,
    n.nspname || '.' || p.proname as table_name,
    'REFERENCES bid_team_members - SHOULD BE REMOVED!' as status
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND pg_get_functiondef(p.oid) LIKE '%bid_team_members%'

UNION ALL

-- Check for views
SELECT 
    'VIEW' as object_type,
    schemaname || '.' || viewname as table_name,
    'REFERENCES bid_team_members - SHOULD BE REMOVED!' as status
FROM pg_views
WHERE schemaname = 'public'
AND definition LIKE '%bid_team_members%';

-- If this query returns no rows, all references have been successfully removed!
-- Expected output: 0 rows
