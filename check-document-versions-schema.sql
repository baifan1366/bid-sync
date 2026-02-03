-- Check document_versions table schema
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'document_versions'
ORDER BY ordinal_position;

-- Check if the table exists
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_name = 'document_versions'
) as table_exists;
