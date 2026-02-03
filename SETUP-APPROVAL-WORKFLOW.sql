-- ============================================================
-- COMPLETE SETUP: Proposal Approval Workflow
-- ============================================================
-- This script does everything needed to enable the approval workflow
-- Run this ONE time to set up the complete system
-- ============================================================

BEGIN;

-- ============================================================
-- STEP 1: Fix bid_team_members issue
-- ============================================================

-- Drop the deprecated table
DROP TABLE IF EXISTS public.bid_team_members CASCADE;

-- Drop old functions
DROP FUNCTION IF EXISTS public.is_project_lead(UUID, UUID);
DROP FUNCTION IF EXISTS public.is_team_member(UUID, UUID);

-- ============================================================
-- STEP 2: Add pending_approval status
-- ============================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'pending_approval' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'proposal_status')
    ) THEN
        ALTER TYPE proposal_status ADD VALUE 'pending_approval' AFTER 'draft';
    END IF;
END $$;

-- ============================================================
-- STEP 3: Add approval tracking columns
-- ============================================================

ALTER TABLE public.proposals 
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- ============================================================
-- STEP 4: Create proposal approvals table
-- ============================================================

CREATE TABLE IF NOT EXISTS public.proposal_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proposal_id UUID NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
    admin_id UUID NOT NULL REFERENCES auth.users(id),
    action VARCHAR(20) NOT NULL CHECK (action IN ('approved', 'rejected')),
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_proposal_approvals_proposal ON public.proposal_approvals(proposal_id);
CREATE INDEX IF NOT EXISTS idx_proposal_approvals_admin ON public.proposal_approvals(admin_id);
CREATE INDEX IF NOT EXISTS idx_proposal_approvals_created ON public.proposal_approvals(created_at DESC);

ALTER TABLE public.proposal_approvals ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- STEP 5: Create RLS policies for proposal_approvals
-- ============================================================

DROP POLICY IF EXISTS "proposal_approvals_admin_select" ON public.proposal_approvals;
CREATE POLICY "proposal_approvals_admin_select" ON public.proposal_approvals
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM auth.users
        WHERE id = auth.uid() 
        AND raw_user_meta_data->>'role' = 'admin'
    )
);

DROP POLICY IF EXISTS "proposal_approvals_admin_insert" ON public.proposal_approvals;
CREATE POLICY "proposal_approvals_admin_insert" ON public.proposal_approvals
FOR INSERT WITH CHECK (
    admin_id = auth.uid() 
    AND EXISTS (
        SELECT 1 FROM auth.users
        WHERE id = auth.uid() 
        AND raw_user_meta_data->>'role' = 'admin'
    )
);

DROP POLICY IF EXISTS "proposal_approvals_lead_select" ON public.proposal_approvals;
CREATE POLICY "proposal_approvals_lead_select" ON public.proposal_approvals
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.proposals p
        WHERE p.id = proposal_approvals.proposal_id
        AND p.lead_id = auth.uid()
    )
);

-- ============================================================
-- STEP 6: Create proposal_performance table (if not exists)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.proposal_performance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    proposal_id UUID NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
    time_to_submit INTERVAL,
    team_size INT,
    sections_count INT,
    documents_count INT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT proposal_performance_team_size_positive CHECK (team_size >= 0),
    CONSTRAINT proposal_performance_sections_positive CHECK (sections_count >= 0),
    CONSTRAINT proposal_performance_documents_positive CHECK (documents_count >= 0),
    UNIQUE(proposal_id)
);

CREATE INDEX IF NOT EXISTS idx_proposal_performance_lead ON public.proposal_performance(lead_id);
CREATE INDEX IF NOT EXISTS idx_proposal_performance_proposal ON public.proposal_performance(proposal_id);

ALTER TABLE public.proposal_performance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "proposal_performance_lead_select" ON public.proposal_performance;
CREATE POLICY "proposal_performance_lead_select" ON public.proposal_performance
FOR SELECT USING (lead_id = auth.uid());

DROP POLICY IF EXISTS "proposal_performance_system_insert" ON public.proposal_performance;
CREATE POLICY "proposal_performance_system_insert" ON public.proposal_performance
FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "proposal_performance_system_update" ON public.proposal_performance;
CREATE POLICY "proposal_performance_system_update" ON public.proposal_performance
FOR UPDATE USING (true) WITH CHECK (true);

-- ============================================================
-- STEP 7: Create approval functions
-- ============================================================

