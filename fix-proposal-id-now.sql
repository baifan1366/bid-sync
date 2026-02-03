-- Fix: Set proposal_id for workspace 45a99ca8-2066-44ff-b3e6-ea81588902e2

-- First, find the proposal for this workspace
SELECT 
    'Finding proposal' as step,
    p.id as proposal_id,
    p.project_id,
    p.lead_id,
    w.id as workspace_id,
    w.name as workspace_name
FROM workspaces w
INNER JOIN proposals p ON p.project_id = w.project_id AND p.lead_id = w.lead_id
WHERE w.id = '45a99ca8-2066-44ff-b3e6-ea81588902e2';

-- Update this specific workspace with its proposal_id
UPDATE workspaces w
SET proposal_id = p.id
FROM proposals p
WHERE w.project_id = p.project_id 
  AND w.lead_id = p.lead_id
  AND w.id = '45a99ca8-2066-44ff-b3e6-ea81588902e2'
  AND w.proposal_id IS NULL;

-- Verify the update
SELECT 
    'After update' as step,
    id,
    name,
    project_id,
    lead_id,
    proposal_id,
    CASE 
        WHEN proposal_id IS NOT NULL THEN '✅ Fixed'
        ELSE '❌ Still NULL'
    END as status
FROM workspaces
WHERE id = '45a99ca8-2066-44ff-b3e6-ea81588902e2';

-- BONUS: Fix ALL workspaces with NULL proposal_id
UPDATE workspaces w
SET proposal_id = p.id
FROM proposals p
WHERE w.project_id = p.project_id 
  AND w.lead_id = p.lead_id
  AND w.proposal_id IS NULL;

-- Show how many were fixed
SELECT 
    'Summary' as step,
    COUNT(*) as total_workspaces,
    COUNT(proposal_id) as workspaces_with_proposal_id,
    COUNT(*) - COUNT(proposal_id) as workspaces_still_null
FROM workspaces;
