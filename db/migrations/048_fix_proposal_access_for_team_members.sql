-- Migration 048: Fix proposal access for team members
-- This ensures team members can read proposals they're assigned to

-- ============================================================
-- PROBLEM ANALYSIS
-- ============================================================
-- Users who are team members cannot access proposals because:
-- 1. The checkIfLead function queries proposals table
-- 2. RLS policy requires user to be in proposal_team_members
-- 3. But document collaborators are not automatically synced to proposal_team_members
-- 4. This creates a data inconsistency

-- ============================================================
-- SOLUTION: Simplify proposal_read policy and sync data
-- ============================================================
-- IMPORTANT: We cannot reference workspaces in the proposal policy
-- because workspaces policy already references proposals (circular dependency)
-- Instead, we ensure all document collaborators are in proposal_team_members

-- Drop existing policy
DROP POLICY IF EXISTS "proposal_read" ON public.proposals;

-- Create simplified policy (no workspace reference to avoid infinite recursion)
CREATE POLICY "proposal_read" ON public.proposals
FOR SELECT USING (
    -- Lead can see their own proposals
    auth.uid() = lead_id
    OR
    -- Team members can see proposals they're assigned to
    EXISTS (
        SELECT 1 FROM public.proposal_team_members ptm 
        WHERE ptm.proposal_id = proposals.id 
        AND ptm.user_id = auth.uid()
    )
    OR
    -- Client can see proposals for their projects
    EXISTS (
        SELECT 1 FROM public.projects p 
        WHERE p.id = proposals.project_id 
        AND p.client_id = auth.uid()
    )
);

-- ============================================================
-- SYNC DATA: Add document collaborators to proposal_team_members
-- ============================================================

INSERT INTO proposal_team_members (proposal_id, user_id, role)
SELECT DISTINCT
    w.proposal_id,
    dc.user_id,
    CASE 
        WHEN dc.user_id = w.lead_id THEN 'lead'
        WHEN EXISTS (
            SELECT 1 FROM proposals p 
            WHERE p.id = w.proposal_id 
            AND p.lead_id = dc.user_id
        ) THEN 'lead'
        ELSE 'member'
    END as role
FROM workspaces w
INNER JOIN workspace_documents wd ON wd.workspace_id = w.id
INNER JOIN document_collaborators dc ON dc.document_id = wd.id
WHERE w.proposal_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM proposal_team_members ptm
      WHERE ptm.proposal_id = w.proposal_id
      AND ptm.user_id = dc.user_id
  )
ON CONFLICT (proposal_id, user_id) DO UPDATE
SET role = CASE 
    WHEN EXCLUDED.role = 'lead' THEN 'lead'
    ELSE proposal_team_members.role
END;

-- ============================================================
-- VERIFICATION QUERIES
-- ============================================================

-- Check that policy was created
SELECT 
    schemaname,
    tablename,
    policyname,
    cmd
FROM pg_policies 
WHERE tablename = 'proposals' AND policyname = 'proposal_read';

-- Check sync status
SELECT 
    COUNT(*) as synced_collaborators
FROM proposal_team_members ptm
INNER JOIN workspaces w ON w.proposal_id = ptm.proposal_id;

