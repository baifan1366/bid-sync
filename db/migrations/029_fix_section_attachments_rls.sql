-- ============================================================
-- MIGRATION 029: FIX SECTION ATTACHMENTS RLS POLICIES
-- ============================================================
-- Updates RLS policies to work with proposal team members
-- instead of just document collaborators

-- Drop existing policies
DROP POLICY IF EXISTS "section_attachments_collaborator_select" ON public.section_attachments;
DROP POLICY IF EXISTS "section_attachments_collaborator_insert" ON public.section_attachments;
DROP POLICY IF EXISTS "section_attachments_delete" ON public.section_attachments;

-- ============================================================
-- NEW RLS POLICIES FOR SECTION ATTACHMENTS
-- ============================================================

-- Team members can view attachments (via document_collaborators OR proposal_team_members)
CREATE POLICY "section_attachments_team_select" ON public.section_attachments
FOR SELECT USING (
    -- Check if user is a document collaborator
    EXISTS (
        SELECT 1 FROM public.document_collaborators dc 
        WHERE dc.document_id = section_attachments.document_id 
        AND dc.user_id = auth.uid()
    )
    OR
    -- Check if user is a proposal team member
    EXISTS (
        SELECT 1 
        FROM public.document_sections ds
        JOIN public.workspace_documents wd ON wd.id = ds.document_id
        JOIN public.workspaces w ON w.id = wd.workspace_id
        JOIN public.proposals p ON p.id = w.proposal_id
        JOIN public.proposal_team_members ptm ON ptm.proposal_id = p.id
        WHERE ds.id = section_attachments.section_id
        AND ptm.user_id = auth.uid()
    )
);

-- Team members can upload attachments (via document_collaborators OR proposal_team_members)
CREATE POLICY "section_attachments_team_insert" ON public.section_attachments
FOR INSERT WITH CHECK (
    uploaded_by = auth.uid() 
    AND (
        -- Check if user is a document collaborator with editor/owner role
        EXISTS (
            SELECT 1 FROM public.document_collaborators dc 
            WHERE dc.document_id = section_attachments.document_id 
            AND dc.user_id = auth.uid() 
            AND dc.role IN ('owner', 'editor')
        )
        OR
        -- Check if user is a proposal team member
        EXISTS (
            SELECT 1 
            FROM public.document_sections ds
            JOIN public.workspace_documents wd ON wd.id = ds.document_id
            JOIN public.workspaces w ON w.id = wd.workspace_id
            JOIN public.proposals p ON p.id = w.proposal_id
            JOIN public.proposal_team_members ptm ON ptm.proposal_id = p.id
            WHERE ds.id = section_attachments.section_id
            AND ptm.user_id = auth.uid()
        )
    )
);

-- Users can delete their own attachments OR owners can delete any
CREATE POLICY "section_attachments_team_delete" ON public.section_attachments
FOR DELETE USING (
    uploaded_by = auth.uid() 
    OR
    -- Document owner can delete
    EXISTS (
        SELECT 1 FROM public.document_collaborators dc 
        WHERE dc.document_id = section_attachments.document_id 
        AND dc.user_id = auth.uid() 
        AND dc.role = 'owner'
    )
    OR
    -- Proposal lead can delete
    EXISTS (
        SELECT 1 
        FROM public.document_sections ds
        JOIN public.workspace_documents wd ON wd.id = ds.document_id
        JOIN public.workspaces w ON w.id = wd.workspace_id
        JOIN public.proposals p ON p.id = w.proposal_id
        JOIN public.proposal_team_members ptm ON ptm.proposal_id = p.id
        WHERE ds.id = section_attachments.section_id
        AND ptm.user_id = auth.uid()
        AND ptm.role = 'lead'
    )
);

-- ============================================================
-- COMMENTS
-- ============================================================
COMMENT ON POLICY "section_attachments_team_select" ON public.section_attachments IS 
'Allows document collaborators and proposal team members to view attachments';

COMMENT ON POLICY "section_attachments_team_insert" ON public.section_attachments IS 
'Allows document editors/owners and proposal team members to upload attachments';

COMMENT ON POLICY "section_attachments_team_delete" ON public.section_attachments IS 
'Allows users to delete their own attachments, document owners and proposal leads to delete any';

-- ============================================================
-- END OF MIGRATION 029
-- ============================================================