CREATE OR REPLACE FUNCTION public.approve_proposal(
    p_proposal_id UUID,
    p_admin_id UUID,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_proposal_status TEXT;
BEGIN
    -- Check if user is admin
    IF NOT EXISTS (
        SELECT 1 FROM auth.users 
        WHERE id = p_admin_id 
        AND raw_user_meta_data->>'role' = 'admin'
    ) THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', '',
            'error', 'Only admins can approve proposals'
        );
    END IF;

    -- Get current proposal status
    SELECT status INTO v_proposal_status
    FROM public.proposals
    WHERE id = p_proposal_id;

    IF v_proposal_status IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', '',
            'error', 'Proposal not found'
        );
    END IF;

    IF v_proposal_status != 'pending_approval' THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', '',
            'error', 'Only proposals with pending_approval status can be approved'
        );
    END IF;

    -- Update proposal status to submitted
    UPDATE public.proposals 
    SET 
        status = 'submitted',
        approved_by = p_admin_id,
        approved_at = NOW(),
        updated_at = NOW()
    WHERE id = p_proposal_id;

    -- Log approval
    INSERT INTO public.proposal_approvals (proposal_id, admin_id, action, reason)
    VALUES (p_proposal_id, p_admin_id, 'approved', p_notes);

    -- Log admin action
    INSERT INTO public.admin_actions (admin_id, action_type, target_user_id, reason)
    SELECT p_admin_id, 'APPROVE_PROPOSAL', lead_id, p_notes
    FROM public.proposals WHERE id = p_proposal_id;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Proposal approved successfully',
        'error', null
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.reject_proposal(
    p_proposal_id UUID,
    p_admin_id UUID,
    p_reason TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_proposal_status TEXT;
BEGIN
    -- Check if user is admin
    IF NOT EXISTS (
        SELECT 1 FROM auth.users 
        WHERE id = p_admin_id 
        AND raw_user_meta_data->>'role' = 'admin'
    ) THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', '',
            'error', 'Only admins can reject proposals'
        );
    END IF;

    -- Get current proposal status
    SELECT status INTO v_proposal_status
    FROM public.proposals
    WHERE id = p_proposal_id;

    IF v_proposal_status IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', '',
            'error', 'Proposal not found'
        );
    END IF;

    IF v_proposal_status != 'pending_approval' THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', '',
            'error', 'Only proposals with pending_approval status can be rejected'
        );
    END IF;

    -- Update proposal status to rejected
    UPDATE public.proposals 
    SET 
        status = 'rejected',
        approved_by = p_admin_id,
        approved_at = NOW(),
        rejection_reason = p_reason,
        updated_at = NOW()
    WHERE id = p_proposal_id;

    -- Log rejection
    INSERT INTO public.proposal_approvals (proposal_id, admin_id, action, reason)
    VALUES (p_proposal_id, p_admin_id, 'rejected', p_reason);

    -- Log admin action
    INSERT INTO public.admin_actions (admin_id, action_type, target_user_id, reason)
    SELECT p_admin_id, 'REJECT_PROPOSAL', lead_id, p_reason
    FROM public.proposals WHERE id = p_proposal_id;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Proposal rejected successfully',
        'error', null
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.approve_proposal(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_proposal(UUID, UUID, TEXT) TO authenticated;

-- ============================================================
-- STEP 8: Update proposal performance function
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_proposal_performance(p_proposal_id UUID)
RETURNS void AS $$
DECLARE
    v_lead_id UUID;
    v_team_size INT;
    v_sections_count INT;
    v_documents_count INT;
    v_time_to_submit INTERVAL;
    v_created_at TIMESTAMPTZ;
    v_submitted_at TIMESTAMPTZ;
BEGIN
    SELECT lead_id, created_at, submitted_at
    INTO v_lead_id, v_created_at, v_submitted_at
    FROM public.proposals
    WHERE id = p_proposal_id;
    
    IF v_submitted_at IS NOT NULL THEN
        v_time_to_submit := v_submitted_at - v_created_at;
    END IF;
    
    -- Use proposal_team_members (NOT bid_team_members)
    SELECT COUNT(DISTINCT user_id)
    INTO v_team_size
    FROM public.proposal_team_members
    WHERE proposal_id = p_proposal_id;
    
    SELECT COUNT(*)
    INTO v_sections_count
    FROM public.document_sections ds
    JOIN public.workspace_documents wd ON wd.id = ds.document_id
    JOIN public.workspaces w ON w.id = wd.workspace_id
    JOIN public.proposals p ON p.project_id = w.project_id
    WHERE p.id = p_proposal_id;
    
    SELECT COUNT(*)
    INTO v_documents_count
    FROM public.documents d
    WHERE d.proposal_id = p_proposal_id;
    
    INSERT INTO public.proposal_performance (
        lead_id,
        proposal_id,
        time_to_submit,
        team_size,
        sections_count,
        documents_count,
        updated_at
    )
    VALUES (
        v_lead_id,
        p_proposal_id,
        v_time_to_submit,
        v_team_size,
        v_sections_count,
        v_documents_count,
        NOW()
    )
    ON CONFLICT (proposal_id) DO UPDATE SET
        time_to_submit = EXCLUDED.time_to_submit,
        team_size = EXCLUDED.team_size,
        sections_count = EXCLUDED.sections_count,
        documents_count = EXCLUDED.documents_count,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- STEP 9: Create/update trigger
-- ============================================================

DROP TRIGGER IF EXISTS trigger_auto_update_proposal_performance ON public.proposals;

CREATE OR REPLACE FUNCTION public.auto_update_proposal_performance()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status != OLD.status AND NEW.status IN ('submitted', 'reviewing', 'approved', 'rejected') THEN
        PERFORM public.update_proposal_performance(NEW.id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_update_proposal_performance
    AFTER UPDATE ON public.proposals
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION public.auto_update_proposal_performance();

COMMIT;

-- ============================================================
-- VERIFICATION
-- ============================================================

SELECT 
    '✅ Setup Complete!' as status,
    '' as details
UNION ALL
SELECT 
    'bid_team_members removed',
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'bid_team_members')
        THEN '❌ Still exists'
        ELSE '✅ Removed'
    END
UNION ALL
SELECT 
    'pending_approval status added',
    CASE 
        WHEN EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'pending_approval')
        THEN '✅ Added'
        ELSE '❌ Missing'
    END
UNION ALL
SELECT 
    'proposal_approvals table created',
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'proposal_approvals')
        THEN '✅ Created'
        ELSE '❌ Missing'
    END
UNION ALL
SELECT 
    'approve_proposal function created',
    CASE 
        WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'approve_proposal')
        THEN '✅ Created'
        ELSE '❌ Missing'
    END
UNION ALL
SELECT 
    'reject_proposal function created',
    CASE 
        WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'reject_proposal')
        THEN '✅ Created'
        ELSE '❌ Missing'
    END;
