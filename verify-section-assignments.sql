-- Verify Section Assignments for User
-- This checks if the user has proper section assignments

-- User ID: d0499dba-43f2-4988-9e62-b1726e2eb7f1
-- Proposal ID: 6515207e-dbb8-466d-8426-caebbefbb2e5
-- Workspace ID: 45a99ca8-2066-44ff-b3e6-ea81588902e2

-- Step 1: Check all sections in the workspace with their assignments
SELECT
    ds.id as section_id,
    ds.title as section_title,
    ds.assigned_to,
    ds.status,
    ds.document_id,
    wd.title as document_title,
    u.email as assigned_user_email,
    CASE 
        WHEN ds.assigned_to = 'd0499dba-43f2-4988-9e62-b1726e2eb7f1' THEN '✅ Assigned to you'
        WHEN ds.assigned_to IS NULL THEN '⚠️ Unassigned'
        ELSE '❌ Assigned to other'
    END as assignment_status
FROM document_sections ds
INNER JOIN workspace_documents wd ON wd.id = ds.document_id
LEFT JOIN auth.users u ON u.id = ds.assigned_to
WHERE wd.workspace_id = '45a99ca8-2066-44ff-b3e6-ea81588902e2'
ORDER BY wd.title, ds.order_index;

-- Step 2: Check sections assigned to this specific user
SELECT
    ds.id as section_id,
    ds.title as section_title,
    ds.status,
    ds.deadline,
    wd.title as document_title,
    ds.updated_at
FROM document_sections ds
INNER JOIN workspace_documents wd ON wd.id = ds.document_id
WHERE wd.workspace_id = '45a99ca8-2066-44ff-b3e6-ea81588902e2'
  AND ds.assigned_to = 'd0499dba-43f2-4988-9e62-b1726e2eb7f1'
ORDER BY wd.title, ds.order_index;

-- Step 3: Check ALL section assignments for this workspace (to see who can edit what)
SELECT
    ds.assigned_to as user_id,
    u.email as user_email,
    COUNT(*) as sections_assigned,
    STRING_AGG(ds.title, ', ' ORDER BY ds.title) as section_titles
FROM document_sections ds
INNER JOIN workspace_documents wd ON wd.id = ds.document_id
LEFT JOIN auth.users u ON u.id = ds.assigned_to
WHERE wd.workspace_id = '45a99ca8-2066-44ff-b3e6-ea81588902e2'
  AND ds.assigned_to IS NOT NULL
GROUP BY ds.assigned_to, u.email
ORDER BY u.email;

-- Step 4: Find sections WITHOUT assignments (these can only be edited by leads)
SELECT
    ds.id as section_id,
    ds.title as section_title,
    ds.status,
    wd.title as document_title
FROM document_sections ds
INNER JOIN workspace_documents wd ON wd.id = ds.document_id
WHERE wd.workspace_id = '45a99ca8-2066-44ff-b3e6-ea81588902e2'
  AND ds.assigned_to IS NULL
ORDER BY wd.title, ds.order_index;

-- Step 5: Simulate RLS check for all sections (shows what the policy will allow)
SELECT
    ds.id as section_id,
    ds.title,
    ds.assigned_to,
    -- Check 1: Is user a document collaborator?
    EXISTS (
        SELECT 1 FROM document_collaborators dc 
        WHERE dc.document_id = ds.document_id 
        AND dc.user_id = 'd0499dba-43f2-4988-9e62-b1726e2eb7f1'
    ) as is_collaborator,
    -- Check 2: Is user assigned to this section?
    (ds.assigned_to = 'd0499dba-43f2-4988-9e62-b1726e2eb7f1') as is_assigned,
    -- Check 3: Is user a proposal lead?
    EXISTS (
        SELECT 1 FROM workspace_documents wd
        INNER JOIN workspaces w ON w.id = wd.workspace_id
        INNER JOIN proposal_team_members ptm ON ptm.proposal_id = w.proposal_id
        WHERE wd.id = ds.document_id
        AND w.proposal_id IS NOT NULL
        AND ptm.user_id = 'd0499dba-43f2-4988-9e62-b1726e2eb7f1'
        AND ptm.role = 'lead'
    ) as is_lead,
    -- Overall: Should user have UPDATE access?
    (
        EXISTS (
            SELECT 1 FROM document_collaborators dc 
            WHERE dc.document_id = ds.document_id 
            AND dc.user_id = 'd0499dba-43f2-4988-9e62-b1726e2eb7f1'
            AND dc.role IN ('owner', 'editor')
        )
        OR ds.assigned_to = 'd0499dba-43f2-4988-9e62-b1726e2eb7f1'
        OR EXISTS (
            SELECT 1 FROM workspace_documents wd
            INNER JOIN workspaces w ON w.id = wd.workspace_id
            INNER JOIN proposal_team_members ptm ON ptm.proposal_id = w.proposal_id
            WHERE wd.id = ds.document_id
            AND w.proposal_id IS NOT NULL
            AND ptm.user_id = 'd0499dba-43f2-4988-9e62-b1726e2eb7f1'
            AND ptm.role = 'lead'
        )
    ) as can_update
FROM document_sections ds
INNER JOIN workspace_documents wd ON wd.id = ds.document_id
WHERE wd.workspace_id = '45a99ca8-2066-44ff-b3e6-ea81588902e2'
ORDER BY wd.title, ds.order_index;
