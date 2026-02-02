-- ============================================================
-- Migration: Fix RLS policies and users table reference
-- Description: Fix the users table reference in RLS policy and 
--              update proposal insert policy
-- ============================================================

-- Step 1: Fix the proposal_read RLS policy (from migration 033)
DROP POLICY IF EXISTS "proposal_read" ON public.proposals;

CREATE POLICY "proposal_read" ON public.proposals
FOR SELECT USING (
    -- Lead can see their own proposals
    auth.uid() = lead_id
    -- Team members can see proposals they're part of
    OR EXISTS (
        SELECT 1 FROM proposal_team_members m 
        WHERE m.user_id = auth.uid() AND m.proposal_id = id
    )
    -- Clients can ONLY see proposals that are NOT pending_approval or rejected
    OR (
        EXISTS (
            SELECT 1 FROM projects p 
            WHERE p.id = project_id 
            AND p.client_id = auth.uid()
        )
        AND status NOT IN ('pending_approval', 'rejected')
    )
    -- Admins can see all proposals (check user_metadata for role)
    OR (
        SELECT COALESCE(
            (auth.jwt() -> 'user_metadata' ->> 'role')::text = 'admin',
            false
        )
    )
);

-- Step 2: Fix the proposal insert RLS policy (from migration 034)
DROP POLICY IF EXISTS "proposals_lead_insert" ON public.proposals;

CREATE POLICY "proposals_lead_insert" ON public.proposals
FOR INSERT WITH CHECK (
    auth.uid() = lead_id
);

COMMENT ON POLICY "proposals_lead_insert" ON public.proposals IS 
'Allows authenticated bidding leads to create proposals. Project status validation is handled at the application level.';

COMMENT ON POLICY "proposal_read" ON public.proposals IS 
'Controls read access to proposals based on user role and relationship to the proposal';
