-- ============================================================
-- MIGRATION 027: SECTION COMMENTS AND ATTACHMENTS
-- ============================================================
-- Adds support for section-specific comments and attachments
-- to enable Microsoft Word-like commenting and Teams-like attachments

-- ============================================================
-- 1. SECTION COMMENTS TABLE
-- ============================================================
-- Comments specific to document sections (like Word comments)
CREATE TABLE IF NOT EXISTS public.section_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section_id UUID NOT NULL REFERENCES public.document_sections(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES public.workspace_documents(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_resolved BOOLEAN DEFAULT false,
    resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    resolved_at TIMESTAMPTZ,
    parent_id UUID REFERENCES public.section_comments(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 2. SECTION ATTACHMENTS TABLE
-- ============================================================
-- File attachments specific to document sections (like Teams attachments)
CREATE TABLE IF NOT EXISTS public.section_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section_id UUID NOT NULL REFERENCES public.document_sections(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES public.workspace_documents(id) ON DELETE CASCADE,
    uploaded_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT section_attachments_file_size_check CHECK (file_size > 0 AND file_size <= 104857600)
);

-- ============================================================
-- 3. INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_section_comments_section ON public.section_comments(section_id);
CREATE INDEX IF NOT EXISTS idx_section_comments_document ON public.section_comments(document_id);
CREATE INDEX IF NOT EXISTS idx_section_comments_user ON public.section_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_section_comments_parent ON public.section_comments(parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_section_comments_unresolved ON public.section_comments(section_id, is_resolved) WHERE is_resolved = false;
CREATE INDEX IF NOT EXISTS idx_section_comments_created ON public.section_comments(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_section_attachments_section ON public.section_attachments(section_id);
CREATE INDEX IF NOT EXISTS idx_section_attachments_document ON public.section_attachments(document_id);
CREATE INDEX IF NOT EXISTS idx_section_attachments_uploaded_by ON public.section_attachments(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_section_attachments_created ON public.section_attachments(created_at DESC);

-- ============================================================
-- 4. ENABLE RLS
-- ============================================================
ALTER TABLE public.section_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.section_attachments ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 5. RLS POLICIES FOR SECTION COMMENTS
-- ============================================================
-- Team members can view comments on sections they have access to
CREATE POLICY "section_comments_collaborator_select" ON public.section_comments
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.document_collaborators dc 
        WHERE dc.document_id = section_comments.document_id 
        AND dc.user_id = auth.uid()
    )
);

-- Team members can create comments
CREATE POLICY "section_comments_collaborator_insert" ON public.section_comments
FOR INSERT WITH CHECK (
    user_id = auth.uid() 
    AND EXISTS (
        SELECT 1 FROM public.document_collaborators dc 
        WHERE dc.document_id = section_comments.document_id 
        AND dc.user_id = auth.uid()
    )
);

-- Users can update their own comments or resolve comments (if owner/editor)
CREATE POLICY "section_comments_update" ON public.section_comments
FOR UPDATE USING (
    user_id = auth.uid() 
    OR EXISTS (
        SELECT 1 FROM public.document_collaborators dc 
        WHERE dc.document_id = section_comments.document_id 
        AND dc.user_id = auth.uid() 
        AND dc.role IN ('owner', 'editor')
    )
) WITH CHECK (
    user_id = auth.uid() 
    OR EXISTS (
        SELECT 1 FROM public.document_collaborators dc 
        WHERE dc.document_id = section_comments.document_id 
        AND dc.user_id = auth.uid() 
        AND dc.role IN ('owner', 'editor')
    )
);

-- Users can delete their own comments or owners can delete any
CREATE POLICY "section_comments_delete" ON public.section_comments
FOR DELETE USING (
    user_id = auth.uid() 
    OR EXISTS (
        SELECT 1 FROM public.document_collaborators dc 
        WHERE dc.document_id = section_comments.document_id 
        AND dc.user_id = auth.uid() 
        AND dc.role = 'owner'
    )
);

-- ============================================================
-- 6. RLS POLICIES FOR SECTION ATTACHMENTS
-- ============================================================
-- Team members can view attachments on sections they have access to
CREATE POLICY "section_attachments_collaborator_select" ON public.section_attachments
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.document_collaborators dc 
        WHERE dc.document_id = section_attachments.document_id 
        AND dc.user_id = auth.uid()
    )
);

-- Team members can upload attachments
CREATE POLICY "section_attachments_collaborator_insert" ON public.section_attachments
FOR INSERT WITH CHECK (
    uploaded_by = auth.uid() 
    AND EXISTS (
        SELECT 1 FROM public.document_collaborators dc 
        WHERE dc.document_id = section_attachments.document_id 
        AND dc.user_id = auth.uid() 
        AND dc.role IN ('owner', 'editor')
    )
);

-- Users can delete their own attachments or owners can delete any
CREATE POLICY "section_attachments_delete" ON public.section_attachments
FOR DELETE USING (
    uploaded_by = auth.uid() 
    OR EXISTS (
        SELECT 1 FROM public.document_collaborators dc 
        WHERE dc.document_id = section_attachments.document_id 
        AND dc.user_id = auth.uid() 
        AND dc.role = 'owner'
    )
);

-- ============================================================
-- 7. HELPER FUNCTIONS
-- ============================================================

-- Update comment timestamp trigger
CREATE OR REPLACE FUNCTION public.update_section_comment_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_section_comment_timestamp ON public.section_comments;
CREATE TRIGGER trigger_update_section_comment_timestamp
    BEFORE UPDATE ON public.section_comments
    FOR EACH ROW
    EXECUTE FUNCTION public.update_section_comment_timestamp();

-- Get unresolved comments count for a section
CREATE OR REPLACE FUNCTION public.get_section_unresolved_comments_count(p_section_id UUID)
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*)::INTEGER
    INTO v_count
    FROM public.section_comments
    WHERE section_id = p_section_id
    AND is_resolved = false;
    
    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get attachments count for a section
CREATE OR REPLACE FUNCTION public.get_section_attachments_count(p_section_id UUID)
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*)::INTEGER
    INTO v_count
    FROM public.section_attachments
    WHERE section_id = p_section_id;
    
    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_section_unresolved_comments_count(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_section_attachments_count(UUID) TO authenticated;

-- ============================================================
-- 8. COMMENTS
-- ============================================================
COMMENT ON TABLE public.section_comments IS 'Comments specific to document sections, similar to Microsoft Word comments';
COMMENT ON COLUMN public.section_comments.is_resolved IS 'Whether the comment thread has been resolved';
COMMENT ON COLUMN public.section_comments.parent_id IS 'Parent comment ID for threaded replies';

COMMENT ON TABLE public.section_attachments IS 'File attachments specific to document sections, similar to Microsoft Teams attachments';
COMMENT ON COLUMN public.section_attachments.file_path IS 'Path to file in Supabase Storage';
COMMENT ON COLUMN public.section_attachments.file_size IS 'File size in bytes (max 100MB)';

-- ============================================================
-- END OF MIGRATION 027
-- ============================================================
