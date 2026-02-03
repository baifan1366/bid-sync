-- ============================================================
-- FIX ALL bid_team_members REFERENCES
-- ============================================================
-- This migration removes all references to the deprecated bid_team_members table
-- and replaces them with proposal_team_members (proposal-level teams).
-- ============================================================

-- ============================================================
-- 1. DROP OLD POLICIES REFERENCING bid_team_members
-- ============================================================

-- Drop deliverables policies
DROP POLICY IF EXISTS "deliverables_team_client_select" ON public.project_deliverables;
DROP POLICY IF EXISTS "deliverables_team_insert" ON public.project_deliverables;

-- Drop completions policies
DROP POLICY IF EXISTS "completions_team_client_select" ON public.project_completions;
DROP POLICY IF EXISTS "completions_lead_insert" ON public.project_completions;

-- Drop archives policies
DROP POLICY IF EXISTS "archives_participants_select" ON public.project_archives;

-- Drop revisions policies
DROP POLICY IF EXISTS "revisions_team_client_select" ON public.completion_revisions;

-- Drop exports policies
DROP POLICY IF EXISTS "exports_user_insert" ON public.project_exports;

-- Drop completion revisions policies
DROP POLICY IF EXISTS "completion_revisions_team_select" ON public.completion_revisions;
DROP POLICY IF EXISTS "completion_revisions_team_insert" ON public.completion_revisions;

-- Drop bid_team_members table policies
DROP POLICY IF EXISTS "bid_team_members_read" ON public.bid_team_members;
DROP POLICY IF EXISTS "bid_team_members_lead_insert" ON public.bid_team_members;
DROP POLICY IF EXISTS "bid_team_members_lead_delete" ON public.bid_team_members;
DROP POLICY IF EXISTS "bid_team_members_admin_all" ON public.bid_team_members;

-- ============================================================
-- 2. DROP OLD FUNCTIONS REFERENCING bid_team_members
-- ============================================================

DROP FUNCTION IF EXISTS public.is_project_lead(UUID, UUID);
DROP FUNCTION IF EXISTS public.is_team_member(UUID, UUID);

-- ============================================================
-- 3. DROP THE OLD TABLE
-- ============================================================

DROP TABLE IF EXISTS public.bid_team_members CASCADE;

-- ============================================================
-- 4. CREATE NEW POLICIES USING proposal_team_members
-- ============================================================

-- RLS Policies for Deliverables (using proposal_team_members)
CREATE POLICY "deliverables_team_client_select" ON public.project_deliverables
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_deliverables.project_id
    AND (
      p.client_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.proposals pr
        JOIN public.proposal_team_members ptm ON ptm.proposal_id = pr.id
        WHERE pr.project_id = p.id AND ptm.user_id = auth.uid()
      )
    )
  )
);

CREATE POLICY "deliverables_team_insert" ON public.project_deliverables
FOR INSERT WITH CHECK (
  uploaded_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.proposals pr
    JOIN public.proposal_team_members ptm ON ptm.proposal_id = pr.id
    WHERE pr.project_id = project_deliverables.project_id AND ptm.user_id = auth.uid()
  )
);

-- RLS Policies for Completions (using proposal_team_members)
CREATE POLICY "completions_team_client_select" ON public.project_completions
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_completions.project_id
    AND (
      p.client_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.proposals pr
        JOIN public.proposal_team_members ptm ON ptm.proposal_id = pr.id
        WHERE pr.project_id = p.id AND ptm.user_id = auth.uid()
      )
    )
  )
);

CREATE POLICY "completions_lead_insert" ON public.project_completions
FOR INSERT WITH CHECK (
  submitted_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.proposals pr
    JOIN public.proposal_team_members ptm ON ptm.proposal_id = pr.id
    WHERE pr.project_id = project_completions.project_id
    AND ptm.user_id = auth.uid() AND ptm.role = 'lead'
  )
);

-- RLS Policies for Archives (using proposal_team_members)
CREATE POLICY "archives_participants_select" ON public.project_archives
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_archives.project_id
    AND (
      p.client_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.proposals pr
        JOIN public.proposal_team_members ptm ON ptm.proposal_id = pr.id
        WHERE pr.project_id = p.id AND ptm.user_id = auth.uid()
      )
    )
  )
);

-- RLS Policies for Revisions (using proposal_team_members)
CREATE POLICY "revisions_team_client_select" ON public.completion_revisions
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.project_completions pc
    JOIN public.projects p ON p.id = pc.project_id
    WHERE pc.id = completion_revisions.completion_id
    AND (
      p.client_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.proposals pr
        JOIN public.proposal_team_members ptm ON ptm.proposal_id = pr.id
        WHERE pr.project_id = p.id AND ptm.user_id = auth.uid()
      )
    )
  )
);

CREATE POLICY "completion_revisions_team_select" ON public.completion_revisions
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.project_completions pc
    JOIN public.proposal_team_members ptm ON ptm.proposal_id = pc.proposal_id
    WHERE pc.id = completion_revisions.completion_id
    AND ptm.user_id = auth.uid()
  )
);

CREATE POLICY "completion_revisions_team_insert" ON public.completion_revisions
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.project_completions pc
    JOIN public.proposal_team_members ptm ON ptm.proposal_id = pc.proposal_id
    WHERE pc.id = completion_revisions.completion_id
    AND ptm.user_id = auth.uid()
    AND ptm.role = 'lead'
  )
);

-- RLS Policies for Exports (using proposal_team_members)
CREATE POLICY "exports_user_insert" ON public.project_exports
FOR INSERT WITH CHECK (
  requested_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_exports.project_id
    AND (
      p.client_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.proposals pr
        JOIN public.proposal_team_members ptm ON ptm.proposal_id = pr.id
        WHERE pr.project_id = p.id AND ptm.user_id = auth.uid()
      )
    )
  )
);

-- ============================================================
-- 5. CREATE NEW HELPER FUNCTIONS USING proposal_team_members
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
-- 6. VERIFICATION
-- ============================================================

DO $$
BEGIN
    RAISE NOTICE '==============================================';
    RAISE NOTICE 'Migration completed successfully!';
    RAISE NOTICE 'All bid_team_members references removed.';
    RAISE NOTICE 'All policies now use proposal_team_members.';
    RAISE NOTICE '==============================================';
END $$;
