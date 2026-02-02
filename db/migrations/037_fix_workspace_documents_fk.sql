-- ============================================================
-- Migration: Fix duplicate foreign key constraints
-- Description: Remove duplicate foreign key constraints on workspace_documents
--              that are causing Supabase relationship ambiguity
-- ============================================================

-- First, let's check what constraints exist
-- You can run this query to see all constraints:
-- SELECT conname, contype 
-- FROM pg_constraint 
-- WHERE conrelid = 'public.workspace_documents'::regclass;

-- Drop any duplicate or old foreign key constraints
-- Keep only the main one: workspace_documents_workspace_id_fkey

-- Drop the old constraint if it exists (might be named differently)
DO $$
BEGIN
    -- Drop workspace_documents_workspace_fk if it exists
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_documents_workspace_fk' 
        AND conrelid = 'public.workspace_documents'::regclass
    ) THEN
        ALTER TABLE public.workspace_documents 
        DROP CONSTRAINT workspace_documents_workspace_fk;
        RAISE NOTICE 'Dropped constraint: workspace_documents_workspace_fk';
    END IF;
    
    -- Ensure the standard constraint exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'workspace_documents_workspace_id_fkey' 
        AND conrelid = 'public.workspace_documents'::regclass
    ) THEN
        ALTER TABLE public.workspace_documents 
        ADD CONSTRAINT workspace_documents_workspace_id_fkey 
        FOREIGN KEY (workspace_id) 
        REFERENCES public.workspaces(id) 
        ON DELETE CASCADE;
        RAISE NOTICE 'Created constraint: workspace_documents_workspace_id_fkey';
    END IF;
END $$;

-- Add a comment
COMMENT ON CONSTRAINT workspace_documents_workspace_id_fkey ON public.workspace_documents IS 
'Foreign key to workspaces table';
