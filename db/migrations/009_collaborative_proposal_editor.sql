-- ============================================================
-- COLLABORATIVE PROPOSAL EDITOR MIGRATION
-- ============================================================
-- This migration adds support for collaborative document editing
-- with real-time collaboration, version control, and team management

-- ============================================================
-- 1. WORKSPACES TABLE
-- ============================================================
-- Proposal workspaces for project leads
CREATE TABLE IF NOT EXISTS public.workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    lead_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT workspaces_project_fk FOREIGN KEY (project_id) REFERENCES public.projects(id),
    CONSTRAINT workspaces_lead_fk FOREIGN KEY (lead_id) REFERENCES auth.users(id)
);

-- ============================================================
-- 2. WORKSPACE_DOCUMENTS TABLE
-- ============================================================
-- Proposal documents within workspaces (renamed to avoid conflict with existing documents table)
CREATE TABLE IF NOT EXISTS public.workspace_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    content JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by UUID NOT NULL REFERENCES auth.users(id),
    last_edited_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT workspace_documents_workspace_fk FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id),
    CONSTRAINT workspace_documents_created_by_fk FOREIGN KEY (created_by) REFERENCES auth.users(id),
    CONSTRAINT workspace_documents_last_edited_by_fk FOREIGN KEY (last_edited_by) REFERENCES auth.users(id)
);

-- ============================================================
-- 3. DOCUMENT VERSIONS TABLE
-- ============================================================
-- Version history for documents
CREATE TABLE IF NOT EXISTS public.document_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES public.workspace_documents(id) ON DELETE CASCADE,
    version_number INT NOT NULL,
    content JSONB NOT NULL,
    created_by UUID NOT NULL REFERENCES auth.users(id),
    changes_summary TEXT,
    is_rollback BOOLEAN DEFAULT false,
    rolled_back_from UUID REFERENCES public.document_versions(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT document_versions_document_fk FOREIGN KEY (document_id) REFERENCES public.workspace_documents(id),
    CONSTRAINT document_versions_created_by_fk FOREIGN KEY (created_by) REFERENCES auth.users(id),
    CONSTRAINT document_versions_rolled_back_from_fk FOREIGN KEY (rolled_back_from) REFERENCES public.document_versions(id),
    UNIQUE(document_id, version_number)
);

-- ============================================================
-- 4. DOCUMENT COLLABORATORS TABLE
-- ============================================================
-- Team members with access to documents
CREATE TABLE IF NOT EXISTS public.document_collaborators (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES public.workspace_documents(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('owner', 'editor', 'commenter', 'viewer')),
    added_by UUID NOT NULL REFERENCES auth.users(id),
    added_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT document_collaborators_document_fk FOREIGN KEY (document_id) REFERENCES public.workspace_documents(id),
    CONSTRAINT document_collaborators_user_fk FOREIGN KEY (user_id) REFERENCES auth.users(id),
    CONSTRAINT document_collaborators_added_by_fk FOREIGN KEY (added_by) REFERENCES auth.users(id),
    UNIQUE(document_id, user_id)
);

-- ============================================================
-- 5. COLLABORATION SESSIONS TABLE
-- ============================================================
-- Active editing sessions for real-time collaboration
CREATE TABLE IF NOT EXISTS public.collaboration_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES public.workspace_documents(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    user_color TEXT NOT NULL,
    cursor_position JSONB,
    presence_status TEXT DEFAULT 'active' CHECK (presence_status IN ('active', 'idle', 'away')),
    last_activity TIMESTAMPTZ DEFAULT now(),
    joined_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT collaboration_sessions_document_fk FOREIGN KEY (document_id) REFERENCES public.workspace_documents(id),
    CONSTRAINT collaboration_sessions_user_fk FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

-- ============================================================
-- 6. DOCUMENT INVITATIONS TABLE
-- ============================================================
-- Invitations for team members to collaborate on documents
CREATE TABLE IF NOT EXISTS public.document_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES public.workspace_documents(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('editor', 'commenter', 'viewer')),
    token UUID DEFAULT gen_random_uuid() UNIQUE,
    invited_by UUID NOT NULL REFERENCES auth.users(id),
    expires_at TIMESTAMPTZ NOT NULL,
    accepted_at TIMESTAMPTZ,
    accepted_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT document_invitations_document_fk FOREIGN KEY (document_id) REFERENCES public.workspace_documents(id),
    CONSTRAINT document_invitations_invited_by_fk FOREIGN KEY (invited_by) REFERENCES auth.users(id),
    CONSTRAINT document_invitations_accepted_by_fk FOREIGN KEY (accepted_by) REFERENCES auth.users(id)
);

