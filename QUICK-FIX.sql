-- ============================================================
-- QUICK FIX: Remove bid_team_members References
-- ============================================================
-- Run this script to immediately fix the proposal submission error.
-- This is safe to run multiple times (idempotent).
-- ============================================================

BEGIN;

-- Drop the deprecated table and all its dependencies
DROP TABLE IF EXISTS public.bid_team_members CASCADE;

-- Drop old functions
DROP FUNCTION IF EXISTS public.is_project_lead(UUID, UUID);
DROP FUNCTION IF EXISTS public.is_team_member(UUID, UUID);

-- Create new helper functions using proposal_team_members
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

GRANT EXECUTE ON FUNCTION public.is_proposal_lead(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_proposal_team_member(UUID, UUID) TO authenticated;

COMMIT;

-- Verification
DO $$
DECLARE
    v_table_exists BOOLEAN;
    v_proposal_team_exists BOOLEAN;
BEGIN
    -- Check if bid_team_members still exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'bid_team_members'
    ) INTO v_table_exists;
    
    -- Check if proposal_team_members exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'proposal_team_members'
    ) INTO v_proposal_team_exists;
    
    RAISE NOTICE '==============================================';
    RAISE NOTICE 'QUICK FIX COMPLETED!';
    RAISE NOTICE '==============================================';
    RAISE NOTICE 'bid_team_members table exists: %', v_table_exists;
    RAISE NOTICE 'proposal_team_members table exists: %', v_proposal_team_exists;
    RAISE NOTICE '';
    
    IF NOT v_table_exists AND v_proposal_team_exists THEN
        RAISE NOTICE '✓ SUCCESS! You can now submit proposals.';
    ELSIF v_table_exists THEN
        RAISE WARNING '✗ bid_team_members table still exists. Check for errors above.';
    ELSIF NOT v_proposal_team_exists THEN
        RAISE WARNING '✗ proposal_team_members table does not exist. Run full schema.';
    END IF;
    
    RAISE NOTICE '==============================================';
END $$;
