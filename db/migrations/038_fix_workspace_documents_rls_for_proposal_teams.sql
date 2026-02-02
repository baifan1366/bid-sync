-- ============================================================
-- MIGRATION 038: FIX WORKSPACE_DOCUMENTS RLS FOR PROPOSAL TEAMS
-- ============================================================
-- 
-- PROBLEM: Bidding leads and team members cannot see workspace_documents
-- because the RLS policies only check document_collaborators table,
-- but proposal team members are not automatically added as collaborators.
--
-- SOLUTION: Update workspace_documents RLS policies to also check
-- proposal_team_members table through the workspace -> proposal relationship.
-- ============================================================

BEGIN;

-- ============================================================
-- 1. DROP EXISTING WORKSPACE_DOCUMENTS POLICIES
-- ============================================================

DROP POLICY IF EXISTS "documents_collaborator_select" ON public.workspace_documents;
DROP POLICY IF EXISTS "documents_creator_insert" ON public.workspace_documents;
DROP POLICY IF EXISTS "documents_editor_update" ON public.workspace_documents;
DROP POLICY IF EXISTS "documents_owner_delete" ON public.workspace_documents;

-- ============================================================
-- 2. CREATE NEW WORKSPACE_DOCUMENTS POLICIES
-- ============================================================

-- SELECT: Allow if user is a collaborator OR a proposal team member
CREATE POLICY "documents_select" ON public.workspace_documents
FOR SELECT USING (
    -- User is a document collaborator
    EXISTS (
        SELECT 1 FROM public.document_collaborators dc 
        WHERE dc.document_id = workspace_documents.id 
        AND dc.user_id = auth.uid()
    )
    OR
    -- User is a proposal team member (lead or member) for any proposal in this workspace's project
    EXISTS (
        SELECT 1 FROM public.workspaces w
        INNER JOIN public.proposals p ON p.project_id = w.project_id
        INNER JOIN public.proposal_team_members ptm ON ptm.proposal_id = p.id
        WHERE w.id = workspace_documents.workspace_id
        AND ptm.user_id = auth.uid()
    )
);

-- INSERT: Allow if user is creating the document
CREATE POLICY "documents_insert" ON public.workspace_documents
FOR INSERT WITH CHECK (created_by = auth.uid());

-- UPDATE: Allow if user is a collaborator with editor/owner role OR a proposal team member
CREATE POLICY "documents_update" ON public.workspace_documents
FOR UPDATE USING (
    -- User is a document collaborator with editor or owner role
    EXISTS (
        SELECT 1 FROM public.document_collaborators dc 
        WHERE dc.document_id = workspace_documents.id 
        AND dc.user_id = auth.uid() 
        AND dc.role IN ('owner', 'editor')
    )
    OR
    -- User is a proposal team member (lead or member) for any proposal in this workspace's project
    EXISTS (
        SELECT 1 FROM public.workspaces w
        INNER JOIN public.proposals p ON p.project_id = w.project_id
        INNER JOIN public.proposal_team_members ptm ON ptm.proposal_id = p.id
        WHERE w.id = workspace_documents.workspace_id
        AND ptm.user_id = auth.uid()
    )
)
WITH CHECK (
    -- Same conditions for WITH CHECK
    EXISTS (
        SELECT 1 FROM public.document_collaborators dc 
        WHERE dc.document_id = workspace_documents.id 
        AND dc.user_id = auth.uid() 
        AND dc.role IN ('owner', 'editor')
    )
    OR
    EXISTS (
        SELECT 1 FROM public.workspaces w
        INNER JOIN public.proposals p ON p.project_id = w.project_id
        INNER JOIN public.proposal_team_members ptm ON ptm.proposal_id = p.id
        WHERE w.id = workspace_documents.workspace_id
        AND ptm.user_id = auth.uid()
    )
);

-- DELETE: Allow if user is owner collaborator OR proposal lead
CREATE POLICY "documents_delete" ON public.workspace_documents
FOR DELETE USING (
    -- User is a document collaborator with owner role
    EXISTS (
        SELECT 1 FROM public.document_collaborators dc 
        WHERE dc.document_id = workspace_documents.id 
        AND dc.user_id = auth.uid() 
        AND dc.role = 'owner'
    )
    OR
    -- User is the proposal lead for any proposal in this workspace's project
    EXISTS (
        SELECT 1 FROM public.workspaces w
        INNER JOIN public.proposals p ON p.project_id = w.project_id
        INNER JOIN public.proposal_team_members ptm ON ptm.proposal_id = p.id
        WHERE w.id = workspace_documents.workspace_id
        AND ptm.user_id = auth.uid()
        AND ptm.role = 'lead'
    )
);

-- ============================================================
-- 3. UPDATE DOCUMENT_SECTIONS POLICIES
-- ============================================================

DROP POLICY IF EXISTS "document_sections_collaborator_select" ON public.document_sections;
DROP POLICY IF EXISTS "document_sections_editor_insert" ON public.document_sections;
DROP POLICY IF EXISTS "document_sections_editor_update" ON public.document_sections;
DROP POLICY IF EXISTS "document_sections_owner_delete" ON public.document_sections;

