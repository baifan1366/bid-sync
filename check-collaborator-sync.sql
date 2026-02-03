-- Check if team members are synced to document collaborators
-- User: d0499dba-43f2-4988-9e62-b1726e2eb7f1
-- Workspace: 45a99ca8-2066-44ff-b3e6-ea81588902e2
-- Proposal: 6515207e-dbb8-466d-8426-caebbefbb2e5

-- Step 1: Is user a team member?
SELECT 
    'Is Team Member?' as check,
    CASE WHEN COUNT(*) > 0 THEN '✅ YES' ELSE '❌ NO' END as result,
    COUNT(*) as count
FROM proposal_team_members
WHERE user_id = 'd0499dba-43f2-4988-9e62-b1726e2eb7f1'
  AND proposal_id = '6515207e-dbb8-466d-8426-caebbefbb2e5';

-- Step 2: Is user a document collaborator for ANY document in the workspace?
SELECT 
    'Is Document Collaborator?' as check,
    CASE WHEN COUNT(*) > 0 THEN '✅ YES' ELSE '❌ NO' END as result,
    COUNT(*) as count
FROM document_collaborators dc
INNER JOIN workspace_documents wd ON wd.id = dc.document_id
WHERE dc.user_id = 'd0499dba-43f2-4988-9e62-b1726e2eb7f1'
  AND wd.workspace_id = '45a99ca8-2066-44ff-b3e6-ea81588902e2';

-- Step 3: Show all documents in workspace and whether user is a collaborator
SELECT 
    wd.id as document_id,
    wd.title as document_title,
    CASE 
        WHEN dc.id IS NOT NULL THEN '✅ Is Collaborator'
        ELSE '❌ NOT Collaborator'
    END as collaborator_status,
    dc.role as collaborator_role
FROM workspace_documents wd
LEFT JOIN document_collaborators dc ON dc.document_id = wd.id 
    AND dc.user_id = 'd0499dba-43f2-4988-9e62-b1726e2eb7f1'
WHERE wd.workspace_id = '45a99ca8-2066-44ff-b3e6-ea81588902e2'
ORDER BY wd.title;

-- Step 4: Show all team members and their collaborator status
SELECT 
    ptm.user_id,
    u.email,
    ptm.role as team_role,
    COUNT(dc.id) as documents_as_collaborator,
    COUNT(wd.id) as total_documents_in_workspace
FROM proposal_team_members ptm
INNER JOIN auth.users u ON u.id = ptm.user_id
CROSS JOIN workspaces w
CROSS JOIN workspace_documents wd
LEFT JOIN document_collaborators dc ON dc.document_id = wd.id AND dc.user_id = ptm.user_id
WHERE ptm.proposal_id = '6515207e-dbb8-466d-8426-caebbefbb2e5'
  AND w.proposal_id = ptm.proposal_id
  AND wd.workspace_id = w.id
GROUP BY ptm.user_id, u.email, ptm.role
ORDER BY u.email;

-- Step 5: DIAGNOSIS - What's the problem?
SELECT 
    CASE 
        WHEN team_member_count = 0 THEN '❌ User is NOT a team member'
        WHEN collaborator_count = 0 THEN '❌ User is team member but NOT a document collaborator (THIS IS THE PROBLEM!)'
        WHEN collaborator_count < document_count THEN '⚠️ User is collaborator on some but not all documents'
        ELSE '✅ User is properly synced'
    END as diagnosis,
    team_member_count,
    document_count,
    collaborator_count
FROM (
    SELECT 
        (SELECT COUNT(*) FROM proposal_team_members 
         WHERE user_id = 'd0499dba-43f2-4988-9e62-b1726e2eb7f1' 
         AND proposal_id = '6515207e-dbb8-466d-8426-caebbefbb2e5') as team_member_count,
        (SELECT COUNT(*) FROM workspace_documents 
         WHERE workspace_id = '45a99ca8-2066-44ff-b3e6-ea81588902e2') as document_count,
        (SELECT COUNT(*) FROM document_collaborators dc
         INNER JOIN workspace_documents wd ON wd.id = dc.document_id
         WHERE dc.user_id = 'd0499dba-43f2-4988-9e62-b1726e2eb7f1'
         AND wd.workspace_id = '45a99ca8-2066-44ff-b3e6-ea81588902e2') as collaborator_count
) counts;
