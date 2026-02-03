-- QUICK FIX: Add 'under_review' to proposal_status enum
-- Run this in your Supabase SQL Editor

-- This is a simple, safe operation that adds a new enum value
-- It does NOT modify existing data

ALTER TYPE proposal_status ADD VALUE IF NOT EXISTS 'under_review' AFTER 'submitted';

-- Verify it was added
SELECT enumlabel 
FROM pg_enum 
WHERE enumtypid = 'proposal_status'::regtype 
ORDER BY enumsortorder;

-- Expected output should include:
-- draft
-- submitted
-- under_review  ← NEW
-- reviewing
-- approved
-- rejected
-- archived
