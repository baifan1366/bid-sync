-- ============================================================
-- MIGRATION 047: ADD ATTACHMENTS SNAPSHOT TO PROPOSAL VERSIONS
-- ============================================================
-- Adds attachments_snapshot column to proposal_versions table
-- to support complete version control including section attachments

-- Add attachments_snapshot column
ALTER TABLE proposal_versions 
ADD COLUMN IF NOT EXISTS attachments_snapshot JSONB DEFAULT '[]'::jsonb;

-- Add comment
COMMENT ON COLUMN proposal_versions.attachments_snapshot IS 
'Snapshot of section attachments at the time of version creation. Includes file metadata for all attachments associated with sections in this version.';

-- Create index for faster queries on attachments_snapshot
CREATE INDEX IF NOT EXISTS idx_proposal_versions_attachments_snapshot 
ON proposal_versions USING GIN (attachments_snapshot);

-- ============================================================
-- VERIFICATION QUERIES
-- ============================================================

-- Verify column was added
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'proposal_versions' 
        AND column_name = 'attachments_snapshot'
    ) THEN
        RAISE NOTICE '✅ Column attachments_snapshot added successfully';
    ELSE
        RAISE EXCEPTION '❌ Column attachments_snapshot was not added';
    END IF;
END $$;

-- Verify index was created
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM pg_indexes 
        WHERE tablename = 'proposal_versions' 
        AND indexname = 'idx_proposal_versions_attachments_snapshot'
    ) THEN
        RAISE NOTICE '✅ Index idx_proposal_versions_attachments_snapshot created successfully';
    ELSE
        RAISE NOTICE '⚠️  Index idx_proposal_versions_attachments_snapshot was not created';
    END IF;
END $$;

-- Show sample of existing versions (should have empty array for attachments_snapshot)
SELECT 
    id,
    proposal_id,
    version_number,
    jsonb_array_length(COALESCE(sections_snapshot, '[]'::jsonb)) as sections_count,
    jsonb_array_length(COALESCE(documents_snapshot, '[]'::jsonb)) as documents_count,
    jsonb_array_length(COALESCE(attachments_snapshot, '[]'::jsonb)) as attachments_count,
    created_at
FROM proposal_versions
ORDER BY created_at DESC
LIMIT 5;

-- ============================================================
-- ROLLBACK (if needed)
-- ============================================================
-- To rollback this migration, run:
-- ALTER TABLE proposal_versions DROP COLUMN IF EXISTS attachments_snapshot;
-- DROP INDEX IF EXISTS idx_proposal_versions_attachments_snapshot;

-- ============================================================
-- END OF MIGRATION 047
-- ============================================================
