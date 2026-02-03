-- Migration 047: Fix document_sections RLS to use proposal_id directly
-- This ensures members can access sections for proposals they're assigned to

-- ============================================================
-- UPDATE DOCUMENT_SECTIONS POLICIES TO USE PROPOSAL_ID
-- ============================================================

DROP POLICY IF EXISTS "document_sections_select" ON public.document_sections;
DROP POLICY IF EXISTS "document_sections_insert" ON public.document_sections;
DROP POLICY IF EXISTS "document_sections_update" ON public.document_sections;
DROP POLICY IF EXISTS "document_sections_delete" ON public.document_sections;

-- SELECT: Allow if user is a document collaborator OR a proposal team member
CREATE POLICY "document_sections_select" ON public.document_sections
FOR SELECT USING (
    -- Allow document collaborators
    EXISTS (
        SELECT 1 FROM public.document_collaborators dc 
        WHERE dc.document_id = document_sections.document_id 
        AND dc.user_id = auth.uid()
    )
    OR
    -- Allow proposal team members (using proposal_id for direct lookup)
    EXISTS (
        SELECT 1 FROM public.workspace_documents wd
        INNER JOIN public.workspaces w ON w.id = wd.workspace_id
        INNER JOIN public.proposal_team_members ptm ON ptm.proposal_id = w.proposal_id
        WHERE wd.id = document_sections.document_id
        AND w.proposal_id IS NOT NULL
        AND ptm.user_id = auth.uid()
    )
    OR
    -- Fallback for legacy workspaces without proposal_id
    EXISTS (
        SELECT 1 FROM public.workspace_documents wd
        INNER JOIN public.workspaces w ON w.id = wd.workspace_id
        INNER JOIN public.proposals p ON p.project_id = w.project_id AND p.lead_id = w.lead_id
        INNER JOIN public.proposal_team_members ptm ON ptm.proposal_id = p.id
        WHERE wd.id = document_sections.document_id
        AND w.proposal_id IS NULL
        AND ptm.user_id = auth.uid()
    )
);

-- INSERT: Allow if user is a document editor OR a proposal team member
CREATE POLICY "document_sections_insert" ON public.document_sections
FOR INSERT WITH CHECK (
    -- Allow document editors
    EXISTS (
        SELECT 1 FROM public.document_collaborators dc 
        WHERE dc.document_id = document_sections.document_id 
        AND dc.user_id = auth.uid() 
        AND dc.role IN ('owner', 'editor')
    )
    OR
    -- Allow proposal team members (using proposal_id)
    EXISTS (
        SELECT 1 FROM public.workspace_documents wd
        INNER JOIN public.workspaces w ON w.id = wd.workspace_id
        INNER JOIN public.proposal_team_members ptm ON ptm.proposal_id = w.proposal_id
        WHERE wd.id = document_sections.document_id
        AND w.proposal_id IS NOT NULL
        AND ptm.user_id = auth.uid()
    )
    OR
    -- Fallback for legacy workspaces
    EXISTS (
        SELECT 1 FROM public.workspace_documents wd
        INNER JOIN public.workspaces w ON w.id = wd.workspace_id
        INNER JOIN public.proposals p ON p.project_id = w.project_id AND p.lead_id = w.lead_id
        INNER JOIN public.proposal_team_members ptm ON ptm.proposal_id = p.id
        WHERE wd.id = document_sections.document_id
        AND w.proposal_id IS NULL
        AND ptm.user_id = auth.uid()
    )
);

