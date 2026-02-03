-- ============================================================
-- MIGRATION 051: AUTO-UPDATE PROPOSAL STATUS
-- ============================================================
-- 
-- PROBLEM: Proposal status remains 'draft' even when team members
-- start writing content in document sections.
--
-- SOLUTION: Create a trigger that automatically updates proposal
-- status to 'in_progress' when:
-- 1. A document section's content is updated (not empty)
-- 2. A document section's status changes to 'in_progress' or beyond
-- ============================================================

BEGIN;

-- ============================================================
-- 1. CREATE FUNCTION TO AUTO-UPDATE PROPOSAL STATUS
-- ============================================================

CREATE OR REPLACE FUNCTION auto_update_proposal_status()
RETURNS TRIGGER AS $$
DECLARE
    v_workspace_id UUID;
    v_proposal_id UUID;
    v_current_status TEXT;
    v_has_content BOOLEAN;
BEGIN
    -- Get the workspace_id from the document
    SELECT workspace_id INTO v_workspace_id
    FROM workspace_documents
    WHERE id = NEW.document_id;

    -- If no workspace found, exit
    IF v_workspace_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- Get the proposal_id from the workspace
    SELECT proposal_id INTO v_proposal_id
    FROM workspaces
    WHERE id = v_workspace_id;

    -- If no proposal found, exit
    IF v_proposal_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- Get current proposal status
    SELECT status INTO v_current_status
    FROM proposals
    WHERE id = v_proposal_id;

    -- Only update if proposal is currently in 'draft' status
    -- Don't change status if it's already submitted, approved, etc.
    IF v_current_status != 'draft' THEN
        RETURN NEW;
    END IF;

    -- Check if the section has meaningful content
    -- Content is considered meaningful if it's not empty and not just '{}'
    v_has_content := (
        NEW.content IS NOT NULL 
        AND NEW.content::text != '{}'
        AND NEW.content::text != ''
        AND jsonb_strip_nulls(NEW.content::jsonb) != '{}'::jsonb
    );

    -- Update proposal status to 'in_progress' if:
    -- 1. Section status changed to 'in_progress', 'in_review', or 'completed'
    -- 2. OR section has meaningful content
    IF (NEW.status IN ('in_progress', 'in_review', 'completed') AND OLD.status = 'not_started')
       OR (v_has_content AND (OLD.content IS NULL OR OLD.content::text = '{}' OR OLD.content::text = ''))
    THEN
        UPDATE proposals
        SET 
            status = 'in_progress',
            updated_at = NOW()
        WHERE id = v_proposal_id
          AND status = 'draft';  -- Double-check it's still draft
        
        RAISE NOTICE 'Updated proposal % status to in_progress', v_proposal_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 2. CREATE TRIGGER ON DOCUMENT_SECTIONS
-- ============================================================

DROP TRIGGER IF EXISTS trigger_auto_update_proposal_status ON document_sections;

CREATE TRIGGER trigger_auto_update_proposal_status
    AFTER UPDATE ON document_sections
    FOR EACH ROW
    WHEN (
        -- Only trigger when status or content changes
        OLD.status IS DISTINCT FROM NEW.status
        OR OLD.content IS DISTINCT FROM NEW.content
    )
    EXECUTE FUNCTION auto_update_proposal_status();

-- ============================================================
-- 3. GRANT PERMISSIONS
-- ============================================================

GRANT EXECUTE ON FUNCTION auto_update_proposal_status TO authenticated;

-- ============================================================
-- 4. ADD COMMENTS
-- ============================================================

COMMENT ON FUNCTION auto_update_proposal_status IS 
'Automatically updates proposal status from draft to in_progress when team members start working on sections';

COMMENT ON TRIGGER trigger_auto_update_proposal_status ON document_sections IS
'Triggers proposal status update when section content or status changes';

-- ============================================================
-- 5. VERIFICATION
-- ============================================================

DO $$
BEGIN
    RAISE NOTICE '==============================================';
    RAISE NOTICE 'Migration 051 completed successfully!';
    RAISE NOTICE 'Created auto_update_proposal_status function.';
    RAISE NOTICE 'Proposal status will now automatically change to in_progress';
    RAISE NOTICE 'when team members start editing sections.';
    RAISE NOTICE '==============================================';
END $$;

COMMIT;

-- ============================================================
-- TESTING INSTRUCTIONS
-- ============================================================
--
-- 1. Check function exists:
--    SELECT proname FROM pg_proc WHERE proname = 'auto_update_proposal_status';
--
-- 2. Check trigger exists:
--    SELECT tgname FROM pg_trigger WHERE tgname = 'trigger_auto_update_proposal_status';
--
-- 3. Test the trigger:
--    a. Create a proposal (status should be 'draft')
--    b. Update a section's content or status
--    c. Check that proposal status changed to 'in_progress'
--
-- 4. Verify it doesn't affect submitted proposals:
--    a. Create a proposal and submit it (status = 'submitted')
--    b. Try to update a section
--    c. Verify proposal status remains 'submitted'
