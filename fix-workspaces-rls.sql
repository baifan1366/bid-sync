-- ============================================================
-- FIX: Workspaces RLS Policies
-- ============================================================
-- The issue: Workspaces RLS might be blocking access for proposal team members

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "workspaces_owner_select" ON public.workspaces;
DROP POLICY IF EXISTS "workspaces_owner_insert" ON public.workspaces;
DROP POLICY IF EXISTS "workspaces_owner_update" ON public.workspaces;
DROP POLICY IF EXISTS "workspaces_owner_delete" ON public.workspaces;

-- Create comprehensive read policy for workspaces
-- Allow access to:
-- 1. Workspace lead (owner)
-- 2. Proposal team members for proposals in this project
-- 3. Project client
CREATE POLICY "workspaces_read_access" ON public.workspaces
FOR SELECT USING (
    -- Workspace lead can read
    lead_id = auth.uid()
    OR
    -- Proposal team members can read
    EXISTS (
        SELECT 1 FROM public.proposals p
        JOIN public.proposal_team_members ptm ON ptm.proposal_id = p.id
        WHERE p.project_id = workspaces.project_id
        AND ptm.user_id = auth.uid()
    )
    OR
    -- Project client can read
    EXISTS (
        SELECT 1 FROM public.projects proj
        WHERE proj.id = workspaces.project_id
        AND proj.client_id = auth.uid()
    )
);

-- Create insert policy for workspaces
CREATE POLICY "workspaces_insert_access" ON public.workspaces
FOR INSERT WITH CHECK (
    lead_id = auth.uid()
);

-- Create update policy for workspaces
CREATE POLICY "workspaces_update_access" ON public.workspaces
FOR UPDATE USING (
    lead_id = auth.uid()
) WITH CHECK (
    lead_id = auth.uid()
);

-- Create delete policy for workspaces
CREATE POLICY "workspaces_delete_access" ON public.workspaces
FOR DELETE USING (
    lead_id = auth.uid()
);

-- Verify the policies
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'workspaces'
ORDER BY policyname;

COMMENT ON POLICY "workspaces_read_access" ON public.workspaces IS 
'Allows workspace lead, proposal team members, and project client to read workspaces';

COMMENT ON POLICY "workspaces_insert_access" ON public.workspaces IS 
'Allows workspace lead to create workspaces';

COMMENT ON POLICY "workspaces_update_access" ON public.workspaces IS 
'Allows workspace lead to update workspaces';

COMMENT ON POLICY "workspaces_delete_access" ON public.workspaces IS 
'Allows workspace lead to delete workspaces';
