-- ============================================================
-- FIX POLICIES THAT REFERENCE bid_team_members
-- ============================================================
-- This script finds and removes all policies that reference
-- the non-existent bid_team_members table
-- ============================================================

BEGIN;

-- ============================================================
-- 1. DROP ALL POLICIES THAT REFERENCE bid_team_members
-- ============================================================

-- Find and drop all policies with bid_team_members references
DO $$
DECLARE
    policy_record RECORD;
BEGIN
    FOR policy_record IN 
        SELECT schemaname, tablename, policyname
        FROM pg_policies 
        WHERE pg_get_expr(qual, (schemaname||'.'||tablename)::regclass) LIKE '%bid_team_members%'
           OR pg_get_expr(with_check, (schemaname||'.'||tablename)::regclass) LIKE '%bid_team_members%'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', 
            policy_record.policyname, 
            policy_record.schemaname, 
            policy_record.tablename
        );
        RAISE NOTICE 'Dropped policy: %.%.%', 
            policy_record.schemaname, 
            policy_record.tablename, 
            policy_record.policyname;
    END LOOP;
END $$;

-- ============================================================
-- 2. DROP FUNCTIONS THAT REFERENCE bid_team_members
-- ============================================================

DROP FUNCTION IF EXISTS public.is_project_lead(UUID, UUID);
DROP FUNCTION IF EXISTS public.is_team_member(UUID, UUID);

-- ============================================================
-- 3. CREATE NEW HELPER FUNCTIONS
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_proposal_lead(p_proposal_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.proposal_team_members 
        WHERE proposal_id = p_proposal_id 
        AND user_id = p_user_id 
        AND role = 'lead'
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_proposal_team_member(p_proposal_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.proposal_team_members 
        WHERE proposal_id = p_proposal_id 
        AND user_id = p_user_id
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMIT;

-- ============================================================
-- VERIFICATION
-- ============================================================

-- Check for any remaining bid_team_members references in policies
SELECT 
    'REMAINING POLICY' as issue,
    schemaname,
    tablename,
    policyname
FROM pg_policies 
WHERE pg_get_expr(qual, (schemaname||'.'||tablename)::regclass) LIKE '%bid_team_members%'
   OR pg_get_expr(with_check, (schemaname||'.'||tablename)::regclass) LIKE '%bid_team_members%';

-- Check for any remaining bid_team_members references in functions
SELECT 
    'REMAINING FUNCTION' as issue,
    n.nspname as schemaname,
    p.proname as function_name
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE pg_get_functiondef(p.oid) LIKE '%bid_team_members%'
AND n.nspname = 'public';

-- Success message
DO $$
BEGIN
    RAISE NOTICE '==============================================';
    RAISE NOTICE 'Removed all bid_team_members policy references!';
    RAISE NOTICE 'Run the verification queries above to confirm.';
    RAISE NOTICE '==============================================';
END $$;
