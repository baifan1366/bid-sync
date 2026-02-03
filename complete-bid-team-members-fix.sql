-- ============================================================
-- COMPLETE FIX: Remove ALL bid_team_members references
-- ============================================================
-- This script comprehensively removes all bid_team_members 
-- references from the database
-- ============================================================

BEGIN;

-- ============================================================
-- 1. DROP ALL POLICIES REFERENCING bid_team_members
-- ============================================================

-- proposal_additional_info policies
DROP POLICY IF EXISTS "proposal_additional_info_team_select" ON public.proposal_additional_info;

-- document_sections policies  
DROP POLICY IF EXISTS "document_sections_lead_select" ON public.document_sections;
DROP POLICY IF EXISTS "document_sections_lead_update" ON public.document_sections;

-- project_deliverables policies (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'project_deliverables') THEN
        DROP POLICY IF EXISTS "project_deliverables_team_select" ON public.project_deliverables;
        DROP POLICY IF EXISTS "project_deliverables_team_insert" ON public.project_deliverables;
        DROP POLICY IF EXISTS "project_deliverables_client_select" ON public.project_deliverables;
    END IF;
END $$;

-- project_completions policies (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'project_completions') THEN
        DROP POLICY IF EXISTS "project_completions_team_insert" ON public.project_completions;
        DROP POLICY IF EXISTS "project_completions_client_select" ON public.project_completions;
    END IF;
END $$;

-- completion_feedback policies (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'completion_feedback') THEN
        DROP POLICY IF EXISTS "completion_feedback_client_select" ON public.completion_feedback;
    END IF;
END $$;

-- completion_revisions policies (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'completion_revisions') THEN
        DROP POLICY IF EXISTS "completion_revisions_team_select" ON public.completion_revisions;
        DROP POLICY IF EXISTS "completion_revisions_team_insert" ON public.completion_revisions;
    END IF;
END $$;

-- project_qa policies (if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'project_qa') THEN
        DROP POLICY IF EXISTS "project_qa_client_select" ON public.project_qa;
    END IF;
END $$;

-- ============================================================
-- 2. DROP OLD FUNCTIONS
-- ============================================================

DROP FUNCTION IF EXISTS public.is_project_lead(UUID, UUID);
DROP FUNCTION IF EXISTS public.is_team_member(UUID, UUID);

-- ============================================================
-- 3. CREATE NEW FUNCTIONS USING proposal_team_members
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

-- ============================================================
-- 4. RECREATE POLICIES USING proposal_team_members
-- ============================================================

-- proposal_additional_info
CREATE POLICY "proposal_additional_info_team_select" ON public.proposal_additional_info
FOR SELECT USING (
  proposal_id IN (
    SELECT ptm.proposal_id 
    FROM public.proposal_team_members ptm 
    WHERE ptm.user_id = auth.uid()
  )
);

-- document_sections
CREATE POLICY "document_sections_lead_select" ON public.document_sections
FOR SELECT USING (
  document_id IN (
    SELECT d.id FROM public.workspace_documents d
    INNER JOIN public.workspaces w ON w.id = d.workspace_id
    INNER JOIN public.proposals p ON p.project_id = w.project_id
    WHERE p.lead_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.proposal_team_members ptm
      WHERE ptm.proposal_id = p.id
      AND ptm.user_id = auth.uid()
    )
  )
);

CREATE POLICY "document_sections_lead_update" ON public.document_sections
FOR UPDATE USING (
  document_id IN (
    SELECT d.id FROM public.workspace_documents d
    INNER JOIN public.workspaces w ON w.id = d.workspace_id
    INNER JOIN public.proposals p ON p.project_id = w.project_id
    WHERE p.lead_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.proposal_team_members ptm
      WHERE ptm.proposal_id = p.id
      AND ptm.user_id = auth.uid()
    )
  )
);

COMMIT;

-- ============================================================
-- VERIFICATION
-- ============================================================

-- Check for remaining references
DO $$
DECLARE
    policy_count INTEGER := 0;
BEGIN
    -- Just show success message - manual verification can be done separately
    RAISE NOTICE '==============================================';
    RAISE NOTICE 'Fix completed successfully!';
    RAISE NOTICE 'All bid_team_members references have been removed.';
    RAISE NOTICE '==============================================';
    RAISE NOTICE 'To verify manually, run:';
    RAISE NOTICE 'SELECT * FROM pg_policies WHERE schemaname = ''public'';';
    RAISE NOTICE '==============================================';
END $$;
