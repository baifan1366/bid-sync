-- ============================================================
-- CLEANUP: Remove old conflicting RLS policies
-- ============================================================
-- 
-- Problem: Old policies (wd_*) are conflicting with new policies
-- Solution: Drop all old policies, keep only the new ones
-- ============================================================

BEGIN;

-- Drop all old workspace_documents policies with 'wd_' prefix
DROP POLICY IF EXISTS "wd_admin_all" ON public.workspace_documents;
DROP POLICY IF EXISTS "wd_collaborator_select" ON public.workspace_documents;
DROP POLICY IF EXISTS "wd_creator_insert" ON public.workspace_documents;
DROP POLICY IF EXISTS "wd_editor_update" ON public.workspace_documents;
DROP POLICY IF EXISTS "wd_owner_delete" ON public.workspace_documents;
DROP POLICY IF EXISTS "wd_workspace_lead_select" ON public.workspace_documents;

-- Also drop any other old policy names
DROP POLICY IF EXISTS "documents_collaborator_select" ON public.workspace_documents;
DROP POLICY IF EXISTS "documents_creator_insert" ON public.workspace_documents;
DROP POLICY IF EXISTS "documents_editor_update" ON public.workspace_documents;
DROP POLICY IF EXISTS "documents_owner_delete" ON public.workspace_documents;

COMMIT;

-- Verify: Check remaining policies
SELECT policyname, cmd
FROM pg_policies 
WHERE tablename = 'workspace_documents'
ORDER BY policyname;

-- Expected result: Only these 4 policies should remain:
-- documents_delete
-- documents_insert
-- documents_select
-- documents_update

-- Success message
DO $$
BEGIN
    RAISE NOTICE '==============================================';
    RAISE NOTICE 'Old policies cleaned up successfully!';
    RAISE NOTICE 'Only new policies remain.';
    RAISE NOTICE 'Team members should now have access.';
    RAISE NOTICE '==============================================';
END $$;