-- SELECT: Allow if user can see the parent document
CREATE POLICY "document_sections_select" ON public.document_sections
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.document_collaborators dc 
        WHERE dc.document_id = document_sections.document_id 
        AND dc.user_id = auth.uid()
    )
    OR
    EXISTS (
        SELECT 1 FROM public.workspace_documents wd
        INNER JOIN public.workspaces w ON w.id = wd.workspace_id
        INNER JOIN public.proposals p ON p.project_id = w.project_id
        INNER JOIN public.proposal_team_members ptm ON ptm.proposal_id = p.id
        WHERE wd.id = document_sections.document_id
        AND ptm.user_id = auth.uid()
    )
);

-- INSERT: Allow if user can edit the parent document
CREATE POLICY "document_sections_insert" ON public.document_sections
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.document_collaborators dc 
        WHERE dc.document_id = document_sections.document_id 
        AND dc.user_id = auth.uid() 
        AND dc.role IN ('owner', 'editor')
    )
    OR
    EXISTS (
        SELECT 1 FROM public.workspace_documents wd
        INNER JOIN public.workspaces w ON w.id = wd.workspace_id
        INNER JOIN public.proposals p ON p.project_id = w.project_id
        INNER JOIN public.proposal_team_members ptm ON ptm.proposal_id = p.id
        WHERE wd.id = document_sections.document_id
        AND ptm.user_id = auth.uid()
    )
);

-- UPDATE: Allow if user can edit the parent document
CREATE POLICY "document_sections_update" ON public.document_sections
FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM public.document_collaborators dc 
        WHERE dc.document_id = document_sections.document_id 
        AND dc.user_id = auth.uid() 
        AND dc.role IN ('owner', 'editor')
    )
    OR
    EXISTS (
        SELECT 1 FROM public.workspace_documents wd
        INNER JOIN public.workspaces w ON w.id = wd.workspace_id
        INNER JOIN public.proposals p ON p.project_id = w.project_id
        INNER JOIN public.proposal_team_members ptm ON ptm.proposal_id = p.id
        WHERE wd.id = document_sections.document_id
        AND ptm.user_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.document_collaborators dc 
        WHERE dc.document_id = document_sections.document_id 
        AND dc.user_id = auth.uid() 
        AND dc.role IN ('owner', 'editor')
    )
    OR
    EXISTS (
        SELECT 1 FROM public.workspace_documents wd
        INNER JOIN public.workspaces w ON w.id = wd.workspace_id
        INNER JOIN public.proposals p ON p.project_id = w.project_id
        INNER JOIN public.proposal_team_members ptm ON ptm.proposal_id = p.id
        WHERE wd.id = document_sections.document_id
        AND ptm.user_id = auth.uid()
    )
);

-- DELETE: Allow if user is owner or proposal lead
CREATE POLICY "document_sections_delete" ON public.document_sections
FOR DELETE USING (
    EXISTS (
        SELECT 1 FROM public.document_collaborators dc 
        WHERE dc.document_id = document_sections.document_id 
        AND dc.user_id = auth.uid() 
        AND dc.role = 'owner'
    )
    OR
    EXISTS (
        SELECT 1 FROM public.workspace_documents wd
        INNER JOIN public.workspaces w ON w.id = wd.workspace_id
        INNER JOIN public.proposals p ON p.project_id = w.project_id
        INNER JOIN public.proposal_team_members ptm ON ptm.proposal_id = p.id
        WHERE wd.id = document_sections.document_id
        AND ptm.user_id = auth.uid()
        AND ptm.role = 'lead'
    )
);

-- ============================================================
-- 4. ADD COMMENTS
-- ============================================================

COMMENT ON POLICY "documents_select" ON public.workspace_documents IS 
'Allows document collaborators and proposal team members to view workspace documents';

COMMENT ON POLICY "documents_update" ON public.workspace_documents IS 
'Allows document editors/owners and proposal team members to update workspace documents';

COMMENT ON POLICY "documents_delete" ON public.workspace_documents IS 
'Allows document owners and proposal leads to delete workspace documents';

COMMIT;

-- Success message
DO $$
BEGIN
    RAISE NOTICE '==============================================';
    RAISE NOTICE 'Migration 038 completed successfully!';
    RAISE NOTICE 'Workspace documents RLS policies now support proposal team members.';
    RAISE NOTICE 'Bidding leads and team members can now access their workspace documents.';
    RAISE NOTICE '==============================================';
END $$;

-- ============================================================
-- VERIFICATION QUERIES
-- ============================================================
-- Run these after migration to verify:
--
-- 1. Check new policies exist:
--    SELECT schemaname, tablename, policyname, cmd
--    FROM pg_policies 
--    WHERE tablename IN ('workspace_documents', 'document_sections')
--    ORDER BY tablename, policyname;
--
-- 2. Test as bidding lead:
--    -- Login as a bidding lead and verify you can see workspace documents
--    SELECT * FROM workspace_documents WHERE workspace_id IN (
--        SELECT id FROM workspaces WHERE project_id IN (
--            SELECT project_id FROM proposals WHERE lead_id = auth.uid()
--        )
--    );
-- ============================================================
