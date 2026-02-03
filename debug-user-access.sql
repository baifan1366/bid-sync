-- Debug script for user d0499dba-43f2-4988-9e62-b1726e2eb7f1
-- Replace with your actual user ID if different

-- Step 1: Check if migration 046 was applied
SELECT 
    'Migration 046 Status' as check_type,
    CASE 
        WHEN COUNT(*) = 1 THEN '✅ Applied'
        ELSE '❌ NOT Applied'
    END as status
FROM pg_policies 
WHERE tablename = 'workspaces' 
AND policyname = 'workspaces_team_select';

-- Step 2: Check if user is in proposal_team_members
SELECT 
    'User in proposal_team_members' as check_type,
    ptm.proposal_id,
    ptm.role,
    p.project_id,
    w.id as workspace_id
FROM proposal_team_members ptm
INNER JOIN proposals p ON p.id = ptm.proposal_id
LEFT JOIN workspaces w ON w.proposal_id = p.id
WHERE ptm.user_id = 'd0499dba-43f2-4988-9e62-b1726e2eb7f1'
AND w.id = '45a99ca8-2066-44ff-b3e6-ea81588902e2';

-- Step 3: Check workspace details
SELECT 
    'Workspace Details' as check_type,
    w.id,
    w.name,
    w.project_id,
    w.lead_id,
    w.proposal_id,
    CASE 
        WHEN w.lead_id = 'd0499dba-43f2-4988-9e62-b1726e2eb7f1' THEN '✅ User IS lead'
        ELSE '❌ User is NOT lead'
    END as is_lead
FROM workspaces w
WHERE w.id = '45a99ca8-2066-44ff-b3e6-ea81588902e2';

-- Step 4: Check if proposal_id is set
SELECT 
    'Proposal ID Status' as check_type,
    CASE 
        WHEN proposal_id IS NULL THEN '❌ NULL - Run migration 044'
        ELSE '✅ Set to: ' || proposal_id::text
    END as status
FROM workspaces
WHERE id = '45a99ca8-2066-44ff-b3e6-ea81588902e2';

-- Step 5: Find proposal by project_id + lead_id (fallback method)
SELECT 
    'Proposal via project_id + lead_id' as check_type,
    p.id as proposal_id,
    p.lead_id,
    p.status
FROM workspaces w
INNER JOIN proposals p ON p.project_id = w.project_id AND p.lead_id = w.lead_id
WHERE w.id = '45a99ca8-2066-44ff-b3e6-ea81588902e2';

-- Step 6: Check if user would pass RLS policy
SELECT 
    'RLS Policy Test' as check_type,
    CASE 
        WHEN w.lead_id = 'd0499dba-43f2-4988-9e62-b1726e2eb7f1' THEN '✅ PASS: User is lead'
        WHEN EXISTS (
            SELECT 1 
            FROM proposal_team_members ptm
            WHERE ptm.proposal_id = w.proposal_id
            AND ptm.user_id = 'd0499dba-43f2-4988-9e62-b1726e2eb7f1'
        ) THEN '✅ PASS: User in team (via proposal_id)'
        WHEN EXISTS (
            SELECT 1 
            FROM proposals p
            INNER JOIN proposal_team_members ptm ON ptm.proposal_id = p.id
            WHERE p.project_id = w.project_id
            AND p.lead_id = w.lead_id
            AND ptm.user_id = 'd0499dba-43f2-4988-9e62-b1726e2eb7f1'
        ) THEN '✅ PASS: User in team (via project_id + lead_id fallback)'
        ELSE '❌ FAIL: User has NO access'
    END as result
FROM workspaces w
WHERE w.id = '45a99ca8-2066-44ff-b3e6-ea81588902e2';
