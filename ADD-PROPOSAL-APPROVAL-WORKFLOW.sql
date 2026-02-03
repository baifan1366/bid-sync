-- ============================================================
-- ADD PROPOSAL APPROVAL WORKFLOW
-- ============================================================
-- This adds a pending_approval status and creates admin approval workflow
-- ============================================================

BEGIN;

-- 1. Add pending_approval to proposal_status enum
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

-- 2. Add approval tracking columns to proposals table
ALTER TABLE public.proposals 
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- 3. Create proposal approval history table
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

-- Enable RLS
ALTER TABLE public.proposal_approvals ENABLE ROW LEVEL SECURITY;

-- RLS Policies for proposal_approvals
CREATE POLICY "proposal_approvals_admin_select" ON public.proposal_approvals
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM auth.users
        WHERE id = auth.uid() 
        AND raw_user_meta_data->>'role' = 'admin'
    )
);

CREATE POLICY "proposal_approvals_admin_insert" ON public.proposal_approvals
FOR INSERT WITH CHECK (
    admin_id = auth.uid() 
    AND EXISTS (
        SELECT 1 FROM auth.users
        WHERE id = auth.uid() 
        AND raw_user_meta_data->>'role' = 'admin'
    )
);

-- Proposal leads can view approval history for their proposals
CREATE POLICY "proposal_approvals_lead_select" ON public.proposal_approvals
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.proposals p
        WHERE p.id = proposal_approvals.proposal_id
        AND p.lead_id = auth.uid()
    )
);

-- 4. Create admin approval functions
CREATE OR REPLACE FUNCTION public.approve_proposal(
    p_proposal_id UUID,
    p_admin_id UUID,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
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
            'error', 'Proposal not found'
        );
    END IF;

    IF v_proposal_status != 'pending_approval' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Only proposals with pending_approval status can be approved'
        );
    END IF;

    -- Update proposal status to submitted
    UPDATE public.proposals 
    SET 
        status = 'submitted',
        approved_by = p_admin_id,
        approved_at = NOW(),
        submitted_at = NOW(),
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
        'message', 'Proposal approved successfully'
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
    v_result JSONB;
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
            'error', 'Proposal not found'
        );
    END IF;

    IF v_proposal_status != 'pending_approval' THEN
        RETURN jsonb_build_object(
            'success', false,
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
        'message', 'Proposal rejected successfully'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.approve_proposal(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_proposal(UUID, UUID, TEXT) TO authenticated;

COMMIT;

-- Verification
DO $$
BEGIN
    RAISE NOTICE '==============================================';
    RAISE NOTICE 'Proposal Approval Workflow Added!';
    RAISE NOTICE '==============================================';
    RAISE NOTICE 'New status: pending_approval';
    RAISE NOTICE 'New functions: approve_proposal, reject_proposal';
    RAISE NOTICE 'New table: proposal_approvals';
    RAISE NOTICE '==============================================';
    RAISE NOTICE 'Workflow:';
    RAISE NOTICE '1. Lead submits → status = pending_approval';
    RAISE NOTICE '2. Admin approves → status = submitted';
    RAISE NOTICE '3. Admin rejects → status = rejected';
    RAISE NOTICE '==============================================';
END $$;