-- ============================================================
-- 7. INDEXES FOR PERFORMANCE
-- ============================================================

-- Workspaces indexes
CREATE INDEX IF NOT EXISTS idx_workspaces_project ON public.workspaces(project_id);
CREATE INDEX IF NOT EXISTS idx_workspaces_lead ON public.workspaces(lead_id);
CREATE INDEX IF NOT EXISTS idx_workspaces_updated ON public.workspaces(updated_at DESC);

-- Documents indexes
CREATE INDEX IF NOT EXISTS idx_documents_workspace ON public.workspace_documents(workspace_id);
CREATE INDEX IF NOT EXISTS idx_documents_updated ON public.workspace_documents(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_created_by ON public.workspace_documents(created_by);
CREATE INDEX IF NOT EXISTS idx_documents_title_search ON public.workspace_documents USING gin(to_tsvector('english', title));
CREATE INDEX IF NOT EXISTS idx_documents_content_search ON public.workspace_documents USING gin(to_tsvector('english', content::text));

-- Document versions indexes
CREATE INDEX IF NOT EXISTS idx_document_versions_document ON public.document_versions(document_id, version_number DESC);
CREATE INDEX IF NOT EXISTS idx_document_versions_created_by ON public.document_versions(created_by);
CREATE INDEX IF NOT EXISTS idx_document_versions_created_at ON public.document_versions(created_at DESC);

-- Document collaborators indexes
CREATE INDEX IF NOT EXISTS idx_document_collaborators_document ON public.document_collaborators(document_id);
CREATE INDEX IF NOT EXISTS idx_document_collaborators_user ON public.document_collaborators(user_id);
CREATE INDEX IF NOT EXISTS idx_document_collaborators_role ON public.document_collaborators(document_id, role);

-- Collaboration sessions indexes
CREATE INDEX IF NOT EXISTS idx_collaboration_sessions_document ON public.collaboration_sessions(document_id);
CREATE INDEX IF NOT EXISTS idx_collaboration_sessions_user ON public.collaboration_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_collaboration_sessions_active ON public.collaboration_sessions(document_id, last_activity DESC);
CREATE INDEX IF NOT EXISTS idx_collaboration_sessions_presence ON public.collaboration_sessions(document_id, presence_status);

-- Document invitations indexes
CREATE INDEX IF NOT EXISTS idx_document_invitations_token ON public.document_invitations(token);
CREATE INDEX IF NOT EXISTS idx_document_invitations_email ON public.document_invitations(email);
CREATE INDEX IF NOT EXISTS idx_document_invitations_document ON public.document_invitations(document_id);
CREATE INDEX IF NOT EXISTS idx_document_invitations_expires ON public.document_invitations(expires_at) WHERE accepted_at IS NULL;

-- ============================================================
-- 8. DATABASE FUNCTIONS
-- ============================================================

-- Function to automatically create owner collaborator when document is created
CREATE OR REPLACE FUNCTION public.create_document_owner()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.document_collaborators (document_id, user_id, role, added_by)
    VALUES (NEW.id, NEW.created_by, 'owner', NEW.created_by);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create owner collaborator
DROP TRIGGER IF EXISTS trigger_create_document_owner ON public.workspace_documents;
CREATE TRIGGER trigger_create_document_owner
    AFTER INSERT ON public.workspace_documents
    FOR EACH ROW
    EXECUTE FUNCTION public.create_document_owner();

-- Function to update document updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_document_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update document timestamp
DROP TRIGGER IF EXISTS trigger_update_document_timestamp ON public.workspace_documents;
CREATE TRIGGER trigger_update_document_timestamp
    BEFORE UPDATE ON public.workspace_documents
    FOR EACH ROW
    EXECUTE FUNCTION public.update_document_timestamp();

-- Function to update workspace updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_workspace_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update workspace timestamp
DROP TRIGGER IF EXISTS trigger_update_workspace_timestamp ON public.workspaces;
CREATE TRIGGER trigger_update_workspace_timestamp
    BEFORE UPDATE ON public.workspaces
    FOR EACH ROW
    EXECUTE FUNCTION public.update_workspace_timestamp();

-- Function to get next version number for a document
CREATE OR REPLACE FUNCTION public.get_next_version_number(p_document_id UUID)
RETURNS INT AS $$
DECLARE
    v_next_version INT;
BEGIN
    SELECT COALESCE(MAX(version_number), 0) + 1
    INTO v_next_version
    FROM public.document_versions
    WHERE document_id = p_document_id;
    
    RETURN v_next_version;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user has permission on document
CREATE OR REPLACE FUNCTION public.has_document_permission(
    p_document_id UUID,
    p_user_id UUID,
    p_required_role TEXT DEFAULT 'viewer'
)
RETURNS BOOLEAN AS $$
DECLARE
    v_user_role TEXT;
    v_role_hierarchy INT;
    v_required_hierarchy INT;
BEGIN
    -- Get user's role on the document
    SELECT role INTO v_user_role
    FROM public.document_collaborators
    WHERE document_id = p_document_id AND user_id = p_user_id;
    
    -- If user has no role, return false
    IF v_user_role IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Define role hierarchy (higher number = more permissions)
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
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up expired invitations
CREATE OR REPLACE FUNCTION public.cleanup_expired_invitations()
RETURNS void AS $$
BEGIN
    DELETE FROM public.document_invitations
    WHERE expires_at < now() AND accepted_at IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up inactive collaboration sessions
CREATE OR REPLACE FUNCTION public.cleanup_inactive_sessions()
RETURNS void AS $$
BEGIN
    DELETE FROM public.collaboration_sessions
    WHERE last_activity < now() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 9. ENABLE ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_collaborators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collaboration_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_invitations ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 10. RLS POLICIES FOR WORKSPACES
-- ============================================================

-- Workspace owners can view their workspaces
CREATE POLICY "workspaces_owner_select" ON public.workspaces
FOR SELECT
USING (lead_id = auth.uid());

-- Workspace owners can create workspaces
CREATE POLICY "workspaces_owner_insert" ON public.workspaces
FOR INSERT
WITH CHECK (lead_id = auth.uid());

-- Workspace owners can update their workspaces
CREATE POLICY "workspaces_owner_update" ON public.workspaces
FOR UPDATE
USING (lead_id = auth.uid())
WITH CHECK (lead_id = auth.uid());

-- Workspace owners can delete their workspaces
CREATE POLICY "workspaces_owner_delete" ON public.workspaces
FOR DELETE
USING (lead_id = auth.uid());

-- ============================================================
-- 11. RLS POLICIES FOR DOCUMENTS
-- ============================================================

-- Collaborators can view documents they have access to
CREATE POLICY "documents_collaborator_select" ON public.workspace_documents
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.document_collaborators dc
        WHERE dc.document_id = workspace_documents.id AND dc.user_id = auth.uid()
    )
);

