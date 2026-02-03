-- ============================================================
-- DIAGNOSE bid_team_members REFERENCES
-- ============================================================
-- Run this to see exactly what's referencing the non-existent table
-- ============================================================

-- 1. Check for policies referencing bid_team_members
SELECT 
    'POLICY' as object_type,
    schemaname,
    tablename,
    policyname as name,
    COALESCE(definition, qual::text) as policy_definition
FROM pg_policies 
WHERE COALESCE(definition, qual::text) LIKE '%bid_team_members%'
ORDER BY tablename, policyname;

-- 2. Check for functions referencing bid_team_members
SELECT 
    'FUNCTION' as object_type,
    n.nspname as schemaname,
    '' as tablename,
    p.proname as name,
    pg_get_functiondef(p.oid) as definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE pg_get_functiondef(p.oid) LIKE '%bid_team_members%'
AND n.nspname = 'public'
ORDER BY p.proname;

-- 3. Check for views referencing bid_team_members
SELECT 
    'VIEW' as object_type,
    schemaname,
    viewname as name,
    COALESCE(definition, '') as view_definition
FROM pg_views
WHERE COALESCE(definition, '') LIKE '%bid_team_members%'
AND schemaname = 'public'
ORDER BY viewname;

-- 4. Check if proposal_team_members exists and has data
SELECT 
    'TABLE CHECK' as info,
    COUNT(*) as row_count
FROM public.proposal_team_members;
