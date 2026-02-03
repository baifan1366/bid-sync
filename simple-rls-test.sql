-- Simple RLS test

-- First, check what policies exist
SELECT policyname, cmd, qual 
FROM pg_policies 
WHERE tablename = 'workspaces';

-- Check if the workspace exists (bypass RLS)
SELECT id, name, project_id, lead_id, proposal_id
FROM workspaces
WHERE id = '45a99ca8-2066-44ff-b3e6-ea81588902e2';

-- Check if user is in proposal_team_members
SELECT 
    ptm.user_id,
    ptm.proposal_id,
    ptm.role,
    p.project_id,
    w.id as workspace_id
FROM proposal_team_members ptm
INNER JOIN proposals p ON p.id = ptm.proposal_id
INNER JOIN workspaces w ON (w.proposal_id = p.id OR (w.project_id = p.project_id AND w.lead_id = p.lead_id))
WHERE ptm.user_id = 'd0499dba-43f2-4988-9e62-b1726e2eb7f1'
AND w.id = '45a99ca8-2066-44ff-b3e6-ea81588902e2';
