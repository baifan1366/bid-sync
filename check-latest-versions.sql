-- Check latest versions for a document (without sections_snapshot and attachments_snapshot)
-- Replace 'YOUR_DOCUMENT_ID' with your actual document ID

SELECT 
  id,
  version_number,
  created_at,
  created_by,
  changes_summary,
  is_rollback
FROM document_versions
WHERE document_id = '210a4360-d536-44fd-b446-87f3a5bf6634'  -- Your document ID from logs
ORDER BY version_number DESC
LIMIT 10;

-- Check if version was created in last 5 minutes
SELECT 
  id,
  version_number,
  created_at,
  changes_summary,
  EXTRACT(EPOCH FROM (NOW() - created_at)) as seconds_ago
FROM document_versions
WHERE document_id = '210a4360-d536-44fd-b446-87f3a5bf6634'
  AND created_at > NOW() - INTERVAL '5 minutes'
ORDER BY created_at DESC;

-- Check if migration 047 columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'document_versions' 
AND column_name IN ('sections_snapshot', 'attachments_snapshot');

