-- ============================================================
-- Diagnose Workspace-Proposal Mapping Issue
-- ============================================================
-- This script helps identify why proposals show the same sections
-- ============================================================

-- Step 1: Check how many proposals exist per project
SELECT 
    'Proposals per Project' as check_type,
    project_id,
    COUNT(*) as proposal_count,
    array_agg(id) as proposal_ids,
    array_agg(title) as proposal_titles
FROM proposals
GROUP BY project_id
HAVING COUNT(*) > 1
ORDER BY proposal_count DESC;

-- Step 2: Check workspace-proposal mapping
SELECT 
    'Workspace-Proposal Mapping' as check_type,
    w.id as workspace_id,
    w.project_id,
    w.proposal_id,
    w.name as workspace_name,
    p.title as proposal_title,
    p.lead_id as proposal_lead_id,
    w.lead_id as workspace_lead_id,
    CASE 
        WHEN w.proposal_id IS NULL THEN '❌ No proposal_id'
        WHEN w.proposal_id = p.id THEN '✅ Correct mapping'
        ELSE '⚠️ Mismatch'
    END as mapping_status
FROM workspaces w
LEFT JOIN proposals p ON p.id = w.proposal_id
ORDER BY w.project_id, w.proposal_id;

-- Step 3: Find proposals without dedicated workspaces
SELECT 
    'Proposals WITHOUT Workspace' as check_type,
    p.id as proposal_id,
    p.title as proposal_title,
    p.project_id,
    p.lead_id,
    p.status
FROM proposals p
WHERE NOT EXISTS (
    SELECT 1 FROM workspaces w 
    WHERE w.proposal_id = p.id
)
ORDER BY p.project_id;

-- Step 4: Find workspaces shared by multiple proposals (via project_id)
SELECT 
    'Shared Workspaces' as check_type,
    w.id as workspace_id,
    w.project_id,
    w.proposal_id,
    COUNT(p.id) as proposals_in_project,
    array_agg(p.id) as all_proposal_ids,
    array_agg(p.title) as all_proposal_titles
FROM workspaces w
JOIN proposals p ON p.project_id = w.project_id
GROUP BY w.id, w.project_id, w.proposal_id
HAVING COUNT(p.id) > 1
ORDER BY proposals_in_project DESC;

-- Step 5: Check document sections per workspace
SELECT 
    'Sections per Workspace' as check_type,
    w.id as workspace_id,
    w.proposal_id,
    p.title as proposal_title,
    COUNT(DISTINCT wd.id) as document_count,
    COUNT(DISTINCT ds.id) as section_count,
    array_agg(DISTINCT ds.title) as section_titles
FROM workspaces w
LEFT JOIN proposals p ON p.id = w.proposal_id
LEFT JOIN workspace_documents wd ON wd.workspace_id = w.id
LEFT JOIN document_sections ds ON ds.document_id = wd.id
GROUP BY w.id, w.proposal_id, p.title
ORDER BY w.proposal_id;

-- Step 6: Identify the root cause
WITH proposal_workspace_check AS (
    SELECT 
        p.id as proposal_id,
        p.title as proposal_title,
        p.project_id,
        w.id as workspace_id,
        w.proposal_id as workspace_proposal_id,
        CASE 
            WHEN w.proposal_id = p.id THEN 'Has dedicated workspace'
            WHEN w.proposal_id IS NULL THEN 'Using project workspace (shared)'
            WHEN w.proposal_id != p.id THEN 'Wrong workspace mapping'
            ELSE 'No workspace found'
        END as workspace_status
    FROM proposals p
    LEFT JOIN workspaces w ON w.proposal_id = p.id
)
SELECT 
    'Root Cause Analysis' as check_type,
    workspace_status,
    COUNT(*) as proposal_count,
    array_agg(proposal_id) as affected_proposals
FROM proposal_workspace_check
GROUP BY workspace_status
ORDER BY proposal_count DESC;

-- Step 7: Show the actual problem - proposals sharing sections
SELECT 
    'Proposals Sharing Same Sections' as check_type,
    ds.id as section_id,
    ds.title as section_title,
    ds.document_id,
    wd.workspace_id,
    w.proposal_id as workspace_proposal_id,
    array_agg(DISTINCT p.id) as proposals_seeing_this_section,
    array_agg(DISTINCT p.title) as proposal_titles,
    COUNT(DISTINCT p.id) as proposal_count
FROM document_sections ds
JOIN workspace_documents wd ON wd.id = ds.document_id
JOIN workspaces w ON w.id = wd.workspace_id
JOIN proposals p ON p.project_id = w.project_id
GROUP BY ds.id, ds.title, ds.document_id, wd.workspace_id, w.proposal_id
HAVING COUNT(DISTINCT p.id) > 1
ORDER BY proposal_count DESC;

-- Step 8: Recommended fix based on findings
SELECT 
    'Recommended Fix' as info,
    CASE 
        WHEN (SELECT COUNT(*) FROM workspaces WHERE proposal_id IS NULL) > 0 
        THEN '❌ Found workspaces without proposal_id - need to create dedicated workspaces'
        WHEN (SELECT COUNT(*) FROM proposals WHERE NOT EXISTS (SELECT 1 FROM workspaces WHERE workspaces.proposal_id = proposals.id)) > 0
        THEN '❌ Found proposals without dedicated workspaces - need to create workspaces'
        ELSE '✅ All proposals have dedicated workspaces - check resolver logic'
    END as recommendation;
