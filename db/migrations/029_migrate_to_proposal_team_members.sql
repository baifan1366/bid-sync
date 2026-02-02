-- ============================================================
-- Migration: Migrate from bid_team_members to proposal_team_members
-- ============================================================
-- This migration moves all team member data from the deprecated
-- bid_team_members table to the new proposal_team_members table
-- If bid_team_members doesn't exist, this migration will skip gracefully

BEGIN;

-- Step 1: Check if tables exist and decide what to do
DO $$
DECLARE
    v_ptm_exists BOOLEAN;
    v_btm_exists BOOLEAN;
BEGIN
    -- Check if proposal_team_members table exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'proposal_team_members'
    ) INTO v_ptm_exists;
    
    -- Check if bid_team_members table exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'bid_team_members'
    ) INTO v_btm_exists;
    
    IF NOT v_ptm_exists THEN
        RAISE EXCEPTION 'proposal_team_members table does not exist. Please ensure the table is created first.';
    END IF;
    
    IF NOT v_btm_exists THEN
        RAISE NOTICE '==============================================';
        RAISE NOTICE 'bid_team_members table does not exist.';
        RAISE NOTICE 'This is expected if you are starting fresh.';
        RAISE NOTICE 'No data migration needed.';
        RAISE NOTICE '==============================================';
    ELSE
        RAISE NOTICE 'Both tables exist. Proceeding with migration...';
    END IF;
END $$;

-- Step 2: Migrate existing bid_team_members data to proposal_team_members (only if source table exists)
DO $$
DECLARE
    v_btm_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'bid_team_members'
    ) INTO v_btm_exists;
    
    IF v_btm_exists THEN
        -- For each project, find all proposals and migrate team members
        INSERT INTO public.proposal_team_members (proposal_id, user_id, role, joined_at)
        SELECT 
            p.id as proposal_id,
            btm.user_id,
            btm.role,
            btm.created_at as joined_at
        FROM public.bid_team_members btm
        INNER JOIN public.proposals p ON p.project_id = btm.project_id
        WHERE NOT EXISTS (
            -- Avoid duplicates
            SELECT 1 FROM public.proposal_team_members ptm
            WHERE ptm.proposal_id = p.id 
            AND ptm.user_id = btm.user_id
        )
        ON CONFLICT (proposal_id, user_id) DO NOTHING;
        
        RAISE NOTICE 'Data migration completed.';
    END IF;
END $$;

-- Step 3: Verify migration (only if source table exists)
DO $$
DECLARE
    v_btm_exists BOOLEAN;
    old_count INTEGER := 0;
    new_count INTEGER;
    proposals_count INTEGER;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'bid_team_members'
    ) INTO v_btm_exists;
    
    IF v_btm_exists THEN
        SELECT COUNT(*) INTO old_count FROM public.bid_team_members;
    END IF;
    
    SELECT COUNT(*) INTO new_count FROM public.proposal_team_members;
    SELECT COUNT(*) INTO proposals_count FROM public.proposals;
    
    RAISE NOTICE '==============================================';
    RAISE NOTICE 'Migration Summary:';
    RAISE NOTICE '  bid_team_members records: %', old_count;
    RAISE NOTICE '  proposal_team_members records: %', new_count;
    RAISE NOTICE '  Total proposals: %', proposals_count;
    RAISE NOTICE '==============================================';
    
    IF new_count = 0 AND old_count > 0 THEN
        RAISE WARNING 'No records migrated! Please check the migration logic.';
    ELSIF new_count > 0 THEN
        RAISE NOTICE 'Migration successful! % records in proposal_team_members.', new_count;
    ELSE
        RAISE NOTICE 'No team member data to migrate.';
    END IF;
END $$;

-- Step 4: Add comment to bid_team_members table indicating it's deprecated (only if it exists)
DO $$
DECLARE
    v_btm_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'bid_team_members'
    ) INTO v_btm_exists;
    
    IF v_btm_exists THEN
        COMMENT ON TABLE public.bid_team_members IS 'DEPRECATED: This table is no longer used. All team member data has been migrated to proposal_team_members. This table is kept for reference only and will be dropped in migration 030.';
        RAISE NOTICE 'Added deprecation comment to bid_team_members table.';
    END IF;
END $$;

-- Step 5: Create a view for backward compatibility (optional)
-- This allows old queries to still work while we update the codebase
CREATE OR REPLACE VIEW public.bid_team_members_compat AS
SELECT 
    ptm.id,
    p.project_id,
    ptm.user_id,
    ptm.role,
    ptm.joined_at as created_at,
    ptm.joined_at
FROM public.proposal_team_members ptm
INNER JOIN public.proposals p ON p.id = ptm.proposal_id;

COMMENT ON VIEW public.bid_team_members_compat IS 'Compatibility view for bid_team_members. Maps proposal_team_members to the old structure for backward compatibility.';

-- Step 6: Log migration completion (optional - only if admin_actions exists)
DO $$
BEGIN
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
            'DATA_MIGRATION',
            'Migrated team members from bid_team_members to proposal_team_members',
            jsonb_build_object(
                'migration', '029_migrate_to_proposal_team_members',
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
    RAISE NOTICE 'Migration 029 completed successfully!';
    RAISE NOTICE 'Team member data is now in proposal_team_members.';
    RAISE NOTICE 'Next step: Run migration 031 to update RLS policies.';
    RAISE NOTICE '==============================================';
END $$;

-- ============================================================
-- VERIFICATION QUERIES
-- ============================================================
-- Run these after migration to verify:
--
-- 1. Check proposal_team_members has data:
--    SELECT COUNT(*) FROM public.proposal_team_members;
--
-- 2. If bid_team_members exists, verify all team members were migrated:
--    SELECT 
--      btm.user_id, 
--      btm.project_id,
--      p.id as proposal_id,
--      ptm.id as migrated_id
--    FROM bid_team_members btm
--    INNER JOIN proposals p ON p.project_id = btm.project_id
--    LEFT JOIN proposal_team_members ptm 
--      ON ptm.proposal_id = p.id AND ptm.user_id = btm.user_id
--    WHERE ptm.id IS NULL;
--    (Should return 0 rows)
--
-- 3. Test the compatibility view:
--    SELECT * FROM bid_team_members_compat LIMIT 10;
-- ============================================================
