-- Migration: Fix workspace RLS to allow team members access
-- Currently only the lead can access workspaces, but team members need access too

-- Drop the old restrictive policy
DROP POLICY IF EXISTS "workspaces_owner_select" ON public.workspaces;

-- Create new policy that allows:
-- 1. Lead (owner) to access their workspaces
-- 2. Team members to access workspaces for proposals they're part of
CREATE POLICY "workspaces_team_select" ON public.workspaces
FOR SELECT USING (
  -- Lead can access their own workspaces
  lead_id = auth.uid()
  OR
  -- Team members can access workspaces for proposals they're part of
  EXISTS (
    SELECT 1 
    FROM proposal_team_members ptm
    WHERE ptm.proposal_id = workspaces.proposal_id
    AND ptm.user_id = auth.uid()
  )
  OR
  -- Fallback: Team members can access via project_id if proposal_id is not set (legacy)
  EXISTS (
    SELECT 1 
    FROM proposals p
    INNER JOIN proposal_team_members ptm ON ptm.proposal_id = p.id
    WHERE p.project_id = workspaces.project_id
    AND p.lead_id = workspaces.lead_id
    AND ptm.user_id = auth.uid()
  )
);

-- Add comment
COMMENT ON POLICY "workspaces_team_select" ON public.workspaces IS 
'Allows workspace access to leads and their team members';
