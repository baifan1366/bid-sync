-- Check current RLS policies on workspaces table
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'workspaces'
ORDER BY policyname;

-- Check if RLS is enabled on workspaces
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE tablename = 'workspaces';

-- Test workspace access for current user
-- Replace 'YOUR_USER_ID' with actual user ID
SELECT 
    w.id,
    w.name,
    w.project_id,
    w.lead_id,
    w.proposal_id,
    'Can access' as status
FROM workspaces w
WHERE w.id = '45a99ca8-2066-44ff-b3e6-ea81588902e2';

-- Check if user is in proposal_team_members
-- Replace 'YOUR_USER_ID' with actual user ID
SELECT 
    ptm.proposal_id,
    ptm.user_id,
    ptm.role,
    p.project_id,
    w.id as workspace_id,
    w.name as workspace_name
FROM proposal_team_members ptm
INNER JOIN proposals p ON p.id = ptm.proposal_id
LEFT JOIN workspaces w ON w.proposal_id = p.id
WHERE ptm.user_id = 'YOUR_USER_ID'
ORDER BY ptm.created_at DESC;

-- Check workspace and its proposal relationship
SELECT 
    w.id as workspace_id,
    w.name as workspace_name,
    w.project_id,
    w.lead_id,
    w.proposal_id,
    p.id as proposal_exists,
    p.lead_id as proposal_lead_id,
    COUNT(ptm.user_id) as team_member_count
FROM workspaces w
LEFT JOIN proposals p ON p.id = w.proposal_id
LEFT JOIN proposal_team_members ptm ON ptm.proposal_id = p.id
WHERE w.id = '45a99ca8-2066-44ff-b3e6-ea81588902e2'
GROUP BY w.id, w.name, w.project_id, w.lead_id, w.proposal_id, p.id, p.lead_id;
