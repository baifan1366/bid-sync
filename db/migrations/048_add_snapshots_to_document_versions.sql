-- ============================================================
-- MIGRATION 048: ADD SNAPSHOTS TO DOCUMENT VERSIONS
-- ============================================================
-- Adds sections_snapshot and attachments_snapshot columns to document_versions table
-- to support complete version control for workspace documents

-- Add sections_snapshot column
ALTER TABLE document_versions 
ADD COLUMN IF NOT EXISTS sections_snapshot JSONB DEFAULT '[]'::jsonb;

-- Add attachments_snapshot column
ALTER TABLE document_versions 
ADD COLUMN IF NOT EXISTS attachments_snapshot JSONB DEFAULT '[]'::jsonb;

-- Add comments
COMMENT ON COLUMN document_versions.sections_snapshot IS 
'Snapshot of document sections at the time of version creation.';

COMMENT ON COLUMN document_versions.attachments_snapshot IS 
'Snapshot of section attachments at the time of version creation. Includes file metadata for all attachments associated with sections in this version.';

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_document_versions_sections_snapshot 
ON document_versions USING GIN (sections_snapshot);

CREATE INDEX IF NOT EXISTS idx_document_versions_attachments_snapshot 
ON document_versions USING GIN (attachments_snapshot);

-- ============================================================
-- VERIFICATION QUERIES
-- ============================================================

-- Verify columns were added
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'document_versions' 
        AND column_name = 'sections_snapshot'
    ) THEN
        RAISE NOTICE '✅ Column sections_snapshot added successfully';
    ELSE
        RAISE EXCEPTION '❌ Column sections_snapshot was not added';
    END IF;
    
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'document_versions' 
        AND column_name = 'attachments_snapshot'
    ) THEN
        RAISE NOTICE '✅ Column attachments_snapshot added successfully';
    ELSE
        RAISE EXCEPTION '❌ Column attachments_snapshot was not added';
    END IF;
END $$;

-- Verify indexes were created
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM pg_indexes 
        WHERE tablename = 'document_versions' 
        AND indexname = 'idx_document_versions_sections_snapshot'
    ) THEN
        RAISE NOTICE '✅ Index idx_document_versions_sections_snapshot created successfully';
    ELSE
        RAISE NOTICE '⚠️  Index idx_document_versions_sections_snapshot was not created';
    END IF;
    
    IF EXISTS (
        SELECT 1 
        FROM pg_indexes 
        WHERE tablename = 'document_versions' 
        AND indexname = 'idx_document_versions_attachments_snapshot'
    ) THEN
        RAISE NOTICE '✅ Index idx_document_versions_attachments_snapshot created successfully';
    ELSE
        RAISE NOTICE '⚠️  Index idx_document_versions_attachments_snapshot was not created';
    END IF;
END $$;

-- Show sample of existing versions (should have empty arrays for new columns)
SELECT 
    id,
    document_id,
    version_number,
    jsonb_array_length(COALESCE(sections_snapshot, '[]'::jsonb)) as sections_count,
    jsonb_array_length(COALESCE(attachments_snapshot, '[]'::jsonb)) as attachments_count,
    created_at
FROM document_versions
ORDER BY created_at DESC
LIMIT 5;

-- ============================================================
-- ROLLBACK (if needed)
-- ============================================================
-- To rollback this migration, run:
-- ALTER TABLE document_versions DROP COLUMN IF EXISTS sections_snapshot;
-- ALTER TABLE document_versions DROP COLUMN IF EXISTS attachments_snapshot;
-- DROP INDEX IF EXISTS idx_document_versions_sections_snapshot;
-- DROP INDEX IF EXISTS idx_document_versions_attachments_snapshot;

-- ============================================================
-- END OF MIGRATION 048
-- ============================================================