-- UPDATE: Allow if user is a document editor OR a proposal team member
CREATE POLICY "document_sections_update" ON public.document_sections
FOR UPDATE USING (
    -- Allow document editors
    EXISTS (
        SELECT 1 FROM public.document_collaborators dc 
        WHERE dc.document_id = document_sections.document_id 
        AND dc.user_id = auth.uid() 
        AND dc.role IN ('owner', 'editor')
    )
    OR
    -- Allow proposal team members (using proposal_id)
    EXISTS (
        SELECT 1 FROM public.workspace_documents wd
        INNER JOIN public.workspaces w ON w.id = wd.workspace_id
        INNER JOIN public.proposal_team_members ptm ON ptm.proposal_id = w.proposal_id
        WHERE wd.id = document_sections.document_id
        AND w.proposal_id IS NOT NULL
        AND ptm.user_id = auth.uid()
    )
    OR
    -- Fallback for legacy workspaces
    EXISTS (
        SELECT 1 FROM public.workspace_documents wd
        INNER JOIN public.workspaces w ON w.id = wd.workspace_id
        INNER JOIN public.proposals p ON p.project_id = w.project_id AND p.lead_id = w.lead_id
        INNER JOIN public.proposal_team_members ptm ON ptm.proposal_id = p.id
        WHERE wd.id = document_sections.document_id
        AND w.proposal_id IS NULL
        AND ptm.user_id = auth.uid()
    )
)
WITH CHECK (
    -- Allow document editors
    EXISTS (
        SELECT 1 FROM public.document_collaborators dc 
        WHERE dc.document_id = document_sections.document_id 
        AND dc.user_id = auth.uid() 
        AND dc.role IN ('owner', 'editor')
    )
    OR
    -- Allow proposal team members (using proposal_id)
    EXISTS (
        SELECT 1 FROM public.workspace_documents wd
        INNER JOIN public.workspaces w ON w.id = wd.workspace_id
        INNER JOIN public.proposal_team_members ptm ON ptm.proposal_id = w.proposal_id
        WHERE wd.id = document_sections.document_id
        AND w.proposal_id IS NOT NULL
        AND ptm.user_id = auth.uid()
    )
    OR
    -- Fallback for legacy workspaces
    EXISTS (
        SELECT 1 FROM public.workspace_documents wd
        INNER JOIN public.workspaces w ON w.id = wd.workspace_id
        INNER JOIN public.proposals p ON p.project_id = w.project_id AND p.lead_id = w.lead_id
        INNER JOIN public.proposal_team_members ptm ON ptm.proposal_id = p.id
        WHERE wd.id = document_sections.document_id
        AND w.proposal_id IS NULL
        AND ptm.user_id = auth.uid()
    )
);

-- DELETE: Allow if user is document owner OR proposal lead
CREATE POLICY "document_sections_delete" ON public.document_sections
FOR DELETE USING (
    -- Allow document owners
    EXISTS (
        SELECT 1 FROM public.document_collaborators dc 
        WHERE dc.document_id = document_sections.document_id 
        AND dc.user_id = auth.uid() 
        AND dc.role = 'owner'
    )
    OR
    -- Allow proposal leads (using proposal_id)
    EXISTS (
        SELECT 1 FROM public.workspace_documents wd
        INNER JOIN public.workspaces w ON w.id = wd.workspace_id
        INNER JOIN public.proposal_team_members ptm ON ptm.proposal_id = w.proposal_id
        WHERE wd.id = document_sections.document_id
        AND w.proposal_id IS NOT NULL
        AND ptm.user_id = auth.uid()
        AND ptm.role = 'lead'
    )
    OR
    -- Fallback for legacy workspaces
    EXISTS (
        SELECT 1 FROM public.workspace_documents wd
        INNER JOIN public.workspaces w ON w.id = wd.workspace_id
        INNER JOIN public.proposals p ON p.project_id = w.project_id AND p.lead_id = w.lead_id
        INNER JOIN public.proposal_team_members ptm ON ptm.proposal_id = p.id
        WHERE wd.id = document_sections.document_id
        AND w.proposal_id IS NULL
        AND ptm.user_id = auth.uid()
        AND ptm.role = 'lead'
    )
);

-- ============================================================
-- VERIFICATION QUERIES
-- ============================================================

-- Check that policies were created
SELECT 
    schemaname,
    tablename,
    policyname,
    cmd
FROM pg_policies 
WHERE tablename = 'document_sections'
ORDER BY policyname, cmd;
