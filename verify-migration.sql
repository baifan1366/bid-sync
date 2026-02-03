-- ============================================================
-- VERIFICATION SCRIPT: Check if Migration 043 was applied
-- ============================================================

-- 1. Check if new RLS policies exist on workspace_documents
SELECT 
    schemaname,
    tablename,
    policyname,
    cmd as command,
    qual as using_expression
FROM pg_policies 
WHERE tablename = 'workspace_documents'
ORDER BY policyname;

-- Expected results:
-- documents_select (should contain proposal_team_members check)
-- documents_insert
-- documents_update (should contain proposal_team_members check)
-- documents_delete (should contain proposal_team_members check)

-- ============================================================

-- 2. Check the documents_select policy specifically
SELECT 
    policyname,
    pg_get_expr(qual, 'workspace_documents'::regclass) as policy_definition
FROM pg_policy p
JOIN pg_class c ON p.polrelid = c.oid
WHERE c.relname = 'workspace_documents'
AND policyname = 'documents_select';

-- The policy_definition should contain:
-- - document_collaborators check
-- - proposal_team_members check

-- ============================================================

-- 3. Check if has_document_permission function exists and was updated
SELECT 
    proname as function_name,
    pg_get_functiondef(oid) as function_definition
FROM pg_proc 
WHERE proname = 'has_document_permission';

-- The function should check both:
-- - document_collaborators
-- - proposal_team_members

-- ============================================================

-- 4. Test the policy as a team member (run this while logged in as member)
-- This will show if you can see documents through team membership
SELECT 
    wd.id,
    wd.title,
    wd.workspace_id,
    'Can see this document' as access_status
FROM workspace_documents wd
WHERE EXISTS (
    SELECT 1 FROM workspaces w
    INNER JOIN proposals p ON p.project_id = w.project_id
    INNER JOIN proposal_team_members ptm ON ptm.proposal_id = p.id
    WHERE w.id = wd.workspace_id
    AND ptm.user_id = auth.uid()
)
LIMIT 5;

-- If this returns results, the policy is working!

-- ============================================================

-- 5. Check your team membership
SELECT 
    ptm.id,
    ptm.proposal_id,
    ptm.user_id,
    ptm.role,
    p.project_id,
    p.title as proposal_title
FROM proposal_team_members ptm
INNER JOIN proposals p ON p.id = ptm.proposal_id
WHERE ptm.user_id = auth.uid();

-- This should show your team memberships

-- ============================================================

-- 6. Check if you can access workspace documents through your team membership
SELECT 
    wd.id as document_id,
    wd.title as document_title,
    w.id as workspace_id,
    p.id as proposal_id,
    p.title as proposal_title,
    ptm.role as your_role
FROM workspace_documents wd
INNER JOIN workspaces w ON w.id = wd.workspace_id
INNER JOIN proposals p ON p.project_id = w.project_id
INNER JOIN proposal_team_members ptm ON ptm.proposal_id = p.id
WHERE ptm.user_id = auth.uid();

-- This should show all documents you can access as a team member
