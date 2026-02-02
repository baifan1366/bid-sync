-- ============================================================
-- Migration: Add pending_approval status for proposals (Part 1)
-- Description: Add the new enum value
-- ============================================================

-- Add 'pending_approval' to proposal_status enum
ALTER TYPE proposal_status ADD VALUE IF NOT EXISTS 'pending_approval' AFTER 'submitted';

-- Note: This must be committed before the enum value can be used
-- The rest of the migration is in 033_implement_pending_approval_workflow.sql
