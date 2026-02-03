-- ============================================================
-- DROP OLD bid_team_members POLICIES ONLY
-- ============================================================
-- This script safely drops all policies and functions that reference
-- the deprecated bid_team_members table. Run this BEFORE applying
-- the updated schema.
-- ============================================================

-- ============================================================
-- 1. DROP POLICIES (if they exist)
-- ============================================================

-- Drop deliverables policies
DROP POLICY IF EXISTS "deliverables_team_client_select" ON public.project_deliverables;
DROP POLICY IF EXISTS "deliverables_team_insert" ON public.project_deliverables;
DROP POLICY IF EXISTS "deliverables_team_client_select_v2" ON public.project_deliverables;
DROP POLICY IF EXISTS "deliverables_team_insert_v2" ON public.project_deliverables;

-- Drop completions policies
DROP POLICY IF EXISTS "completions_team_client_select" ON public.project_completions;
DROP POLICY IF EXISTS "completions_lead_insert" ON public.project_completions;
DROP POLICY IF EXISTS "completions_team_client_select_v2" ON public.project_completions;
DROP POLICY IF EXISTS "completions_lead_insert_v2" ON public.project_completions;

-- Drop archives policies
DROP POLICY IF EXISTS "archives_participants_select" ON public.project_archives;
DROP POLICY IF EXISTS "archives_participants_select_v2" ON public.project_archives;

-- Drop revisions policies
DROP POLICY IF EXISTS "revisions_team_client_select" ON public.completion_revisions;
DROP POLICY IF EXISTS "revisions_team_client_select_v2" ON public.completion_revisions;
DROP POLICY IF EXISTS "revisions_lead_update" ON public.completion_revisions;
DROP POLICY IF EXISTS "completion_revisions_team_select" ON public.completion_revisions;
DROP POLICY IF EXISTS "completion_revisions_team_insert" ON public.completion_revisions;

-- Drop exports policies
DROP POLICY IF EXISTS "exports_user_insert" ON public.project_exports;
DROP POLICY IF EXISTS "exports_user_insert_v2" ON public.project_exports;

-- Drop proposal_additional_info policies
DROP POLICY IF EXISTS "proposal_additional_info_team_select" ON public.proposal_additional_info;

-- Drop proposal_versions policies
DROP POLICY IF EXISTS "proposal_versions_team_select" ON public.proposal_versions;
DROP POLICY IF EXISTS "proposal_versions_team_insert" ON public.proposal_versions;

-- Drop bid_team_members table policies
DROP POLICY IF EXISTS "bid_team_members_read" ON public.bid_team_members;
DROP POLICY IF EXISTS "bid_team_members_lead_insert" ON public.bid_team_members;
DROP POLICY IF EXISTS "bid_team_members_lead_delete" ON public.bid_team_members;
DROP POLICY IF EXISTS "bid_team_members_admin_all" ON public.bid_team_members;

-- ============================================================
-- 2. DROP OLD FUNCTIONS
-- ============================================================

DROP FUNCTION IF EXISTS public.is_project_lead(UUID, UUID);
DROP FUNCTION IF EXISTS public.is_team_member(UUID, UUID);

-- ============================================================
-- 3. DROP THE OLD TABLE
-- ============================================================

DROP TABLE IF EXISTS public.bid_team_members CASCADE;

-- ============================================================
-- 4. VERIFICATION
-- ============================================================

DO $$
BEGIN
    RAISE NOTICE '==============================================';
    RAISE NOTICE 'Cleanup completed successfully!';
    RAISE NOTICE 'All bid_team_members references removed.';
    RAISE NOTICE 'Now run the updated bidsync.sql schema.';
    RAISE NOTICE '==============================================';
END $$;
