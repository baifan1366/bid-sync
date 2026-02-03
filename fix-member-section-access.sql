-- Fix Member Section Access
-- This script ensures members can see sections for proposals they're assigned to

-- Step 1: Check if workspaces have proposal_id set
SELECT 
    w.id as workspace_id,
    w.name as workspace_name,
    w.project_id,
    w.proposal_id,
    w.lead_id,
    p.id as found_proposal_id,
    p.title as proposal_title
FROM workspaces w
LEFT JOIN proposals p ON p.project_id = w.project_id AND p.lead_id = w.lead_id
WHERE w.proposal_id IS NULL
ORDER BY w.created_at DESC;

-- Step 2: Update workspaces to set proposal_id if missing
UPDATE workspaces w
SET proposal_id = p.id
FROM proposals p
WHERE w.proposal_id IS NULL
  AND p.project_id = w.project_id
  AND p.lead_id = w.lead_id;

-- Step 3: Verify the update
SELECT 
    w.id as workspace_id,
    w.name as workspace_name,
    w.proposal_id,
    p.title as proposal_title,
    COUNT(DISTINCT ds.id) as section_count
FROM workspaces w
LEFT JOIN proposals p ON p.id = w.proposal_id
LEFT JOIN workspace_documents wd ON wd.workspace_id = w.id
LEFT JOIN document_sections ds ON ds.document_id = wd.id
GROUP BY w.id, w.name, w.proposal_id, p.title
ORDER BY w.created_at DESC;

-- Step 4: Check RLS policies for document_sections
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
WHERE tablename = 'document_sections'
ORDER BY policyname;

-- Step 5: Show sections and their assignments
SELECT 
    ds.id as section_id,
    ds.title as section_title,
    ds.assigned_to,
    ds.status,
    wd.id as document_id,
    wd.title as document_title,
    w.id as workspace_id,
    w.name as workspace_name,
    w.proposal_id,
    p.title as proposal_title
FROM document_sections ds
INNER JOIN workspace_documents wd ON ds.document_id = wd.id
INNER JOIN workspaces w ON wd.workspace_id = w.id
LEFT JOIN proposals p ON p.id = w.proposal_id
ORDER BY w.created_at DESC, ds.order ASC
LIMIT 20;
