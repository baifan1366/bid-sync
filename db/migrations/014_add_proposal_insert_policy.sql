-- ============================================================
-- MIGRATION 014: ADD MISSING PROPOSAL INSERT POLICY
-- ============================================================

-- Add INSERT policy for proposals table
-- Allow bidding leads to create proposals for open projects
CREATE POLICY "proposals_lead_insert" ON public.proposals
FOR INSERT 
WITH CHECK (
  auth.uid() = lead_id 
  AND EXISTS (
    SELECT 1 FROM public.projects p 
    WHERE p.id = project_id 
    AND p.status = 'open'
  )
);

-- Also add UPDATE policy if missing
DROP POLICY IF EXISTS "proposal_write" ON public.proposals;
CREATE POLICY "proposals_lead_update" ON public.proposals
FOR UPDATE 
USING (auth.uid() = lead_id)
WITH CHECK (auth.uid() = lead_id);

-- Add DELETE policy for leads to delete their own draft proposals
CREATE POLICY "proposals_lead_delete" ON public.proposals
FOR DELETE 
USING (auth.uid() = lead_id AND status = 'draft');
