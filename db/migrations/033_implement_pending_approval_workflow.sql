-- ============================================================
-- Migration: Implement pending_approval workflow (Part 2)
-- Description: Change workflow so proposals need admin approval after submission
--              before clients can see them
-- ============================================================

-- Step 1: Update RLS policy for proposals so clients can only see approved proposals
DROP POLICY IF EXISTS "proposal_read" ON public.proposals;

CREATE POLICY "proposal_read" ON public.proposals
FOR SELECT USING (
    -- Lead can see their own proposals
    auth.uid() = lead_id
    -- Team members can see proposals they're part of
    OR EXISTS (
        SELECT 1 FROM proposal_team_members m 
        WHERE m.user_id = auth.uid() AND m.proposal_id = id
    )
    -- Clients can ONLY see proposals that are NOT pending_approval or rejected
    OR (
        EXISTS (
            SELECT 1 FROM projects p 
            WHERE p.id = project_id 
            AND p.client_id = auth.uid()
        )
        AND status NOT IN ('pending_approval', 'rejected')
    )
    -- Admins can see all proposals (check user_metadata for role)
    OR (
        SELECT COALESCE(
            (auth.jwt() -> 'user_metadata' ->> 'role')::text = 'admin',
            false
        )
    )
);

-- Step 2: Create admin functions to approve/reject proposals
CREATE OR REPLACE FUNCTION public.admin_approve_proposal(
  p_proposal_id UUID,
  p_admin_id UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
  v_project_id UUID;
  v_lead_id UUID;
  v_client_id UUID;
  v_project_title TEXT;
BEGIN
  -- Get proposal and project details
  SELECT pr.project_id, pr.lead_id, p.client_id, p.title
  INTO v_project_id, v_lead_id, v_client_id, v_project_title
  FROM public.proposals pr
  JOIN public.projects p ON p.id = pr.project_id
  WHERE pr.id = p_proposal_id;

  -- Update proposal status to submitted (approved by admin)
  UPDATE public.proposals 
  SET 
    status = 'submitted',
    updated_at = NOW()
  WHERE id = p_proposal_id;

  -- Log admin action
  INSERT INTO public.admin_actions (
    admin_id, 
    action_type, 
    target_user_id, 
    reason, 
    created_at
  )
  VALUES (
    p_admin_id, 
    'APPROVE_PROPOSAL', 
    v_lead_id, 
    COALESCE(p_notes, 'Proposal approved'), 
    NOW()
  );

  -- Create notification for lead
  INSERT INTO public.notification_queue (
    user_id,
    type,
    title,
    body,
    data,
    read,
    created_at
  )
  VALUES (
    v_lead_id,
    'proposal_approved',
    '✅ Proposal Approved',
    'Your proposal for "' || v_project_title || '" has been approved and is now visible to the client.',
    jsonb_build_object(
      'proposalId', p_proposal_id,
      'projectId', v_project_id,
      'projectTitle', v_project_title,
      'adminNotes', p_notes
    ),
    false,
    NOW()
  );

  -- Create notification for client
  INSERT INTO public.notification_queue (
    user_id,
    type,
    title,
    body,
    data,
    read,
    created_at
  )
  VALUES (
    v_client_id,
    'proposal_available',
    '📝 New Proposal Available',
    'A new proposal for "' || v_project_title || '" is now available for your review.',
    jsonb_build_object(
      'proposalId', p_proposal_id,
      'projectId', v_project_id,
      'projectTitle', v_project_title
    ),
    false,
    NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.admin_reject_proposal(
  p_proposal_id UUID,
  p_admin_id UUID,
  p_reason TEXT
)
RETURNS VOID AS $$
DECLARE
  v_project_id UUID;
  v_lead_id UUID;
  v_project_title TEXT;
BEGIN
  -- Get proposal and project details
  SELECT pr.project_id, pr.lead_id, p.title
  INTO v_project_id, v_lead_id, v_project_title
  FROM public.proposals pr
  JOIN public.projects p ON p.id = pr.project_id
  WHERE pr.id = p_proposal_id;

  -- Update proposal status to rejected
  UPDATE public.proposals 
  SET 
    status = 'rejected',
    updated_at = NOW()
  WHERE id = p_proposal_id;

  -- Log admin action
  INSERT INTO public.admin_actions (
    admin_id, 
    action_type, 
    target_user_id, 
    reason, 
    created_at
  )
  VALUES (
    p_admin_id, 
    'REJECT_PROPOSAL', 
    v_lead_id, 
    p_reason, 
    NOW()
  );

  -- Create notification for lead
  INSERT INTO public.notification_queue (
    user_id,
    type,
    title,
    body,
    data,
    read,
    created_at
  )
  VALUES (
    v_lead_id,
    'proposal_rejected',
    '❌ Proposal Rejected',
    'Your proposal for "' || v_project_title || '" has been rejected. Reason: ' || p_reason,
    jsonb_build_object(
      'proposalId', p_proposal_id,
      'projectId', v_project_id,
      'projectTitle', v_project_title,
      'rejectionReason', p_reason
    ),
    false,
    NOW()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 3: Grant execute permissions to admins
GRANT EXECUTE ON FUNCTION public.admin_approve_proposal TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reject_proposal TO authenticated;

-- Step 4: Update existing 'submitted' proposals to 'pending_approval'
-- This ensures existing submitted proposals follow the new workflow
UPDATE public.proposals 
SET status = 'pending_approval'
WHERE status = 'submitted';

COMMENT ON FUNCTION public.admin_approve_proposal IS 'Allows admins to approve proposals, making them visible to clients';
COMMENT ON FUNCTION public.admin_reject_proposal IS 'Allows admins to reject proposals with a reason';
