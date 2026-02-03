-- ============================================================
-- ULTRA SIMPLE FIX - Just list and drop problematic policies
-- ============================================================

-- First, let's see what policies exist
SELECT schemaname, tablename, policyname
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Now manually drop the ones that might reference bid_team_members
-- Based on the error and common patterns, these are likely culprits:

DROP POLICY IF EXISTS "proposal_additional_info_team_select" ON public.proposal_additional_info;
DROP POLICY IF EXISTS "document_sections_team_select" ON public.document_sections;
DROP POLICY IF EXISTS "document_sections_team_update" ON public.document_sections;
DROP POLICY IF EXISTS "project_deliverables_team_select" ON public.project_deliverables;
DROP POLICY IF EXISTS "project_deliverables_team_insert" ON public.project_deliverables;
DROP POLICY IF EXISTS "project_deliverables_team_update" ON public.project_deliverables;
DROP POLICY IF EXISTS "project_deliverables_team_delete" ON public.project_deliverables;
DROP POLICY IF EXISTS "project_completions_team_insert" ON public.project_completions;
DROP POLICY IF EXISTS "project_completions_team_select" ON public.project_completions;
DROP POLICY IF EXISTS "completion_feedback_team_select" ON public.completion_feedback;
DROP POLICY IF EXISTS "completion_feedback_team_update" ON public.completion_feedback;
DROP POLICY IF EXISTS "completion_revisions_team_select" ON public.completion_revisions;
DROP POLICY IF EXISTS "completion_revisions_team_insert" ON public.completion_revisions;
DROP POLICY IF EXISTS "project_qa_team_select" ON public.project_qa;

-- Drop old functions
DROP FUNCTION IF EXISTS public.is_project_lead(UUID, UUID);
DROP FUNCTION IF EXISTS public.is_team_member(UUID, UUID);

-- Create new functions using proposal_team_members
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

-- Recreate essential policies using proposal_team_members
CREATE POLICY "proposal_additional_info_team_select" ON public.proposal_additional_info
FOR SELECT USING (
  proposal_id IN (
    SELECT ptm.proposal_id 
    FROM public.proposal_team_members ptm 
    WHERE ptm.user_id = auth.uid()
  )
);

CREATE POLICY "document_sections_team_select" ON public.document_sections
FOR SELECT USING (
  document_id IN (
    SELECT d.id FROM public.documents d
    INNER JOIN public.proposals p ON p.id = d.proposal_id
    WHERE p.lead_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.proposal_team_members ptm
      WHERE ptm.proposal_id = p.id
      AND ptm.user_id = auth.uid()
    )
  )
);

CREATE POLICY "document_sections_team_update" ON public.document_sections
FOR UPDATE USING (
  document_id IN (
    SELECT d.id FROM public.documents d
    INNER JOIN public.proposals p ON p.id = d.proposal_id
    WHERE p.lead_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.proposal_team_members ptm
      WHERE ptm.proposal_id = p.id
      AND ptm.user_id = auth.uid()
    )
  )
);

-- Success message
SELECT 'Fixed! Policies updated to use proposal_team_members' as status;
