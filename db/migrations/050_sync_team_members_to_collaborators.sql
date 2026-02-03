-- Migration 050: Sync proposal team members to document collaborators
-- This ensures team members can actually edit documents, not just view them

-- ============================================================
-- PROBLEM ANALYSIS
-- ============================================================
-- Users in proposal_team_members can VIEW documents (app-level check)
-- But they cannot EDIT because they're not in document_collaborators (RLS check)
-- This creates an inconsistency where members see documents but get RLS errors

-- ============================================================
-- SOLUTION: Sync team members to document_collaborators
-- ============================================================

-- Step 1: Add all existing team members as document collaborators
INSERT INTO document_collaborators (document_id, user_id, role, added_by)
SELECT DISTINCT
    wd.id as document_id,
    ptm.user_id,
    CASE 
        WHEN ptm.role = 'lead' THEN 'editor'
        ELSE 'editor'  -- Members get editor role so they can edit assigned sections
    END as role,
    COALESCE(w.lead_id, wd.created_by) as added_by  -- Use workspace lead or document creator
FROM proposal_team_members ptm
INNER JOIN workspaces w ON w.proposal_id = ptm.proposal_id
INNER JOIN workspace_documents wd ON wd.workspace_id = w.id
WHERE w.proposal_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM document_collaborators dc
      WHERE dc.document_id = wd.id
      AND dc.user_id = ptm.user_id
  )
ON CONFLICT (document_id, user_id) DO UPDATE
SET role = CASE 
    WHEN EXCLUDED.role = 'owner' THEN 'owner'
    WHEN document_collaborators.role = 'owner' THEN 'owner'
    ELSE EXCLUDED.role
END;

-- Step 2: Create a function to auto-sync when team members are added
CREATE OR REPLACE FUNCTION sync_team_member_to_collaborators()
RETURNS TRIGGER AS $$
BEGIN
    -- When a team member is added, add them as collaborators to all workspace documents
    INSERT INTO document_collaborators (document_id, user_id, role, added_by)
    SELECT 
        wd.id as document_id,
        NEW.user_id,
        CASE 
            WHEN NEW.role = 'lead' THEN 'editor'
            ELSE 'editor'
        END as role,
        COALESCE(w.lead_id, wd.created_by) as added_by
    FROM workspaces w
    INNER JOIN workspace_documents wd ON wd.workspace_id = w.id
    WHERE w.proposal_id = NEW.proposal_id
    ON CONFLICT (document_id, user_id) DO UPDATE
    SET role = CASE 
        WHEN EXCLUDED.role = 'owner' THEN 'owner'
        WHEN document_collaborators.role = 'owner' THEN 'owner'
        ELSE EXCLUDED.role
    END;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 3: Create trigger to auto-sync on INSERT
DROP TRIGGER IF EXISTS trigger_sync_team_member_to_collaborators ON proposal_team_members;
CREATE TRIGGER trigger_sync_team_member_to_collaborators
    AFTER INSERT ON proposal_team_members
    FOR EACH ROW
    EXECUTE FUNCTION sync_team_member_to_collaborators();

-- Step 4: Create a function to sync when new documents are added to workspace
CREATE OR REPLACE FUNCTION sync_workspace_document_to_team_collaborators()
RETURNS TRIGGER AS $$
BEGIN
    -- When a document is added to a workspace with a proposal, add all team members as collaborators
    INSERT INTO document_collaborators (document_id, user_id, role, added_by)
    SELECT 
        NEW.id as document_id,
        ptm.user_id,
        CASE 
            WHEN ptm.role = 'lead' THEN 'editor'
            ELSE 'editor'
        END as role,
        COALESCE(NEW.created_by, w.lead_id) as added_by
    FROM workspaces w
    INNER JOIN proposal_team_members ptm ON ptm.proposal_id = w.proposal_id
    WHERE w.id = NEW.workspace_id
      AND w.proposal_id IS NOT NULL
    ON CONFLICT (document_id, user_id) DO UPDATE
    SET role = CASE 
        WHEN EXCLUDED.role = 'owner' THEN 'owner'
        WHEN document_collaborators.role = 'owner' THEN 'owner'
        ELSE EXCLUDED.role
    END;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 5: Create trigger to auto-sync on document INSERT
DROP TRIGGER IF EXISTS trigger_sync_workspace_document_to_team ON workspace_documents;
CREATE TRIGGER trigger_sync_workspace_document_to_team
    AFTER INSERT ON workspace_documents
    FOR EACH ROW
    EXECUTE FUNCTION sync_workspace_document_to_team_collaborators();

-- ============================================================
-- VERIFICATION QUERIES
-- ============================================================

-- Check sync status
SELECT 
    'Team Members' as type,
    COUNT(*) as count
FROM proposal_team_members

UNION ALL

SELECT 
    'Document Collaborators' as type,
    COUNT(*) as count
FROM document_collaborators

UNION ALL

SELECT 
    'Synced (Team members who are also collaborators)' as type,
    COUNT(DISTINCT ptm.user_id) as count
FROM proposal_team_members ptm
INNER JOIN workspaces w ON w.proposal_id = ptm.proposal_id
INNER JOIN workspace_documents wd ON wd.workspace_id = w.id
INNER JOIN document_collaborators dc ON dc.document_id = wd.id AND dc.user_id = ptm.user_id;

-- Check specific user
/*
SELECT 
    'User is team member' as check_type,
    COUNT(*) as count
FROM proposal_team_members
WHERE user_id = 'd0499dba-43f2-4988-9e62-b1726e2eb7f1'

UNION ALL

SELECT 
    'User is document collaborator' as check_type,
    COUNT(*) as count
FROM document_collaborators
WHERE user_id = 'd0499dba-43f2-4988-9e62-b1726e2eb7f1';
*/
