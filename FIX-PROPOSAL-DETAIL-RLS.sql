-- ============================================================
-- COMPREHENSIVE FIX: Proposal Detail View RLS Issues
-- ============================================================
-- This script fixes RLS policies that are blocking access to:
-- 1. proposal_versions
-- 2. workspaces
-- 3. workspace_documents
-- 4. document_sections

-- ============================================================
-- 1. FIX PROPOSAL VERSIONS RLS
-- ============================================================

DROP POLICY IF EXISTS "versions_read" ON public.proposal_versions;
DROP POLICY IF EXISTS "versions_write" ON public.proposal_versions;
DROP POLICY IF EXISTS "proposal_versions_team_select" ON public.proposal_versions;
DROP POLICY IF EXISTS "proposal_versions_team_insert" ON public.proposal_versions;
DROP POLICY IF EXISTS "proposal_versions_client_select" ON public.proposal_versions;

CREATE POLICY "proposal_versions_read_access" ON public.proposal_versions
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.proposals p
        WHERE p.id = proposal_versions.proposal_id
        AND (
            p.lead_id = auth.uid()
            OR EXISTS (
                SELECT 1 FROM public.proposal_team_members ptm
                WHERE ptm.proposal_id = p.id AND ptm.user_id = auth.uid()
            )
            OR EXISTS (
                SELECT 1 FROM public.projects proj
                WHERE proj.id = p.project_id AND proj.client_id = auth.uid()
            )
        )
    )
);

CREATE POLICY "proposal_versions_write_access" ON public.proposal_versions
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.proposals p
        WHERE p.id = proposal_versions.proposal_id
        AND (
            p.lead_id = auth.uid()
            OR EXISTS (
                SELECT 1 FROM public.proposal_team_members ptm
                WHERE ptm.proposal_id = p.id AND ptm.user_id = auth.uid()
            )
        )
    )
);

-- ============================================================
-- 2. FIX WORKSPACES RLS
-- ============================================================

DROP POLICY IF EXISTS "workspaces_owner_select" ON public.workspaces;
DROP POLICY IF EXISTS "workspaces_owner_insert" ON public.workspaces;
DROP POLICY IF EXISTS "workspaces_owner_update" ON public.workspaces;
DROP POLICY IF EXISTS "workspaces_owner_delete" ON public.workspaces;

CREATE POLICY "workspaces_read_access" ON public.workspaces
FOR SELECT USING (
    lead_id = auth.uid()
    OR EXISTS (
        SELECT 1 FROM public.proposals p
        JOIN public.proposal_team_members ptm ON ptm.proposal_id = p.id
        WHERE p.project_id = workspaces.project_id AND ptm.user_id = auth.uid()
    )
    OR EXISTS (
        SELECT 1 FROM public.projects proj
        WHERE proj.id = workspaces.project_id AND proj.client_id = auth.uid()
    )
);

CREATE POLICY "workspaces_insert_access" ON public.workspaces
FOR INSERT WITH CHECK (lead_id = auth.uid());

CREATE POLICY "workspaces_update_access" ON public.workspaces
FOR UPDATE USING (lead_id = auth.uid()) WITH CHECK (lead_id = auth.uid());

CREATE POLICY "workspaces_delete_access" ON public.workspaces
FOR DELETE USING (lead_id = auth.uid());

-- ============================================================
-- 3. FIX WORKSPACE DOCUMENTS RLS
-- ============================================================

DROP POLICY IF EXISTS "documents_collaborator_select" ON public.workspace_documents;
DROP POLICY IF EXISTS "documents_creator_insert" ON public.workspace_documents;
DROP POLICY IF EXISTS "documents_editor_update" ON public.workspace_documents;
DROP POLICY IF EXISTS "documents_owner_delete" ON public.workspace_documents;

CREATE POLICY "workspace_documents_read_access" ON public.workspace_documents
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.document_collaborators dc
        WHERE dc.document_id = workspace_documents.id AND dc.user_id = auth.uid()
    )
    OR EXISTS (
        SELECT 1 FROM public.workspaces w
        WHERE w.id = workspace_documents.workspace_id
        AND (
            w.lead_id = auth.uid()
            OR EXISTS (
                SELECT 1 FROM public.proposals p
                JOIN public.proposal_team_members ptm ON ptm.proposal_id = p.id
                WHERE p.project_id = w.project_id AND ptm.user_id = auth.uid()
            )
            OR EXISTS (
                SELECT 1 FROM public.projects proj
                WHERE proj.id = w.project_id AND proj.client_id = auth.uid()
            )
        )
    )
);

