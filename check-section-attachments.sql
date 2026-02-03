-- Check if section_attachments table exists and has data
SELECT 
  sa.id,
  sa.section_id,
  sa.file_name,
  sa.file_type,
  sa.file_size,
  sa.created_at,
  ds.title as section_title,
  d.title as document_title
FROM section_attachments sa
LEFT JOIN document_sections ds ON ds.id = sa.section_id
LEFT JOIN documents d ON d.id = ds.document_id
ORDER BY sa.created_at DESC
LIMIT 20;

-- Check sections for a specific proposal
-- Replace with your proposal ID
SELECT 
  ds.id as section_id,
  ds.title as section_title,
  ds.document_id,
  d.title as document_title,
  d.workspace_id,
  w.proposal_id,
  COUNT(sa.id) as attachment_count
FROM document_sections ds
LEFT JOIN documents d ON d.id = ds.document_id
LEFT JOIN workspaces w ON w.id = d.workspace_id
LEFT JOIN section_attachments sa ON sa.section_id = ds.id
WHERE w.proposal_id = '61a2a5ce-1827-4de4-81e4-62b2c58191a6'  -- Your proposal ID
GROUP BY ds.id, ds.title, ds.document_id, d.title, d.workspace_id, w.proposal_id
ORDER BY ds."order";

-- Check if there are any attachments at all
SELECT COUNT(*) as total_attachments FROM section_attachments;

-- Check table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'section_attachments'
ORDER BY ordinal_position;
