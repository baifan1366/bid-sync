-- ============================================================
-- COMBINED MIGRATION: FIX MEMBER ACCESS TO DOCUMENTS
-- ============================================================
-- 
-- This combines migrations 038 and 042 to fix the issue where
-- team members cannot access workspace documents.
--
-- PROBLEM: Members are in proposal_team_members but not in
-- document_collaborators, causing access denied errors.
--
-- SOLUTION: Update RLS policies and permission functions to
-- check BOTH document_collaborators AND proposal_team_members.
-- ============================================================

BEGIN;

-- ============================================================
-- PART 1: UPDATE WORKSPACE_DOCUMENTS RLS POLICIES (Migration 038)
-- ============================================================

-- Drop old policies
DROP POLICY IF EXISTS "documents_collaborator_select" ON public.workspace_documents;
DROP POLICY IF EXISTS "documents_creator_insert" ON public.workspace_documents;
DROP POLICY IF EXISTS "documents_editor_update" ON public.workspace_documents;
DROP POLICY IF EXISTS "documents_owner_delete" ON public.workspace_documents;
DROP POLICY IF EXISTS "documents_select" ON public.workspace_documents;
DROP POLICY IF EXISTS "documents_insert" ON public.workspace_documents;
DROP POLICY IF EXISTS "documents_update" ON public.workspace_documents;
DROP POLICY IF EXISTS "documents_delete" ON public.workspace_documents;

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
-- UPDATE DOCUMENT_SECTIONS POLICIES
-- ============================================================

DROP POLICY IF EXISTS "document_sections_collaborator_select" ON public.document_sections;
DROP POLICY IF EXISTS "document_sections_editor_insert" ON public.document_sections;
DROP POLICY IF EXISTS "document_sections_editor_update" ON public.document_sections;
DROP POLICY IF EXISTS "document_sections_owner_delete" ON public.document_sections;
DROP POLICY IF EXISTS "document_sections_select" ON public.document_sections;
DROP POLICY IF EXISTS "document_sections_insert" ON public.document_sections;
DROP POLICY IF EXISTS "document_sections_update" ON public.document_sections;
DROP POLICY IF EXISTS "document_sections_delete" ON public.document_sections;

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
-- PART 2: UPDATE has_document_permission FUNCTION (Migration 042)
-- ============================================================

-- Drop the old function
DROP FUNCTION IF EXISTS public.has_document_permission(UUID, UUID, TEXT);

-- Create updated function that checks both collaborators and proposal team members
CREATE OR REPLACE FUNCTION public.has_document_permission(
    p_document_id UUID, 
    p_user_id UUID, 
    p_required_role TEXT DEFAULT 'viewer'
)
RETURNS BOOLEAN 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    v_user_role TEXT;
    v_role_hierarchy INT;
    v_required_hierarchy INT;
    v_is_team_member BOOLEAN;
BEGIN
    -- First, check if user is a document collaborator
    SELECT role INTO v_user_role 
    FROM public.document_collaborators 
    WHERE document_id = p_document_id 
    AND user_id = p_user_id;
    
    -- If user is a collaborator, check their role hierarchy
    IF v_user_role IS NOT NULL THEN
        v_user_role := LOWER(v_user_role);
        p_required_role := LOWER(p_required_role);
        
        v_role_hierarchy := CASE v_user_role 
            WHEN 'owner' THEN 4 
            WHEN 'editor' THEN 3 
            WHEN 'commenter' THEN 2 
            WHEN 'viewer' THEN 1 
            ELSE 0 
        END;
        
        v_required_hierarchy := CASE p_required_role 
            WHEN 'owner' THEN 4 
            WHEN 'editor' THEN 3 
            WHEN 'commenter' THEN 2 
            WHEN 'viewer' THEN 1 
            ELSE 0 
        END;
        
        RETURN v_role_hierarchy >= v_required_hierarchy;
    END IF;
    
    -- If not a collaborator, check if user is a proposal team member
    -- Team members have at least 'viewer' access to workspace documents
    SELECT EXISTS (
        SELECT 1 
        FROM public.workspace_documents wd
        INNER JOIN public.workspaces w ON w.id = wd.workspace_id
        INNER JOIN public.proposals p ON p.project_id = w.project_id
        INNER JOIN public.proposal_team_members ptm ON ptm.proposal_id = p.id
        WHERE wd.id = p_document_id
        AND ptm.user_id = p_user_id
    ) INTO v_is_team_member;
    
    -- If user is a team member, grant viewer access (can be upgraded based on required role)
    IF v_is_team_member THEN
        -- Team members have editor access by default (can view and edit)
        p_required_role := LOWER(p_required_role);
        
        -- Team members can view, comment, and edit, but not own
        IF p_required_role IN ('viewer', 'commenter', 'editor') THEN
            RETURN TRUE;
        ELSE
            RETURN FALSE;
        END IF;
    END IF;
    
    -- No access found
    RETURN FALSE;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.has_document_permission TO authenticated;

-- ============================================================
-- ADD COMMENTS
-- ============================================================

COMMENT ON POLICY "documents_select" ON public.workspace_documents IS 
'Allows document collaborators and proposal team members to view workspace documents';

COMMENT ON POLICY "documents_update" ON public.workspace_documents IS 
'Allows document editors/owners and proposal team members to update workspace documents';

COMMENT ON POLICY "documents_delete" ON public.workspace_documents IS 
'Allows document owners and proposal leads to delete workspace documents';

COMMENT ON FUNCTION public.has_document_permission IS 
'Checks if a user has the required permission level for a document. Checks both document_collaborators and proposal_team_members tables.';

COMMIT;

-- Success message
DO $$
BEGIN
    RAISE NOTICE '==============================================';
    RAISE NOTICE 'Combined migration completed successfully!';
    RAISE NOTICE 'Workspace documents RLS policies now support proposal team members.';
    RAISE NOTICE 'has_document_permission function now checks proposal team members.';
    RAISE NOTICE 'Team members can now access documents, version history, and all features.';
    RAISE NOTICE '==============================================';
END $$;

-- ============================================================
-- VERIFICATION QUERIES
-- ============================================================
-- Run these after migration to verify:
--
-- 1. Check new policies exist:
SELECT schemaname, tablename, policyname, cmd
FROM pg_policies 
WHERE tablename IN ('workspace_documents', 'document_sections')
ORDER BY tablename, policyname;
--
-- 2. Test has_document_permission function:
-- SELECT has_document_permission(
--     'your-document-id'::uuid,
--     'your-user-id'::uuid,
--     'viewer'
-- );
--
-- 3. Test as team member (login as member and run):
-- SELECT * FROM workspace_documents 
-- WHERE workspace_id IN (
--     SELECT w.id FROM workspaces w
--     INNER JOIN proposals p ON p.project_id = w.project_id
--     INNER JOIN proposal_team_members ptm ON ptm.proposal_id = p.id
--     WHERE ptm.user_id = auth.uid()
-- );
-- ============================================================
