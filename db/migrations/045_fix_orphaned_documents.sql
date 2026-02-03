-- Migration: Fix orphaned workspace_documents
-- This handles documents that reference non-existent workspaces

-- Step 1: Log orphaned documents for debugging
DO $$
DECLARE
    orphan_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO orphan_count
    FROM workspace_documents wd
    LEFT JOIN workspaces w ON wd.workspace_id = w.id
    WHERE w.id IS NULL;
    
    RAISE NOTICE 'Found % orphaned documents', orphan_count;
END $$;

-- Step 2: Delete orphaned documents (documents with no workspace)
-- These are data inconsistencies that should not exist
DELETE FROM workspace_documents wd
WHERE NOT EXISTS (
    SELECT 1 FROM workspaces w WHERE w.id = wd.workspace_id
);

-- Step 3: Add a check to prevent future orphans
-- The foreign key constraint should already handle this, but let's ensure it's there
DO $$
BEGIN
    -- Check if constraint exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'workspace_documents_workspace_id_fkey'
        AND table_name = 'workspace_documents'
    ) THEN
        -- Add the foreign key constraint if it doesn't exist
        ALTER TABLE workspace_documents
        ADD CONSTRAINT workspace_documents_workspace_id_fkey
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Step 4: Verify the fix
DO $$
DECLARE
    remaining_orphans INTEGER;
BEGIN
    SELECT COUNT(*) INTO remaining_orphans
    FROM workspace_documents wd
    LEFT JOIN workspaces w ON wd.workspace_id = w.id
    WHERE w.id IS NULL;
    
    IF remaining_orphans > 0 THEN
        RAISE WARNING 'Still have % orphaned documents after cleanup', remaining_orphans;
    ELSE
        RAISE NOTICE 'All orphaned documents cleaned up successfully';
    END IF;
END $$;
