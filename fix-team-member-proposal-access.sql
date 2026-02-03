-- Fix Team Member Proposal Access
-- This script fixes the issue where team members cannot access proposals

-- ============================================================
-- IMPORTANT: Avoid Infinite Recursion
-- ============================================================
-- The workspaces policy references proposals via proposal_team_members
-- So the proposals policy CANNOT reference workspaces (circular dependency)
-- Solution: Sync document_collaborators to proposal_team_members

-- ============================================================
-- STEP 1: Update proposal_read RLS policy (simplified, no workspace reference)
-- ============================================================

DROP POLICY IF EXISTS "proposal_read" ON public.proposals;

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
-- STEP 2: Sync proposal_team_members with document_collaborators
-- ============================================================
-- Add all document collaborators as team members if they're not already

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
-- STEP 3: Create trigger to auto-sync team members (no recursion)
-- ============================================================
-- When a document collaborator is added, automatically add them to proposal_team_members

CREATE OR REPLACE FUNCTION sync_document_collaborator_to_team_member()
RETURNS TRIGGER AS $$
DECLARE
    v_proposal_id UUID;
    v_lead_id UUID;
    v_user_role TEXT;
BEGIN
    -- Get proposal_id and lead_id from workspace (single query, no recursion)
    SELECT w.proposal_id, w.lead_id
    INTO v_proposal_id, v_lead_id
    FROM workspace_documents wd
    INNER JOIN workspaces w ON w.id = wd.workspace_id
    WHERE wd.id = NEW.document_id
    LIMIT 1;
    
    -- Only proceed if workspace has a proposal
    IF v_proposal_id IS NOT NULL THEN
        -- Determine role
        IF NEW.user_id = v_lead_id THEN
            v_user_role := 'lead';
        ELSE
            v_user_role := 'member';
        END IF;
        
        -- Insert or update team member
        INSERT INTO proposal_team_members (proposal_id, user_id, role)
        VALUES (v_proposal_id, NEW.user_id, v_user_role)
        ON CONFLICT (proposal_id, user_id) DO UPDATE
        SET role = CASE 
            WHEN EXCLUDED.role = 'lead' THEN 'lead'
            ELSE proposal_team_members.role
        END;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS sync_collaborator_to_team ON document_collaborators;

-- Create trigger
CREATE TRIGGER sync_collaborator_to_team
    AFTER INSERT ON document_collaborators
    FOR EACH ROW
    EXECUTE FUNCTION sync_document_collaborator_to_team_member();

-- ============================================================
-- STEP 4: Create trigger to remove team members when collaborator is removed (no recursion)
-- ============================================================

CREATE OR REPLACE FUNCTION remove_team_member_when_collaborator_removed()
RETURNS TRIGGER AS $$
DECLARE
    v_proposal_id UUID;
    v_lead_id UUID;
BEGIN
    -- Get proposal_id from workspace
    SELECT w.proposal_id, w.lead_id
    INTO v_proposal_id, v_lead_id
    FROM workspace_documents wd
    INNER JOIN workspaces w ON w.id = wd.workspace_id
    WHERE wd.id = OLD.document_id
    LIMIT 1;
    
    -- Only proceed if workspace has a proposal
    IF v_proposal_id IS NOT NULL THEN
        -- Remove from proposal_team_members if:
        -- 1. They have no other document access in this proposal
        -- 2. They're not the lead
        DELETE FROM proposal_team_members ptm
        WHERE ptm.user_id = OLD.user_id
          AND ptm.proposal_id = v_proposal_id
          AND OLD.user_id != v_lead_id
          AND NOT EXISTS (
              -- Check if they still have access to other documents
              SELECT 1
              FROM document_collaborators dc
              INNER JOIN workspace_documents wd2 ON wd2.id = dc.document_id
              INNER JOIN workspaces w2 ON w2.id = wd2.workspace_id
              WHERE dc.user_id = OLD.user_id
                AND w2.proposal_id = v_proposal_id
                AND dc.document_id != OLD.document_id
          );
    END IF;
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS remove_team_member_on_collaborator_delete ON document_collaborators;

-- Create trigger
CREATE TRIGGER remove_team_member_on_collaborator_delete
    AFTER DELETE ON document_collaborators
    FOR EACH ROW
    EXECUTE FUNCTION remove_team_member_when_collaborator_removed();

-- ============================================================
-- VERIFICATION
-- ============================================================

-- Check policy
SELECT 
    schemaname,
    tablename,
    policyname,
    cmd
FROM pg_policies 
WHERE tablename = 'proposals' AND policyname = 'proposal_read';

-- Check triggers
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement
FROM information_schema.triggers
WHERE trigger_name IN ('sync_collaborator_to_team', 'remove_team_member_on_collaborator_delete');

-- Check team member count
SELECT 
    p.id,
    p.title,
    COUNT(ptm.id) as team_member_count
FROM proposals p
LEFT JOIN proposal_team_members ptm ON ptm.proposal_id = p.id
GROUP BY p.id, p.title
ORDER BY p.created_at DESC
LIMIT 10;

