-- ============================================================
-- MIGRATION 030: DROP DEPRECATED bid_team_members TABLE
-- ============================================================
-- 
-- This migration removes the deprecated bid_team_members table
-- after successful migration to proposal_team_members.
--
-- IMPORTANT: Only run this after:
-- 1. Migration 029 has been executed successfully
-- 2. All code has been updated to use proposal_team_members
-- 3. Data has been verified in proposal_team_members
--
-- BACKUP: Ensure you have a recent database backup before running!
-- ============================================================

BEGIN;

-- Step 1: Verify proposal_team_members table exists and has data
DO $$
DECLARE
    v_ptm_count INTEGER;
    v_btm_count INTEGER;
    v_btm_exists BOOLEAN;
BEGIN
    -- Check if bid_team_members table exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'bid_team_members'
    ) INTO v_btm_exists;
    
    IF NOT v_btm_exists THEN
        RAISE NOTICE 'bid_team_members table does not exist. Nothing to drop.';
        RETURN;
    END IF;
    
    -- Check if proposal_team_members exists and has data
    SELECT COUNT(*) INTO v_ptm_count 
    FROM public.proposal_team_members;
    
    -- Check old table count
    SELECT COUNT(*) INTO v_btm_count 
    FROM public.bid_team_members;
    
    RAISE NOTICE 'proposal_team_members count: %', v_ptm_count;
    RAISE NOTICE 'bid_team_members count: %', v_btm_count;
    
    -- Safety check: ensure new table has data if old table had data
    IF v_btm_count > 0 AND v_ptm_count = 0 THEN
        RAISE EXCEPTION 'SAFETY CHECK FAILED: bid_team_members has data but proposal_team_members is empty. Migration 029 may not have run correctly.';
    END IF;
    
    RAISE NOTICE 'Safety check passed. Proceeding with table drop.';
END $$;

-- Step 2: Drop all RLS policies on bid_team_members
DROP POLICY IF EXISTS "bid_team_members_read" ON public.bid_team_members;
DROP POLICY IF EXISTS "bid_team_members_write" ON public.bid_team_members;
DROP POLICY IF EXISTS "bid_team_members_select" ON public.bid_team_members;
DROP POLICY IF EXISTS "bid_team_members_insert" ON public.bid_team_members;
DROP POLICY IF EXISTS "bid_team_members_update" ON public.bid_team_members;
DROP POLICY IF EXISTS "bid_team_members_delete" ON public.bid_team_members;
DROP POLICY IF EXISTS "bid_team_members_lead_insert" ON public.bid_team_members;
DROP POLICY IF EXISTS "bid_team_members_lead_delete" ON public.bid_team_members;

-- Step 3: Drop all indexes on bid_team_members
DROP INDEX IF EXISTS public.idx_bid_team_project;
DROP INDEX IF EXISTS public.idx_bid_team_user;
DROP INDEX IF EXISTS public.idx_bid_team_members_project_role;
DROP INDEX IF EXISTS public.idx_bid_team_members_user_role;

-- Step 4: Drop the bid_team_members table
DROP TABLE IF EXISTS public.bid_team_members CASCADE;

-- Step 5: Log the migration (optional - only if admin_actions table exists)
DO $$
BEGIN
    -- Create a log entry in admin_actions if the table exists
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'admin_actions'
    ) THEN
        INSERT INTO public.admin_actions (
            admin_id,
            action_type,
            reason,
            new_value,
            created_at
        ) VALUES (
            '00000000-0000-0000-0000-000000000000'::UUID,
            'DROP_DEPRECATED_TABLE',
            'Dropped bid_team_members table after migration to proposal_team_members',
            jsonb_build_object(
                'table_name', 'bid_team_members',
                'migration', '030_drop_bid_team_members',
                'timestamp', NOW()
            ),
            NOW()
        );
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Could not log to admin_actions: %', SQLERRM;
END $$;

COMMIT;

-- Success message
DO $$
BEGIN
    RAISE NOTICE '==============================================';
    RAISE NOTICE 'Migration 030 completed successfully!';
    RAISE NOTICE 'bid_team_members table has been dropped.';
    RAISE NOTICE 'All team management now uses proposal_team_members.';
    RAISE NOTICE '==============================================';
END $$;

-- ============================================================
-- VERIFICATION QUERIES
-- ============================================================
-- Run these after migration to verify:
--
-- 1. Check table no longer exists:
--    SELECT * FROM information_schema.tables 
--    WHERE table_name = 'bid_team_members';
--    (Should return 0 rows)
--
-- 2. Check proposal_team_members has data:
--    SELECT COUNT(*) FROM public.proposal_team_members;
--    (Should show your team member count)
--
-- 3. Check for any remaining references:
--    SELECT * FROM information_schema.columns 
--    WHERE column_name LIKE '%bid_team%';
--    (Should return 0 rows)
-- ============================================================