-- Document creators can insert documents
CREATE POLICY "documents_creator_insert" ON public.workspace_documents
FOR INSERT
WITH CHECK (created_by = auth.uid());

-- Editors and owners can update documents
CREATE POLICY "documents_editor_update" ON public.workspace_documents
FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.document_collaborators dc
        WHERE dc.document_id = workspace_documents.id 
        AND dc.user_id = auth.uid()
        AND dc.role IN ('owner', 'editor')
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.document_collaborators dc
        WHERE dc.document_id = workspace_documents.id 
        AND dc.user_id = auth.uid()
        AND dc.role IN ('owner', 'editor')
    )
);

-- Owners can delete documents
CREATE POLICY "documents_owner_delete" ON public.workspace_documents
FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM public.document_collaborators dc
        WHERE dc.document_id = workspace_documents.id 
        AND dc.user_id = auth.uid()
        AND dc.role = 'owner'
    )
);

-- ============================================================
-- 12. RLS POLICIES FOR DOCUMENT_VERSIONS
-- ============================================================

-- Collaborators can view versions of documents they have access to
CREATE POLICY "document_versions_collaborator_select" ON public.document_versions
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.document_collaborators dc
        WHERE dc.document_id = document_versions.document_id 
        AND dc.user_id = auth.uid()
    )
);

-- Editors and owners can create versions
CREATE POLICY "document_versions_editor_insert" ON public.document_versions
FOR INSERT
WITH CHECK (
    created_by = auth.uid() AND
    EXISTS (
        SELECT 1 FROM public.document_collaborators dc
        WHERE dc.document_id = document_versions.document_id 
        AND dc.user_id = auth.uid()
        AND dc.role IN ('owner', 'editor')
    )
);

