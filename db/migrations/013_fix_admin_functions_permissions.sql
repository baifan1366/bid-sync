-- Migration: Fix admin functions permissions
-- Description: Add SECURITY DEFINER to admin functions to allow them to insert into admin_actions table
-- Date: 2024-11-23

-- ============================================================
-- Fix approve_project function
-- ============================================================
CREATE OR REPLACE FUNCTION approve_project(
  p_project_id UUID,
  p_admin_id UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  UPDATE projects
  SET 
    status = 'open',
    approved_by = p_admin_id,
    approved_at = NOW(),
    approval_notes = p_notes,
    updated_at = NOW()
  WHERE id = p_project_id;
  
  -- Log the action
  INSERT INTO admin_actions (admin_id, action_type, target_user_id, reason, created_at)
  SELECT p_admin_id, 'APPROVE_PROJECT', client_id, p_notes, NOW()
  FROM projects WHERE id = p_project_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Fix reject_project function
-- ============================================================
CREATE OR REPLACE FUNCTION reject_project(
  p_project_id UUID,
  p_admin_id UUID,
  p_reason TEXT
)
RETURNS VOID AS $$
BEGIN
  UPDATE projects
  SET 
    status = 'rejected',
    approved_by = p_admin_id,
    approved_at = NOW(),
    rejection_reason = p_reason,
    updated_at = NOW()
  WHERE id = p_project_id;
  
  -- Log the action
  INSERT INTO admin_actions (admin_id, action_type, target_user_id, reason, created_at)
  SELECT p_admin_id, 'REJECT_PROJECT', client_id, p_reason, NOW()
  FROM projects WHERE id = p_project_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Fix request_project_changes function
-- ============================================================
CREATE OR REPLACE FUNCTION request_project_changes(
  p_project_id UUID,
  p_admin_id UUID,
  p_changes TEXT
)
RETURNS VOID AS $$
BEGIN
  UPDATE projects
  SET 
    status = 'pending_review',
    requested_changes = p_changes,
    updated_at = NOW()
  WHERE id = p_project_id;
  
  -- Log the action
  INSERT INTO admin_actions (admin_id, action_type, target_user_id, reason, created_at)
  SELECT p_admin_id, 'REQUEST_PROJECT_CHANGES', client_id, p_changes, NOW()
  FROM projects WHERE id = p_project_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
