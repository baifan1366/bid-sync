-- Quick check: Are the new RLS policies in place?

-- 1. Check policy names
SELECT policyname 
FROM pg_policies 
WHERE tablename = 'workspace_documents'
ORDER BY policyname;

-- Expected output:
-- documents_delete
-- documents_insert
-- documents_select
-- documents_update

-- If you see "documents_collaborator_select" or "documents_creator_insert",
-- the old policies are still there and migration didn't run!

-- 2. Check if documents_select policy includes proposal_team_members
SELECT 
    policyname,
    pg_get_expr(qual, 'workspace_documents'::regclass) as policy_definition
FROM pg_policy p
JOIN pg_class c ON p.polrelid = c.oid
WHERE c.relname = 'workspace_documents'
AND policyname = 'documents_select';

-- The policy_definition should contain "proposal_team_members"
-- If it doesn't, the migration didn't apply correctly
