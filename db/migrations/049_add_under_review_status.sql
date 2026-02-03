-- Migration: Add 'under_review' to proposal_status enum
-- Date: 2026-02-03
-- Description: Adds 'under_review' status to support client decision workflow

-- Add 'under_review' to the proposal_status enum
-- Note: ALTER TYPE ADD VALUE cannot be run inside a transaction block in PostgreSQL
-- This must be run separately or the migration tool must handle it specially

DO $$ 
BEGIN
    -- Check if 'under_review' already exists
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_enum 
        WHERE enumlabel = 'under_review' 
        AND enumtypid = 'proposal_status'::regtype
    ) THEN
        -- Add 'under_review' after 'submitted'
        -- This will allow proposals to be marked as under review by clients
        ALTER TYPE proposal_status ADD VALUE IF NOT EXISTS 'under_review' AFTER 'submitted';
        
        RAISE NOTICE 'Successfully added under_review to proposal_status enum';
    ELSE
        RAISE NOTICE 'under_review already exists in proposal_status enum';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Error adding under_review: %', SQLERRM;
END $$;

-- Verify the change
DO $$
DECLARE
    enum_values text;
BEGIN
    SELECT string_agg(enumlabel, ', ' ORDER BY enumsortorder)
    INTO enum_values
    FROM pg_enum
    WHERE enumtypid = 'proposal_status'::regtype;
    
    RAISE NOTICE 'Current proposal_status values: %', enum_values;
END $$;

-- Update any proposals that might be using 'reviewing' to maintain compatibility
-- (Optional - only if you want to migrate existing data)
-- UPDATE proposals SET status = 'under_review' WHERE status = 'reviewing';
