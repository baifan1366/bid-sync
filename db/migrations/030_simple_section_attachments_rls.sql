-- ============================================================
-- MIGRATION 030: SIMPLE SECTION ATTACHMENTS RLS (OPEN ACCESS)
-- ============================================================
-- Simplified RLS policies - allows all authenticated users to access

-- Drop existing policies
DROP POLICY IF EXISTS "section_attachments_collaborator_select" ON public.section_attachments;
DROP POLICY IF EXISTS "section_attachments_collaborator_insert" ON public.section_attachments;
DROP POLICY IF EXISTS "section_attachments_delete" ON public.section_attachments;
DROP POLICY IF EXISTS "section_attachments_team_select" ON public.section_attachments;
DROP POLICY IF EXISTS "section_attachments_team_insert" ON public.section_attachments;
DROP POLICY IF EXISTS "section_attachments_team_delete" ON public.section_attachments;

-- ============================================================
-- SIMPLE RLS POLICIES - ALL AUTHENTICATED USERS
-- ============================================================

-- All authenticated users can view attachments
CREATE POLICY "section_attachments_authenticated_select" ON public.section_attachments
FOR SELECT
TO authenticated
USING (true);

-- All authenticated users can upload attachments
CREATE POLICY "section_attachments_authenticated_insert" ON public.section_attachments
FOR INSERT
TO authenticated
WITH CHECK (uploaded_by = auth.uid());

-- Users can delete their own attachments
CREATE POLICY "section_attachments_owner_delete" ON public.section_attachments
FOR DELETE
TO authenticated
USING (uploaded_by = auth.uid());

-- ============================================================
-- COMMENTS
-- ============================================================
COMMENT ON POLICY "section_attachments_authenticated_select" ON public.section_attachments IS 
'Allows all authenticated users to view attachments';

COMMENT ON POLICY "section_attachments_authenticated_insert" ON public.section_attachments IS 
'Allows all authenticated users to upload attachments';

COMMENT ON POLICY "section_attachments_owner_delete" ON public.section_attachments IS 
'Allows users to delete only their own attachments';

-- ============================================================
-- END OF MIGRATION 030
-- ============================================================
