-- Check if sections have document_id
SELECT 
  ds.id as section_id,
  ds.title as section_title,
  ds.document_id,
  ds.content,
  wd.id as workspace_doc_id,
  wd.title as workspace_doc_title,
  w.id as workspace_id,
  w.proposal_id,
  p.id as proposal_id_check
FROM document_sections ds
LEFT JOIN workspace_documents wd ON wd.id = ds.document_id
LEFT JOIN workspaces w ON w.id = wd.workspace_id
LEFT JOIN proposals p ON p.id = w.proposal_id
WHERE p.id = '6515207e-dbb8-466d-8426-caebbefbb2e5'
ORDER BY ds."order";

-- Check document_versions for these documents
SELECT 
  dv.id,
  dv.document_id,
  dv.version_number,
  dv.created_at,
  LENGTH(dv.content::text) as content_length,
  ds.id as section_id,
  ds.title as section_title
FROM document_versions dv
JOIN document_sections ds ON ds.document_id = dv.document_id
JOIN workspace_documents wd ON wd.id = dv.document_id
JOIN workspaces w ON w.id = wd.workspace_id
WHERE w.proposal_id = '6515207e-dbb8-466d-8426-caebbefbb2e5'
ORDER BY dv.version_number DESC
LIMIT 20;

-- Check section_attachments
SELECT 
  sa.id,
  sa.section_id,
  sa.file_name,
  sa.file_type,
  sa.file_size,
  ds.title as section_title,
  w.proposal_id
FROM section_attachments sa
JOIN document_sections ds ON ds.id = sa.section_id
JOIN workspace_documents wd ON wd.id = ds.document_id
JOIN workspaces w ON w.id = wd.workspace_id
WHERE w.proposal_id = '6515207e-dbb8-466d-8426-caebbefbb2e5';
