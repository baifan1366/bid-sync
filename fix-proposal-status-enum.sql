-- Fix proposal_status enum to include under_review
-- This adds the missing 'under_review' status to the database enum

-- First, check current enum values
SELECT enumlabel 
FROM pg_enum 
WHERE enumtypid = 'proposal_status'::regtype 
ORDER BY enumsortorder;

-- Add 'under_review' to the enum if it doesn't exist
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
        ALTER TYPE proposal_status ADD VALUE 'under_review' AFTER 'submitted';
        RAISE NOTICE 'Added under_review to proposal_status enum';
    ELSE
        RAISE NOTICE 'under_review already exists in proposal_status enum';
    END IF;
END $$;

-- Verify the enum now includes under_review
SELECT enumlabel 
FROM pg_enum 
WHERE enumtypid = 'proposal_status'::regtype 
ORDER BY enumsortorder;