-- ============================================================
-- 13. RLS POLICIES FOR DOCUMENT_COLLABORATORS
-- ============================================================

-- Collaborators can view other collaborators on documents they have access to
CREATE POLICY "document_collaborators_select" ON public.document_collaborators
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.document_collaborators dc
        WHERE dc.document_id = document_collaborators.document_id 
        AND dc.user_id = auth.uid()
    )
);

-- Owners can add collaborators
CREATE POLICY "document_collaborators_owner_insert" ON public.document_collaborators
FOR INSERT
WITH CHECK (
    added_by = auth.uid() AND
    EXISTS (
        SELECT 1 FROM public.document_collaborators dc
        WHERE dc.document_id = document_collaborators.document_id 
        AND dc.user_id = auth.uid()
        AND dc.role = 'owner'
    )
);

-- Owners can update collaborator roles
CREATE POLICY "document_collaborators_owner_update" ON public.document_collaborators
FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.document_collaborators dc
        WHERE dc.document_id = document_collaborators.document_id 
        AND dc.user_id = auth.uid()
        AND dc.role = 'owner'
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.document_collaborators dc
        WHERE dc.document_id = document_collaborators.document_id 
        AND dc.user_id = auth.uid()
        AND dc.role = 'owner'
    )
);

-- Owners can remove collaborators
CREATE POLICY "document_collaborators_owner_delete" ON public.document_collaborators
FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM public.document_collaborators dc
        WHERE dc.document_id = document_collaborators.document_id 
        AND dc.user_id = auth.uid()
        AND dc.role = 'owner'
    )
);

-- ============================================================
-- 14. RLS POLICIES FOR COLLABORATION_SESSIONS
-- ============================================================

-- Collaborators can view active sessions on documents they have access to
CREATE POLICY "collaboration_sessions_collaborator_select" ON public.collaboration_sessions
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.document_collaborators dc
        WHERE dc.document_id = collaboration_sessions.document_id 
        AND dc.user_id = auth.uid()
    )
);

-- Collaborators can create their own sessions
CREATE POLICY "collaboration_sessions_user_insert" ON public.collaboration_sessions
FOR INSERT
WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
        SELECT 1 FROM public.document_collaborators dc
        WHERE dc.document_id = collaboration_sessions.document_id 
        AND dc.user_id = auth.uid()
    )
);

-- Users can update their own sessions
CREATE POLICY "collaboration_sessions_user_update" ON public.collaboration_sessions
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Users can delete their own sessions
CREATE POLICY "collaboration_sessions_user_delete" ON public.collaboration_sessions
FOR DELETE
USING (user_id = auth.uid());

-- ============================================================
-- 15. RLS POLICIES FOR DOCUMENT_INVITATIONS
-- ============================================================

-- Owners can view invitations for their documents
CREATE POLICY "document_invitations_owner_select" ON public.document_invitations
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.document_collaborators dc
        WHERE dc.document_id = document_invitations.document_id 
        AND dc.user_id = auth.uid()
        AND dc.role = 'owner'
    )
);

-- Anyone can view invitations by token (for acceptance)
CREATE POLICY "document_invitations_token_select" ON public.document_invitations
FOR SELECT
USING (true);

-- Owners can create invitations
CREATE POLICY "document_invitations_owner_insert" ON public.document_invitations
FOR INSERT
WITH CHECK (
    invited_by = auth.uid() AND
    EXISTS (
        SELECT 1 FROM public.document_collaborators dc
        WHERE dc.document_id = document_invitations.document_id 
        AND dc.user_id = auth.uid()
        AND dc.role = 'owner'
    )
);

-- Users can update invitations they're accepting
CREATE POLICY "document_invitations_accept_update" ON public.document_invitations
FOR UPDATE
USING (accepted_by IS NULL OR accepted_by = auth.uid())
WITH CHECK (accepted_by = auth.uid());

-- Owners can delete invitations
CREATE POLICY "document_invitations_owner_delete" ON public.document_invitations
FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM public.document_collaborators dc
        WHERE dc.document_id = document_invitations.document_id 
        AND dc.user_id = auth.uid()
        AND dc.role = 'owner'
    )
);

-- ============================================================
-- END OF MIGRATION
-- ============================================================

