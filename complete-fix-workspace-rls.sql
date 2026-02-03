-- Complete fix for workspace RLS issue
-- Run this entire script in Supabase SQL Editor

-- Step 1: Show current state
SELECT 'Current RLS Policies' as step;
SELECT policyname, cmd 
FROM pg_policies 
WHERE tablename = 'workspaces';

-- Step 2: Drop ALL existing policies on workspaces
DROP POLICY IF EXISTS "workspaces_owner_select" ON public.workspaces;
DROP POLICY IF EXISTS "workspaces_team_select" ON public.workspaces;
DROP POLICY IF EXISTS "workspaces_owner_insert" ON public.workspaces;
DROP POLICY IF EXISTS "workspaces_owner_update" ON public.workspaces;
DROP POLICY IF EXISTS "workspaces_owner_delete" ON public.workspaces;

-- Step 3: Create new SELECT policy with team member access
CREATE POLICY "workspaces_team_select" ON public.workspaces
FOR SELECT USING (
  -- Lead can access their own workspaces
  lead_id = auth.uid()
  OR
  -- Team members can access via proposal_id (if set)
  EXISTS (
    SELECT 1 
    FROM proposal_team_members ptm
    WHERE ptm.proposal_id = workspaces.proposal_id
    AND ptm.user_id = auth.uid()
    AND workspaces.proposal_id IS NOT NULL
  )
  OR
  -- Team members can access via project_id + lead_id (fallback for legacy workspaces)
  EXISTS (
    SELECT 1 
    FROM proposals p
    INNER JOIN proposal_team_members ptm ON ptm.proposal_id = p.id
    WHERE p.project_id = workspaces.project_id
    AND p.lead_id = workspaces.lead_id
    AND ptm.user_id = auth.uid()
  )
);

-- Step 4: Recreate other policies (INSERT, UPDATE, DELETE)
CREATE POLICY "workspaces_owner_insert" ON public.workspaces 
FOR INSERT WITH CHECK (lead_id = auth.uid());

CREATE POLICY "workspaces_owner_update" ON public.workspaces 
FOR UPDATE USING (lead_id = auth.uid()) 
WITH CHECK (lead_id = auth.uid());

CREATE POLICY "workspaces_owner_delete" ON public.workspaces 
FOR DELETE USING (lead_id = auth.uid());

-- Step 5: Verify policies were created
SELECT 'New RLS Policies' as step;
SELECT policyname, cmd 
FROM pg_policies 
WHERE tablename = 'workspaces'
ORDER BY policyname;

-- Step 6: Test access for specific user
SELECT 'Test Query Result' as step;
-- This should return the workspace if RLS is working correctly
-- Note: This runs as the current SQL Editor user (usually postgres/admin)
-- so it bypasses RLS. The real test is in the browser.
SELECT id, name, project_id, lead_id, proposal_id
FROM workspaces
WHERE id = '45a99ca8-2066-44ff-b3e6-ea81588902e2';
