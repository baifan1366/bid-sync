-- ============================================================
-- Migration: Fix proposal insert RLS policy
-- Description: Update RLS policy to allow proposal creation for any project status
--              The application logic will handle status validation
-- ============================================================

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "proposals_lead_insert" ON public.proposals;

-- Create a more permissive policy that only checks user authentication
-- The application will validate project status
CREATE POLICY "proposals_lead_insert" ON public.proposals
FOR INSERT WITH CHECK (
    auth.uid() = lead_id
);

-- Add a comment explaining the policy
COMMENT ON POLICY "proposals_lead_insert" ON public.proposals IS 
'Allows authenticated bidding leads to create proposals. Project status validation is handled at the application level.';
