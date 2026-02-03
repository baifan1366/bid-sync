-- Diagnose Team Member Access Issue
-- Run this to understand why user d0499dba-43f2-4988-9e62-b1726e2eb7f1 cannot access the proposal

-- Step 1: Check if the user exists
SELECT 
    id,
    email,
    raw_user_meta_data->>'role' as role,
    raw_user_meta_data->>'name' as name
FROM auth.users
WHERE id = 'd0499dba-43f2-4988-9e62-b1726e2eb7f1';

-- Step 2: Check if the proposal exists
SELECT 
    id,
    title,
    status,
    project_id,
    lead_id,
    created_at
FROM proposals
WHERE id = '6515207e-dbb8-466d-8426-caebbefbb2e5';

-- Step 3: Check if the user is a team member of this proposal
SELECT 
    ptm.id,
    ptm.proposal_id,
    ptm.user_id,
    ptm.role,
    ptm.joined_at,
    u.email as user_email,
    p.title as proposal_title
FROM proposal_team_members ptm
INNER JOIN auth.users u ON u.id = ptm.user_id
INNER JOIN proposals p ON p.id = ptm.proposal_id
WHERE ptm.proposal_id = '6515207e-dbb8-466d-8426-caebbefbb2e5'
  AND ptm.user_id = 'd0499dba-43f2-4988-9e62-b1726e2eb7f1';

-- Step 4: Check all team members for this proposal
SELECT 
    ptm.id,
    ptm.user_id,
    ptm.role,
    u.email as user_email,
    ptm.joined_at
FROM proposal_team_members ptm
INNER JOIN auth.users u ON u.id = ptm.user_id
WHERE ptm.proposal_id = '6515207e-dbb8-466d-8426-caebbefbb2e5'
ORDER BY ptm.role, ptm.joined_at;

-- Step 5: Check workspace and document access
SELECT 
    w.id as workspace_id,
    w.name as workspace_name,
    w.proposal_id,
    w.lead_id,
    wd.id as document_id,
    wd.title as document_title,
    dc.user_id as collaborator_user_id,
    dc.role as collaborator_role,
    u.email as collaborator_email
FROM workspaces w
LEFT JOIN workspace_documents wd ON wd.workspace_id = w.id
LEFT JOIN document_collaborators dc ON dc.document_id = wd.id
LEFT JOIN auth.users u ON u.id = dc.user_id
WHERE w.id = '45a99ca8-2066-44ff-b3e6-ea81588902e2'
ORDER BY wd.title, dc.role;

-- Step 6: Check if user has document access
SELECT 
    dc.id,
    dc.document_id,
    dc.user_id,
    dc.role,
    wd.title as document_title,
    w.proposal_id,
    u.email as user_email
FROM document_collaborators dc
INNER JOIN workspace_documents wd ON wd.id = dc.document_id
INNER JOIN workspaces w ON w.id = wd.workspace_id
INNER JOIN auth.users u ON u.id = dc.user_id
WHERE dc.user_id = 'd0499dba-43f2-4988-9e62-b1726e2eb7f1'
  AND w.id = '45a99ca8-2066-44ff-b3e6-ea81588902e2';

-- Step 7: Simulate the RLS check for proposal_read
-- This shows what the RLS policy sees
SELECT 
    p.id,
    p.title,
    p.lead_id,
    -- Check 1: Is user the lead?
    (p.lead_id = 'd0499dba-43f2-4988-9e62-b1726e2eb7f1') as is_lead,
    -- Check 2: Is user a team member?
    EXISTS (
        SELECT 1 FROM proposal_team_members ptm 
        WHERE ptm.proposal_id = p.id 
        AND ptm.user_id = 'd0499dba-43f2-4988-9e62-b1726e2eb7f1'
    ) as is_team_member,
    -- Check 3: Is user the client?
    EXISTS (
        SELECT 1 FROM projects pr 
        WHERE pr.id = p.project_id 
        AND pr.client_id = 'd0499dba-43f2-4988-9e62-b1726e2eb7f1'
    ) as is_client,
    -- Check 4: Does user have document access?
    EXISTS (
        SELECT 1 FROM workspaces w
        INNER JOIN workspace_documents wd ON wd.workspace_id = w.id
        INNER JOIN document_collaborators dc ON dc.document_id = wd.id
        WHERE w.proposal_id = p.id
        AND dc.user_id = 'd0499dba-43f2-4988-9e62-b1726e2eb7f1'
    ) as has_document_access,
    -- Overall: Should user have access?
    (
        p.lead_id = 'd0499dba-43f2-4988-9e62-b1726e2eb7f1'
        OR EXISTS (
            SELECT 1 FROM proposal_team_members ptm 
            WHERE ptm.proposal_id = p.id 
            AND ptm.user_id = 'd0499dba-43f2-4988-9e62-b1726e2eb7f1'
        )
        OR EXISTS (
            SELECT 1 FROM projects pr 
            WHERE pr.id = p.project_id 
            AND pr.client_id = 'd0499dba-43f2-4988-9e62-b1726e2eb7f1'
        )
        OR EXISTS (
            SELECT 1 FROM workspaces w
            INNER JOIN workspace_documents wd ON wd.workspace_id = w.id
            INNER JOIN document_collaborators dc ON dc.document_id = wd.id
            WHERE w.proposal_id = p.id
            AND dc.user_id = 'd0499dba-43f2-4988-9e62-b1726e2eb7f1'
        )
    ) as should_have_access
FROM proposals p
WHERE p.id = '6515207e-dbb8-466d-8426-caebbefbb2e5';

-- Step 8: Check if the issue is that the user is not added as a team member
-- If this returns 0 rows, the user needs to be added to proposal_team_members
SELECT COUNT(*) as team_member_count
FROM proposal_team_members
WHERE proposal_id = '6515207e-dbb8-466d-8426-caebbefbb2e5'
  AND user_id = 'd0499dba-43f2-4988-9e62-b1726e2eb7f1';

-- Step 9: FIX - Add user as team member if they have document access but aren't in the team
-- This is a one-time fix for existing data
INSERT INTO proposal_team_members (proposal_id, user_id, role)
SELECT DISTINCT
    w.proposal_id,
    dc.user_id,
    CASE 
        WHEN dc.user_id = w.lead_id THEN 'lead'
        ELSE 'member'
    END as role
FROM workspaces w
INNER JOIN workspace_documents wd ON wd.workspace_id = w.id
INNER JOIN document_collaborators dc ON dc.document_id = wd.id
WHERE w.proposal_id IS NOT NULL
  AND dc.user_id = 'd0499dba-43f2-4988-9e62-b1726e2eb7f1'
  AND w.id = '45a99ca8-2066-44ff-b3e6-ea81588902e2'
  AND NOT EXISTS (
      SELECT 1 FROM proposal_team_members ptm
      WHERE ptm.proposal_id = w.proposal_id
      AND ptm.user_id = dc.user_id
  )
ON CONFLICT (proposal_id, user_id) DO NOTHING;

-- Step 10: Verify the fix
SELECT 
    ptm.id,
    ptm.proposal_id,
    ptm.user_id,
    ptm.role,
    u.email as user_email,
    p.title as proposal_title
FROM proposal_team_members ptm
INNER JOIN auth.users u ON u.id = ptm.user_id
INNER JOIN proposals p ON p.id = ptm.proposal_id
WHERE ptm.proposal_id = '6515207e-dbb8-466d-8426-caebbefbb2e5'
  AND ptm.user_id = 'd0499dba-43f2-4988-9e62-b1726e2eb7f1';