CREATE POLICY "workspace_documents_insert_access" ON public.workspace_documents
FOR INSERT WITH CHECK (created_by = auth.uid());

CREATE POLICY "workspace_documents_update_access" ON public.workspace_documents
FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM public.document_collaborators dc
        WHERE dc.document_id = workspace_documents.id 
        AND dc.user_id = auth.uid() 
        AND dc.role IN ('owner', 'editor')
    )
) WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.document_collaborators dc
        WHERE dc.document_id = workspace_documents.id 
        AND dc.user_id = auth.uid() 
        AND dc.role IN ('owner', 'editor')
    )
);

CREATE POLICY "workspace_documents_delete_access" ON public.workspace_documents
FOR DELETE USING (
    EXISTS (
        SELECT 1 FROM public.document_collaborators dc
        WHERE dc.document_id = workspace_documents.id 
        AND dc.user_id = auth.uid() 
        AND dc.role = 'owner'
    )
);

-- ============================================================
-- 4. FIX DOCUMENT SECTIONS RLS
-- ============================================================

DROP POLICY IF EXISTS "document_sections_collaborator_select" ON public.document_sections;
DROP POLICY IF EXISTS "document_sections_editor_insert" ON public.document_sections;
DROP POLICY IF EXISTS "document_sections_editor_update" ON public.document_sections;
DROP POLICY IF EXISTS "document_sections_owner_delete" ON public.document_sections;

CREATE POLICY "document_sections_read_access" ON public.document_sections
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.document_collaborators dc
        WHERE dc.document_id = document_sections.document_id AND dc.user_id = auth.uid()
    )
    OR EXISTS (
        SELECT 1 FROM public.workspace_documents wd
        JOIN public.workspaces w ON w.id = wd.workspace_id
        WHERE wd.id = document_sections.document_id
        AND (
            w.lead_id = auth.uid()
            OR EXISTS (
                SELECT 1 FROM public.proposals p
                JOIN public.proposal_team_members ptm ON ptm.proposal_id = p.id
                WHERE p.project_id = w.project_id AND ptm.user_id = auth.uid()
            )
            OR EXISTS (
                SELECT 1 FROM public.projects proj
                WHERE proj.id = w.project_id AND proj.client_id = auth.uid()
            )
        )
    )
);

CREATE POLICY "document_sections_insert_access" ON public.document_sections
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.document_collaborators dc
        WHERE dc.document_id = document_sections.document_id 
        AND dc.user_id = auth.uid() 
        AND dc.role IN ('owner', 'editor')
    )
);

CREATE POLICY "document_sections_update_access" ON public.document_sections
FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM public.document_collaborators dc
        WHERE dc.document_id = document_sections.document_id 
        AND dc.user_id = auth.uid() 
        AND dc.role IN ('owner', 'editor')
    )
) WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.document_collaborators dc
        WHERE dc.document_id = document_sections.document_id 
        AND dc.user_id = auth.uid() 
        AND dc.role IN ('owner', 'editor')
    )
);

CREATE POLICY "document_sections_delete_access" ON public.document_sections
FOR DELETE USING (
    EXISTS (
        SELECT 1 FROM public.document_collaborators dc
        WHERE dc.document_id = document_sections.document_id 
        AND dc.user_id = auth.uid() 
        AND dc.role = 'owner'
    )
);

-- ============================================================
-- VERIFICATION
-- ============================================================

-- Check all policies
SELECT 
    tablename,
    policyname,
    cmd,
    CASE 
        WHEN cmd = 'SELECT' THEN 'Read'
        WHEN cmd = 'INSERT' THEN 'Create'
        WHEN cmd = 'UPDATE' THEN 'Update'
        WHEN cmd = 'DELETE' THEN 'Delete'
        ELSE cmd
    END as operation
FROM pg_policies 
WHERE tablename IN ('proposal_versions', 'workspaces', 'workspace_documents', 'document_sections')
ORDER BY tablename, cmd;

-- Summary
SELECT 
    'RLS Policies Fixed' as status,
    COUNT(*) FILTER (WHERE tablename = 'proposal_versions') as proposal_versions_policies,
    COUNT(*) FILTER (WHERE tablename = 'workspaces') as workspaces_policies,
    COUNT(*) FILTER (WHERE tablename = 'workspace_documents') as workspace_documents_policies,
    COUNT(*) FILTER (WHERE tablename = 'document_sections') as document_sections_policies
FROM pg_policies 
WHERE tablename IN ('proposal_versions', 'workspaces', 'workspace_documents', 'document_sections');
