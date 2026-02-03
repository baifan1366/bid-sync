-- Migration 049: Fix section assignment access for team members
-- This ensures members can ONLY edit sections they're assigned to

-- ============================================================
-- PROBLEM ANALYSIS
-- ============================================================
-- Current policies allow ANY team member to edit ANY section
-- But the business logic requires members to only edit ASSIGNED sections
-- The document_sections.assigned_to column tracks which user can edit each section

-- ============================================================
-- SOLUTION: Update policies to check assigned_to column
-- ============================================================

DROP POLICY IF EXISTS "document_sections_select" ON public.document_sections;
DROP POLICY IF EXISTS "document_sections_insert" ON public.document_sections;
DROP POLICY IF EXISTS "document_sections_update" ON public.document_sections;
DROP POLICY IF EXISTS "document_sections_delete" ON public.document_sections;

-- SELECT: Allow if user is a document collaborator OR assigned to the section OR a proposal lead
CREATE POLICY "document_sections_select" ON public.document_sections
FOR SELECT USING (
    -- Allow document collaborators
    EXISTS (
        SELECT 1 FROM public.document_collaborators dc 
        WHERE dc.document_id = document_sections.document_id 
        AND dc.user_id = auth.uid()
    )
    OR
    -- Allow users assigned to this specific section
    document_sections.assigned_to = auth.uid()
    OR
    -- Allow proposal leads (they can see all sections)
    EXISTS (
        SELECT 1 FROM public.workspace_documents wd
        INNER JOIN public.workspaces w ON w.id = wd.workspace_id
        INNER JOIN public.proposal_team_members ptm ON ptm.proposal_id = w.proposal_id
        WHERE wd.id = document_sections.document_id
        AND w.proposal_id IS NOT NULL
        AND ptm.user_id = auth.uid()
        AND ptm.role = 'lead'
    )
);

-- INSERT: Allow if user is a document editor OR proposal lead
-- Note: Members cannot create new sections, only edit assigned ones
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
    -- Allow proposal leads
    EXISTS (
        SELECT 1 FROM public.workspace_documents wd
        INNER JOIN public.workspaces w ON w.id = wd.workspace_id
        INNER JOIN public.proposal_team_members ptm ON ptm.proposal_id = w.proposal_id
        WHERE wd.id = document_sections.document_id
        AND w.proposal_id IS NOT NULL
        AND ptm.user_id = auth.uid()
        AND ptm.role = 'lead'
    )
);

-- UPDATE: Allow if user is a document editor OR assigned to this section OR proposal lead
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
    -- Allow users assigned to this specific section
    document_sections.assigned_to = auth.uid()
    OR
    -- Allow proposal leads
    EXISTS (
        SELECT 1 FROM public.workspace_documents wd
        INNER JOIN public.workspaces w ON w.id = wd.workspace_id
        INNER JOIN public.proposal_team_members ptm ON ptm.proposal_id = w.proposal_id
        WHERE wd.id = document_sections.document_id
        AND w.proposal_id IS NOT NULL
        AND ptm.user_id = auth.uid()
        AND ptm.role = 'lead'
    )
)
WITH CHECK (
    -- Same checks for the new data
    EXISTS (
        SELECT 1 FROM public.document_collaborators dc 
        WHERE dc.document_id = document_sections.document_id 
        AND dc.user_id = auth.uid() 
        AND dc.role IN ('owner', 'editor')
    )
    OR
    document_sections.assigned_to = auth.uid()
    OR
    EXISTS (
        SELECT 1 FROM public.workspace_documents wd
        INNER JOIN public.workspaces w ON w.id = wd.workspace_id
        INNER JOIN public.proposal_team_members ptm ON ptm.proposal_id = w.proposal_id
        WHERE wd.id = document_sections.document_id
        AND w.proposal_id IS NOT NULL
        AND ptm.user_id = auth.uid()
        AND ptm.role = 'lead'
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
    -- Allow proposal leads
    EXISTS (
        SELECT 1 FROM public.workspace_documents wd
        INNER JOIN public.workspaces w ON w.id = wd.workspace_id
        INNER JOIN public.proposal_team_members ptm ON ptm.proposal_id = w.proposal_id
        WHERE wd.id = document_sections.document_id
        AND w.proposal_id IS NOT NULL
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
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'document_sections'
ORDER BY policyname, cmd;

-- Test query: Check if a specific user can access a specific section
-- Replace with actual IDs to test
/*
SELECT
    ds.id as section_id,
    ds.title as section_title,
    ds.assigned_to,
    -- Check 1: Is user a document collaborator?
    EXISTS (
        SELECT 1 FROM document_collaborators dc 
        WHERE dc.document_id = ds.document_id 
        AND dc.user_id = 'd0499dba-43f2-4988-9e62-b1726e2eb7f1'
    ) as is_collaborator,
    -- Check 2: Is user assigned to this section?
    (ds.assigned_to = 'd0499dba-43f2-4988-9e62-b1726e2eb7f1') as is_assigned,
    -- Check 3: Is user a proposal lead?
    EXISTS (
        SELECT 1 FROM workspace_documents wd
        INNER JOIN workspaces w ON w.id = wd.workspace_id
        INNER JOIN proposal_team_members ptm ON ptm.proposal_id = w.proposal_id
        WHERE wd.id = ds.document_id
        AND w.proposal_id IS NOT NULL
        AND ptm.user_id = 'd0499dba-43f2-4988-9e62-b1726e2eb7f1'
        AND ptm.role = 'lead'
    ) as is_lead,
    -- Overall: Should user have access?
    (
        EXISTS (
            SELECT 1 FROM document_collaborators dc 
            WHERE dc.document_id = ds.document_id 
            AND dc.user_id = 'd0499dba-43f2-4988-9e62-b1726e2eb7f1'
        )
        OR ds.assigned_to = 'd0499dba-43f2-4988-9e62-b1726e2eb7f1'
        OR EXISTS (
            SELECT 1 FROM workspace_documents wd
            INNER JOIN workspaces w ON w.id = wd.workspace_id
            INNER JOIN proposal_team_members ptm ON ptm.proposal_id = w.proposal_id
            WHERE wd.id = ds.document_id
            AND w.proposal_id IS NOT NULL
            AND ptm.user_id = 'd0499dba-43f2-4988-9e62-b1726e2eb7f1'
            AND ptm.role = 'lead'
        )
    ) as should_have_access
FROM document_sections ds
WHERE ds.document_id IN (
    SELECT id FROM workspace_documents 
    WHERE workspace_id = '45a99ca8-2066-44ff-b3e6-ea81588902e2'
);
*/
