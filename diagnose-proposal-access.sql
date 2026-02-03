-- Diagnose Proposal Access Issue
-- This checks why proposal_id 6515207e-dbb8-466d-8426-caebbefbb2e5 is not found

-- Step 1: Check if the proposal exists (using admin/service role)
SELECT 
    id,
    title,
    status,
    project_id,
    lead_id,
    created_at,
    updated_at
FROM proposals
WHERE id = '6515207e-dbb8-466d-8426-caebbefbb2e5';

-- Step 2: Check the workspace details
SELECT 
    id,
    name,
    project_id,
    proposal_id,
    lead_id,
    created_at
FROM workspaces
WHERE id = '45a99ca8-2066-44ff-b3e6-ea81588902e2';

-- Step 3: Check if there's a mismatch between workspace.proposal_id and actual proposals
SELECT 
    w.id as workspace_id,
    w.name as workspace_name,
    w.proposal_id as workspace_proposal_id,
    w.project_id as workspace_project_id,
    w.lead_id as workspace_lead_id,
    p.id as actual_proposal_id,
    p.title as proposal_title,
    p.project_id as proposal_project_id,
    p.lead_id as proposal_lead_id,
    CASE 
        WHEN w.proposal_id IS NULL THEN 'Missing proposal_id'
        WHEN p.id IS NULL THEN 'Proposal does not exist'
        WHEN w.proposal_id != p.id THEN 'Proposal ID mismatch'
        ELSE 'OK'
    END as status
FROM workspaces w
LEFT JOIN proposals p ON p.id = w.proposal_id
WHERE w.id = '45a99ca8-2066-44ff-b3e6-ea81588902e2';

-- Step 4: Find the correct proposal for this workspace
SELECT 
    p.id as proposal_id,
    p.title,
    p.status,
    p.project_id,
    p.lead_id,
    w.id as workspace_id,
    w.name as workspace_name,
    w.proposal_id as current_workspace_proposal_id
FROM workspaces w
INNER JOIN proposals p ON p.project_id = w.project_id AND p.lead_id = w.lead_id
WHERE w.id = '45a99ca8-2066-44ff-b3e6-ea81588902e2';

-- Step 5: Check RLS policies on proposals table
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies 
WHERE tablename = 'proposals'
ORDER BY policyname;

-- Step 6: Check if there are orphaned workspaces (proposal_id points to non-existent proposal)
SELECT 
    w.id as workspace_id,
    w.name as workspace_name,
    w.proposal_id,
    w.project_id,
    w.lead_id,
    p.id as found_proposal_id
FROM workspaces w
LEFT JOIN proposals p ON p.id = w.proposal_id
WHERE w.proposal_id IS NOT NULL 
  AND p.id IS NULL
ORDER BY w.created_at DESC;

-- Step 7: Fix orphaned workspaces by finding the correct proposal
UPDATE workspaces w
SET proposal_id = p.id
FROM proposals p
WHERE w.proposal_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM proposals WHERE id = w.proposal_id)
  AND p.project_id = w.project_id
  AND p.lead_id = w.lead_id;

-- Step 8: Verify the fix for the specific workspace
SELECT 
    w.id as workspace_id,
    w.name as workspace_name,
    w.proposal_id,
    p.id as proposal_id_check,
    p.title as proposal_title,
    CASE 
        WHEN p.id IS NOT NULL THEN '✅ Fixed'
        ELSE '❌ Still broken'
    END as status
FROM workspaces w
LEFT JOIN proposals p ON p.id = w.proposal_id
WHERE w.id = '45a99ca8-2066-44ff-b3e6-ea81588902e2';
