-- Check for orphaned workspace_documents (documents with workspace_id that doesn't exist)
SELECT 
    wd.id as document_id,
    wd.workspace_id,
    wd.title,
    wd.created_at,
    wd.created_by
FROM workspace_documents wd
LEFT JOIN workspaces w ON wd.workspace_id = w.id
WHERE w.id IS NULL;

-- Check if the specific workspace exists
SELECT * FROM workspaces WHERE id = '45a99ca8-2066-44ff-b3e6-ea81588902e2';

-- Check if there are documents referencing this workspace
SELECT * FROM workspace_documents WHERE workspace_id = '45a99ca8-2066-44ff-b3e6-ea81588902e2';

-- Check all workspaces and their documents
SELECT 
    w.id as workspace_id,
    w.name,
    w.project_id,
    w.lead_id,
    COUNT(wd.id) as document_count
FROM workspaces w
LEFT JOIN workspace_documents wd ON w.id = wd.workspace_id
GROUP BY w.id, w.name, w.project_id, w.lead_id
ORDER BY w.created_at DESC
LIMIT 20;
