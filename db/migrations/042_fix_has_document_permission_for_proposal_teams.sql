-- ============================================================
-- MIGRATION 042: FIX has_document_permission FOR PROPOSAL TEAMS
-- ============================================================
-- 
-- PROBLEM: has_document_permission function only checks document_collaborators
-- and doesn't account for proposal team members, causing version history
-- and other features to fail for team members.
--
-- SOLUTION: Update the function to also check if user is a proposal team member
-- for the document's workspace project.
-- ============================================================

BEGIN;

-- Drop the old function
DROP FUNCTION IF EXISTS public.has_document_permission(UUID, UUID, TEXT);

-- Create updated function that checks both collaborators and proposal team members
CREATE OR REPLACE FUNCTION public.has_document_permission(
    p_document_id UUID, 
    p_user_id UUID, 
    p_required_role TEXT DEFAULT 'viewer'
)
RETURNS BOOLEAN 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    v_user_role TEXT;
    v_role_hierarchy INT;
    v_required_hierarchy INT;
    v_is_team_member BOOLEAN;
BEGIN
    -- First, check if user is a document collaborator
    SELECT role INTO v_user_role 
    FROM public.document_collaborators 
    WHERE document_id = p_document_id 
    AND user_id = p_user_id;
    
    -- If user is a collaborator, check their role hierarchy
    IF v_user_role IS NOT NULL THEN
        v_user_role := LOWER(v_user_role);
        p_required_role := LOWER(p_required_role);
        
        v_role_hierarchy := CASE v_user_role 
            WHEN 'owner' THEN 4 
            WHEN 'editor' THEN 3 
            WHEN 'commenter' THEN 2 
            WHEN 'viewer' THEN 1 
            ELSE 0 
        END;
        
        v_required_hierarchy := CASE p_required_role 
            WHEN 'owner' THEN 4 
            WHEN 'editor' THEN 3 
            WHEN 'commenter' THEN 2 
            WHEN 'viewer' THEN 1 
            ELSE 0 
        END;
        
        RETURN v_role_hierarchy >= v_required_hierarchy;
    END IF;
    
    -- If not a collaborator, check if user is a proposal team member
    -- Team members have at least 'viewer' access to workspace documents
    SELECT EXISTS (
        SELECT 1 
        FROM public.workspace_documents wd
        INNER JOIN public.workspaces w ON w.id = wd.workspace_id
        INNER JOIN public.proposals p ON p.project_id = w.project_id
        INNER JOIN public.proposal_team_members ptm ON ptm.proposal_id = p.id
        WHERE wd.id = p_document_id
        AND ptm.user_id = p_user_id
    ) INTO v_is_team_member;
    
    -- If user is a team member, grant viewer access (can be upgraded based on required role)
    IF v_is_team_member THEN
        -- Team members have editor access by default (can view and edit)
        p_required_role := LOWER(p_required_role);
        
        -- Team members can view, comment, and edit, but not own
        IF p_required_role IN ('viewer', 'commenter', 'editor') THEN
            RETURN TRUE;
        ELSE
            RETURN FALSE;
        END IF;
    END IF;
    
    -- No access found
    RETURN FALSE;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.has_document_permission TO authenticated;

-- Add comment
COMMENT ON FUNCTION public.has_document_permission IS 
'Checks if a user has the required permission level for a document. Checks both document_collaborators and proposal_team_members tables.';

COMMIT;

-- Success message
DO $$
BEGIN
    RAISE NOTICE '==============================================';
    RAISE NOTICE 'Migration 042 completed successfully!';
    RAISE NOTICE 'has_document_permission now supports proposal team members.';
    RAISE NOTICE 'Team members can now access version history and other document features.';
    RAISE NOTICE '==============================================';
END $$;
