-- ============================================================
-- ADMIN MANAGEMENT PANEL MIGRATION
-- ============================================================
-- This migration adds support for admin management, user verification,
-- activity logging, and audit trails

-- ============================================================
-- 1. ADMIN INVITATIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.admin_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    token UUID DEFAULT gen_random_uuid() UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT admin_invitations_invited_by_fk FOREIGN KEY (invited_by) REFERENCES auth.users(id),
    CONSTRAINT admin_invitations_used_by_fk FOREIGN KEY (used_by) REFERENCES auth.users(id)
);

-- ============================================================
-- 2. USER ACTIVITY LOGS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    resource_type TEXT,
    resource_id UUID,
    ip_address INET,
    user_agent TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT user_activity_logs_user_fk FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

-- ============================================================
-- 3. ADMIN ACTIONS AUDIT LOG TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.admin_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL,
    target_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    previous_value JSONB,
    new_value JSONB,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT admin_actions_admin_fk FOREIGN KEY (admin_id) REFERENCES auth.users(id),
    CONSTRAINT admin_actions_target_fk FOREIGN KEY (target_user_id) REFERENCES auth.users(id)
);

-- ============================================================
-- 4. INDEXES FOR PERFORMANCE
-- ============================================================

-- Admin invitations indexes
CREATE INDEX IF NOT EXISTS idx_admin_invitations_email ON public.admin_invitations(email);
CREATE INDEX IF NOT EXISTS idx_admin_invitations_token ON public.admin_invitations(token);
CREATE INDEX IF NOT EXISTS idx_admin_invitations_invited_by ON public.admin_invitations(invited_by);
CREATE INDEX IF NOT EXISTS idx_admin_invitations_expires ON public.admin_invitations(expires_at);

-- User activity logs indexes
CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON public.user_activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON public.user_activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON public.user_activity_logs(action);
CREATE INDEX IF NOT EXISTS idx_activity_logs_resource ON public.user_activity_logs(resource_type, resource_id);

-- Admin actions indexes
CREATE INDEX IF NOT EXISTS idx_admin_actions_admin ON public.admin_actions(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_actions_target ON public.admin_actions(target_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_actions_created ON public.admin_actions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_actions_type ON public.admin_actions(action_type);

-- ============================================================
-- 5. ENABLE ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.admin_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_actions ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 6. RLS POLICIES FOR ADMIN_INVITATIONS
-- ============================================================

-- Only admins can view admin invitations
CREATE POLICY "admin_invitations_admin_select" ON public.admin_invitations
FOR SELECT
USING (
  (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'admin'
);

-- Only admins can create admin invitations
CREATE POLICY "admin_invitations_admin_insert" ON public.admin_invitations
FOR INSERT
WITH CHECK (
  invited_by = auth.uid() AND
  (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'admin'
);

-- Only admins can update admin invitations (for marking as used)
CREATE POLICY "admin_invitations_admin_update" ON public.admin_invitations
FOR UPDATE
USING (
  (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'admin'
);

-- ============================================================
-- 7. RLS POLICIES FOR USER_ACTIVITY_LOGS
-- ============================================================

-- Users can view their own activity logs
CREATE POLICY "activity_logs_user_select" ON public.user_activity_logs
FOR SELECT
USING (user_id = auth.uid());

-- Admins can view all activity logs
CREATE POLICY "activity_logs_admin_select" ON public.user_activity_logs
FOR SELECT
USING (
  (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'admin'
);

-- System can insert activity logs (via service role or authenticated users logging their own actions)
CREATE POLICY "activity_logs_insert" ON public.user_activity_logs
FOR INSERT
WITH CHECK (
  user_id = auth.uid() OR
  (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'admin'
);

-- ============================================================
-- 8. RLS POLICIES FOR ADMIN_ACTIONS
-- ============================================================

-- Only admins can view admin actions
CREATE POLICY "admin_actions_admin_select" ON public.admin_actions
FOR SELECT
USING (
  (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'admin'
);

-- Only admins can create admin action logs
CREATE POLICY "admin_actions_admin_insert" ON public.admin_actions
FOR INSERT
WITH CHECK (
  admin_id = auth.uid() AND
  (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'admin'
);

-- ============================================================
-- 9. HELPER FUNCTIONS
-- ============================================================

-- Function to check if a user is an admin
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    SELECT raw_user_meta_data->>'role' = 'admin'
    FROM auth.users
    WHERE id = user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to count total admins
CREATE OR REPLACE FUNCTION public.count_admins()
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::INTEGER
    FROM auth.users
    WHERE raw_user_meta_data->>'role' = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log admin actions
CREATE OR REPLACE FUNCTION public.log_admin_action(
  p_admin_id UUID,
  p_action_type TEXT,
  p_target_user_id UUID DEFAULT NULL,
  p_previous_value JSONB DEFAULT NULL,
  p_new_value JSONB DEFAULT NULL,
  p_reason TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_action_id UUID;
BEGIN
  INSERT INTO public.admin_actions (
    admin_id,
    action_type,
    target_user_id,
    previous_value,
    new_value,
    reason
  ) VALUES (
    p_admin_id,
    p_action_type,
    p_target_user_id,
    p_previous_value,
    p_new_value,
    p_reason
  )
  RETURNING id INTO v_action_id;
  
  RETURN v_action_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log user activity
CREATE OR REPLACE FUNCTION public.log_user_activity(
  p_user_id UUID,
  p_action TEXT,
  p_resource_type TEXT DEFAULT NULL,
  p_resource_id UUID DEFAULT NULL,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO public.user_activity_logs (
    user_id,
    action,
    resource_type,
    resource_id,
    ip_address,
    user_agent,
    metadata
  ) VALUES (
    p_user_id,
    p_action,
    p_resource_type,
    p_resource_id,
    p_ip_address,
    p_user_agent,
    p_metadata
  )
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 10. COMMENTS FOR DOCUMENTATION
-- ============================================================

COMMENT ON TABLE public.admin_invitations IS 'Stores admin invitation tokens for adding new administrators';
COMMENT ON TABLE public.user_activity_logs IS 'Tracks user actions and activities for audit purposes';
COMMENT ON TABLE public.admin_actions IS 'Audit log for all administrative actions performed on the platform';

COMMENT ON COLUMN public.admin_invitations.token IS 'Unique token used to accept admin invitation';
COMMENT ON COLUMN public.admin_invitations.expires_at IS 'Expiration timestamp for the invitation';
COMMENT ON COLUMN public.user_activity_logs.metadata IS 'Additional context about the activity in JSON format';
COMMENT ON COLUMN public.admin_actions.previous_value IS 'State before the admin action';
COMMENT ON COLUMN public.admin_actions.new_value IS 'State after the admin action';

-- ============================================================
-- 11. USER METADATA STRUCTURE DOCUMENTATION
-- ============================================================

-- The following fields are stored in auth.users.raw_user_meta_data:
-- {
--   "role": "client" | "bidding_lead" | "bidding_member" | "admin",
--   "verification_status": "pending_verification" | "verified" | "rejected",
--   "verification_reason": "string",
--   "verification_decided_at": "timestamp",
--   "verification_decided_by": "uuid",
--   "full_name": "string",
--   "company_name": "string",
--   "is_suspended": boolean,
--   "suspended_reason": "string",
--   "suspended_at": "timestamp",
--   "suspended_by": "uuid",
--   "last_activity_at": "timestamp"
-- }

-- Note: These fields are managed through the application layer and GraphQL mutations.
-- No database constraints are enforced on the JSONB structure to maintain flexibility.

-- ============================================================
-- END OF MIGRATION
-- ============================================================
