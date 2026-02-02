-- ============================================================
-- BIDSYNC — FULL SUPABASE SQL SCHEMA (GraphQL + RLS Ready)
-- ============================================================

-- ============================================================
-- 1. Create ENUM Types
-- ============================================================
CREATE TYPE user_role AS ENUM ('client', 'bidding_member', 'bidding_lead', 'admin');
CREATE TYPE proposal_status AS ENUM ('draft', 'submitted', 'reviewing', 'approved', 'rejected', 'archived');
CREATE TYPE project_status AS ENUM ('pending_review', 'open', 'closed', 'awarded');
CREATE TYPE comment_visibility AS ENUM ('internal', 'public');

-- ============================================================
-- 2. Insert Sample Users into auth.users (via RPC)
-- ============================================================
-- NOTE: Only works on self-hosted or via Supabase service role.
-- If using hosted Supabase, insert via Authentication > Users.

-- CLIENT
SELECT auth.admin_create_user(
    email := 'client@example.com',
    password := 'Password123!',
    email_confirm := true,
    user_metadata := jsonb_build_object('role', 'client', 'name', 'Alice Client')
);

-- BIDDING LEAD
SELECT auth.admin_create_user(
    email := 'lead@example.com',
    password := 'Password123!',
    email_confirm := true,
    user_metadata := jsonb_build_object('role', 'bidding_lead', 'name', 'Bob Lead')
);

-- BIDDING MEMBER
SELECT auth.admin_create_user(
    email := 'member@example.com',
    password := 'Password123!',
    email_confirm := true,
    user_metadata := jsonb_build_object('role', 'bidding_member', 'name', 'Charlie Member')
);

-- ADMIN
SELECT auth.admin_create_user(
    email := 'admin@example.com',
    password := 'Password123!',
    email_confirm := true,
    user_metadata := jsonb_build_object('role', 'admin', 'name', 'Diana Admin')
);

-- ============================================================
-- 3. PROJECT TABLE
-- ============================================================
CREATE TABLE public.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    status project_status NOT NULL DEFAULT 'open',
    budget NUMERIC,
    deadline DATE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_projects_client ON public.projects(client_id);
CREATE INDEX idx_projects_status ON public.projects(status);

-- Seed project
INSERT INTO public.projects (client_id, title, description, budget, deadline)
SELECT id, 'Website Revamp Project', 'Full redesign of corporate website.', 20000, NOW() + INTERVAL '30 days'
FROM auth.users WHERE email = 'client@example.com' LIMIT 1;


-- ============================================================
-- 4. PROPOSAL TEAM MEMBERS
-- ============================================================
-- NOTE: Team members belong to proposals, not projects.
-- This is the correct architecture for team management.
-- ============================================================
CREATE TABLE public.proposal_team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proposal_id UUID NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('lead', 'member')),
    joined_at TIMESTAMPTZ DEFAULT now(),
    assigned_sections TEXT[] DEFAULT '{}',
    contribution_stats JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (proposal_id, user_id)
);

CREATE INDEX idx_proposal_team_proposal ON public.proposal_team_members(proposal_id);
CREATE INDEX idx_proposal_team_user ON public.proposal_team_members(user_id);
CREATE INDEX idx_proposal_team_role ON public.proposal_team_members(proposal_id, role);

COMMENT ON TABLE public.proposal_team_members IS 'Team members for each proposal (not project-level)';
COMMENT ON COLUMN public.proposal_team_members.proposal_id IS 'The proposal this team member belongs to';
COMMENT ON COLUMN public.proposal_team_members.assigned_sections IS 'Sections assigned to this team member';
COMMENT ON COLUMN public.proposal_team_members.contribution_stats IS 'Statistics about member contributions';


-- ============================================================
-- 5. PROPOSALS
-- ============================================================
CREATE TABLE public.proposals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    lead_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status proposal_status NOT NULL DEFAULT 'draft',
    submitted_at TIMESTAMPTZ,
    archived_at TIMESTAMPTZ,
    archived_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_proposals_project ON public.proposals(project_id);
CREATE INDEX idx_proposals_lead ON public.proposals(lead_id);
CREATE INDEX IF NOT EXISTS idx_proposals_archived_at 
ON public.proposals(archived_at) 
WHERE archived_at IS NOT NULL;

COMMENT ON COLUMN public.proposals.archived_at IS 'Timestamp when the proposal was archived';
COMMENT ON COLUMN public.proposals.archived_by IS 'User who archived the proposal';

-- Seed proposal shell
INSERT INTO public.proposals (project_id, lead_id)
SELECT p.id, u.id
FROM projects p, auth.users u
WHERE u.email = 'lead@example.com'
LIMIT 1;

-- Seed proposal team members (NEW - add lead to their proposal)
INSERT INTO public.proposal_team_members (proposal_id, user_id, role)
SELECT pr.id, pr.lead_id, 'lead'
FROM public.proposals pr
WHERE pr.lead_id IN (SELECT id FROM auth.users WHERE email = 'lead@example.com')
ON CONFLICT (proposal_id, user_id) DO NOTHING;

-- Auto-add proposal lead to proposal_team_members when proposal is created
CREATE OR REPLACE FUNCTION public.auto_add_proposal_lead()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.proposal_team_members (proposal_id, user_id, role)
    VALUES (NEW.id, NEW.lead_id, 'lead')
    ON CONFLICT (proposal_id, user_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_auto_add_proposal_lead ON public.proposals;
CREATE TRIGGER trigger_auto_add_proposal_lead
    AFTER INSERT ON public.proposals
    FOR EACH ROW
    EXECUTE FUNCTION public.auto_add_proposal_lead();

COMMENT ON FUNCTION public.auto_add_proposal_lead IS 'Automatically adds proposal lead to proposal_team_members table when a new proposal is created';


-- ============================================================
-- 6. PROPOSAL VERSIONS
-- ============================================================
CREATE TABLE public.proposal_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proposal_id UUID NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
    version_number INT NOT NULL,
    content JSONB NOT NULL,
    sections_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    documents_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
    change_summary TEXT,
    created_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT proposal_versions_version_positive CHECK (version_number > 0),
    UNIQUE (proposal_id, version_number)
);

CREATE INDEX idx_versions_proposal ON public.proposal_versions(proposal_id);
CREATE INDEX IF NOT EXISTS idx_proposal_versions_proposal_version 
    ON public.proposal_versions(proposal_id, version_number DESC);
CREATE INDEX IF NOT EXISTS idx_proposal_versions_created 
    ON public.proposal_versions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_proposal_versions_created_by 
    ON public.proposal_versions(created_by);

COMMENT ON TABLE public.proposal_versions IS 'Stores complete snapshots of proposals for version control and history tracking';
COMMENT ON COLUMN public.proposal_versions.content IS 'Main proposal content snapshot';
COMMENT ON COLUMN public.proposal_versions.sections_snapshot IS 'Complete snapshot of all sections at version creation time';
COMMENT ON COLUMN public.proposal_versions.documents_snapshot IS 'Complete snapshot of all documents at version creation time';
COMMENT ON COLUMN public.proposal_versions.change_summary IS 'Human-readable summary of changes in this version';

-- Seed Version 1
INSERT INTO public.proposal_versions (proposal_id, version_number, content, created_by)
SELECT p.id, 1, jsonb_build_object('summary', 'Initial draft'), u.id
FROM proposals p, auth.users u
WHERE u.email = 'lead@example.com'
LIMIT 1;


-- ============================================================
-- 7. COMMENTS
-- ============================================================
CREATE TABLE public.comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proposal_id UUID NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    visibility comment_visibility NOT NULL DEFAULT 'internal',
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_comments_proposal ON public.comments(proposal_id);


-- ============================================================
-- 8. DOCUMENTS
-- ============================================================
-- NOTE: This table stores FILE ATTACHMENTS/UPLOADS for proposals.
-- NOT to be confused with workspace_documents which stores collaborative editor content.
-- 
-- documents = file attachments (PDFs, images, etc.) uploaded to proposals
-- workspace_documents = collaborative document content for the TipTap editor
-- ============================================================
CREATE TABLE public.documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proposal_id UUID NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    doc_type TEXT,
    created_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE public.documents IS 'Stores file attachments/uploads for proposals (PDFs, images, etc.). NOT for collaborative editor content - use workspace_documents for that.';

CREATE INDEX idx_docs_proposal ON public.documents(proposal_id);


-- ============================================================
-- 9. CHECKLISTS
-- ============================================================
CREATE TABLE public.checklist_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proposal_id UUID NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    passed BOOLEAN DEFAULT false,
    reviewer_id UUID REFERENCES auth.users(id),
    checked_at TIMESTAMPTZ
);

CREATE INDEX idx_checklist_proposal ON public.checklist_items(proposal_id);


-- ============================================================
-- 10. NOTIFICATIONS (Optional but useful)
-- ============================================================
CREATE TABLE public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    title TEXT NOT NULL,
    body TEXT,
    read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_notifications_user ON public.notifications(user_id);


-- ============================================================
-- 11. ENABLE RLS
-- ============================================================
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- 12. RLS POLICIES
-- ============================================================

-- PUBLIC PROJECTS (Clients own them; bidders can view)
CREATE POLICY "projects_read" ON public.projects
FOR SELECT USING (true);

CREATE POLICY "projects_modify" ON public.projects
FOR UPDATE TO authenticated
USING (auth.uid() = client_id);

-- PROPOSALS (Lead + team + client can read)
CREATE POLICY "proposal_read" ON public.proposals
FOR SELECT USING (
    auth.uid() = lead_id
    OR EXISTS (
        SELECT 1 FROM proposal_team_members m WHERE m.user_id = auth.uid() AND m.proposal_id = id
    )
    OR EXISTS (
        SELECT 1 FROM projects p WHERE p.id = project_id AND p.client_id = auth.uid()
    )
);

CREATE POLICY "proposal_write" ON public.proposals
FOR UPDATE TO authenticated
USING (auth.uid() = lead_id);


-- PROPOSAL VERSIONS
CREATE POLICY "versions_read" ON public.proposal_versions
FOR SELECT USING (
    EXISTS (SELECT 1 FROM proposals p WHERE p.id = proposal_id AND (
        auth.uid() = p.lead_id OR
        EXISTS (SELECT 1 FROM proposal_team_members m WHERE m.user_id = auth.uid() AND m.proposal_id = p.id)
    ))
);

CREATE POLICY "versions_write" ON public.proposal_versions
FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM proposals p WHERE p.id = proposal_id AND (
        auth.uid() = p.lead_id OR
        EXISTS (SELECT 1 FROM proposal_team_members m WHERE m.user_id = auth.uid() AND m.proposal_id = p.id)
    ))
);


-- COMMENTS
CREATE POLICY "comments_read" ON public.comments
FOR SELECT USING (
    visibility = 'public'
    OR EXISTS (
        SELECT 1 FROM proposal_team_members m
        WHERE m.proposal_id = proposal_id AND m.user_id = auth.uid()
    )
);

CREATE POLICY "comments_write" ON public.comments
FOR INSERT WITH CHECK (auth.uid() = author_id);


-- DOCUMENTS
CREATE POLICY "docs_read" ON public.documents
FOR SELECT USING (true);

CREATE POLICY "docs_write" ON public.documents
FOR INSERT WITH CHECK (auth.uid() = created_by);


-- CHECKLISTS (Admins + Clients)
CREATE POLICY "checklist_read" ON public.checklist_items
FOR SELECT USING (true);

CREATE POLICY "checklist_modify" ON public.checklist_items
FOR UPDATE USING (
    (SELECT raw_user_meta_data->>'role' FROM auth.users u WHERE u.id = auth.uid()) = 'admin'
);


-- NOTIFICATIONS
CREATE POLICY "notif_read" ON public.notifications
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "notif_write" ON public.notifications
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- TEAM INVITATIONS TABLE
-- ============================================================

-- Create team_invitations table for managing team member invitations
CREATE TABLE public.team_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,  -- DEPRECATED: for legacy support
    proposal_id UUID REFERENCES public.proposals(id) ON DELETE CASCADE,  -- NEW: correct approach
    created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    code VARCHAR(8) NOT NULL UNIQUE,  -- 8-digit code
    token UUID DEFAULT gen_random_uuid() UNIQUE,  -- for shareable links
    expires_at TIMESTAMPTZ NOT NULL,
    used_by UUID REFERENCES auth.users(id),
    used_at TIMESTAMPTZ,
    is_multi_use BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT team_invitations_code_format CHECK (code ~ '^\d{8}$'),
    CONSTRAINT team_invitations_expires_future CHECK (expires_at > created_at),
    CONSTRAINT team_invitations_has_project_or_proposal CHECK (project_id IS NOT NULL OR proposal_id IS NOT NULL)
);

-- Create indexes for performance
CREATE INDEX idx_team_invitations_code ON public.team_invitations(code);
CREATE INDEX idx_team_invitations_token ON public.team_invitations(token);
CREATE INDEX idx_team_invitations_project ON public.team_invitations(project_id);
CREATE INDEX idx_team_invitations_proposal ON public.team_invitations(proposal_id);
CREATE INDEX idx_team_invitations_created_by ON public.team_invitations(created_by);
CREATE INDEX IF NOT EXISTS idx_team_invitations_expires 
    ON public.team_invitations(expires_at) 
    WHERE used_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_team_invitations_project_active 
    ON public.team_invitations(project_id, expires_at) 
    WHERE used_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_team_invitations_proposal_active 
    ON public.team_invitations(proposal_id, expires_at) 
    WHERE used_at IS NULL;

-- Enable RLS
ALTER TABLE public.team_invitations ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS POLICIES FOR TEAM INVITATIONS
-- ============================================================

-- Proposal leads can view invitations for their proposals (NEW)
CREATE POLICY "team_invitations_proposal_lead_select" ON public.team_invitations
FOR SELECT
USING (
    proposal_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.proposal_team_members ptm
        WHERE ptm.proposal_id = team_invitations.proposal_id
        AND ptm.user_id = auth.uid()
        AND ptm.role = 'lead'
    )
);

-- Proposal leads can create invitations for their proposals (NEW)
CREATE POLICY "team_invitations_proposal_lead_insert" ON public.team_invitations
FOR INSERT
WITH CHECK (
    proposal_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.proposal_team_members ptm
        WHERE ptm.proposal_id = team_invitations.proposal_id
        AND ptm.user_id = auth.uid()
        AND ptm.role = 'lead'
    )
);

-- Anyone can view invitations by code or token (for validation)
CREATE POLICY "team_invitations_public_select_by_code_token" ON public.team_invitations
FOR SELECT
USING (true);

-- System can update invitations (for marking as used)
CREATE POLICY "team_invitations_system_update" ON public.team_invitations
FOR UPDATE
USING (true)
WITH CHECK (true);

-- Admins can view all invitations
CREATE POLICY "team_invitations_admin_select" ON public.team_invitations
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM auth.users
        WHERE id = auth.uid() 
        AND raw_user_meta_data->>'role' = 'admin'
    )
);

COMMENT ON TABLE public.team_invitations IS 'Stores team invitations with codes and tokens for bidding team member joining';
COMMENT ON COLUMN public.team_invitations.code IS '8-digit numeric code for easy sharing';
COMMENT ON COLUMN public.team_invitations.token IS 'UUID token for invitation links';
COMMENT ON COLUMN public.team_invitations.is_multi_use IS 'Whether invitation can be used multiple times';
COMMENT ON COLUMN public.team_invitations.used_by IS 'User who used the invitation (for single-use tracking)';
COMMENT ON COLUMN public.team_invitations.used_at IS 'Timestamp when invitation was used (for single-use tracking)';


-- ============================================================
-- END OF FULL SCHEMA
-- ============================================================

-- ============================================================
-- MIGRATION 002: CHAT AND DECISIONS
-- ============================================================

-- Chat Messages Table
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  proposal_id UUID REFERENCES public.proposals(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  read BOOLEAN DEFAULT FALSE
);

-- Proposal Decisions Table
CREATE TABLE IF NOT EXISTS public.proposal_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  decision_type VARCHAR(20) NOT NULL CHECK (decision_type IN ('accepted', 'rejected')),
  decided_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  decided_at TIMESTAMPTZ DEFAULT now(),
  feedback TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_chat_messages_project ON public.chat_messages(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_proposal ON public.chat_messages(proposal_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_unread ON public.chat_messages(sender_id, read) WHERE read = FALSE;
CREATE INDEX IF NOT EXISTS idx_proposal_decisions_proposal ON public.proposal_decisions(proposal_id);
CREATE INDEX IF NOT EXISTS idx_proposal_decisions_project ON public.proposal_decisions(project_id);

-- Enable RLS
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_decisions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Chat Messages
CREATE POLICY "chat_messages_client_select" ON public.chat_messages
FOR SELECT USING (project_id IN (SELECT id FROM public.projects WHERE client_id = auth.uid()));

CREATE POLICY "chat_messages_client_insert" ON public.chat_messages
FOR INSERT WITH CHECK (sender_id = auth.uid() AND project_id IN (SELECT id FROM public.projects WHERE client_id = auth.uid()));

CREATE POLICY "chat_messages_team_select" ON public.chat_messages
FOR SELECT USING (proposal_id IN (SELECT id FROM public.proposal_team_members WHERE user_id = auth.uid()));

CREATE POLICY "chat_messages_team_insert" ON public.chat_messages
FOR INSERT WITH CHECK (sender_id = auth.uid() AND proposal_id IN (SELECT proposal_id FROM public.proposal_team_members WHERE user_id = auth.uid()));

CREATE POLICY "chat_messages_mark_read" ON public.chat_messages
FOR UPDATE USING ((project_id IN (SELECT id FROM public.projects WHERE client_id = auth.uid())) OR (proposal_id IN (SELECT proposal_id FROM public.proposal_team_members WHERE user_id = auth.uid())));

-- RLS Policies for Proposal Decisions
CREATE POLICY "proposal_decisions_client_select" ON public.proposal_decisions
FOR SELECT USING (project_id IN (SELECT id FROM public.projects WHERE client_id = auth.uid()));

CREATE POLICY "proposal_decisions_client_insert" ON public.proposal_decisions
FOR INSERT WITH CHECK (decided_by = auth.uid() AND project_id IN (SELECT id FROM public.projects WHERE client_id = auth.uid()));

CREATE POLICY "proposal_decisions_team_select" ON public.proposal_decisions
FOR SELECT USING (proposal_id IN (SELECT proposal_id FROM public.proposal_team_members WHERE user_id = auth.uid()));

-- ============================================================
-- MIGRATION 003: ADMIN MANAGEMENT
-- ============================================================

-- Admin Invitations Table
CREATE TABLE IF NOT EXISTS public.admin_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    token UUID DEFAULT gen_random_uuid() UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- User Activity Logs Table
CREATE TABLE IF NOT EXISTS public.user_activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    resource_type TEXT,
    resource_id UUID,
    ip_address INET,
    user_agent TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Admin Actions Audit Log Table
CREATE TABLE IF NOT EXISTS public.admin_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL,
    target_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    previous_value JSONB,
    new_value JSONB,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_admin_invitations_email ON public.admin_invitations(email);
CREATE INDEX IF NOT EXISTS idx_admin_invitations_token ON public.admin_invitations(token);
CREATE INDEX IF NOT EXISTS idx_admin_invitations_invited_by ON public.admin_invitations(invited_by);
CREATE INDEX IF NOT EXISTS idx_admin_invitations_expires ON public.admin_invitations(expires_at);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON public.user_activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON public.user_activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON public.user_activity_logs(action);
CREATE INDEX IF NOT EXISTS idx_activity_logs_resource ON public.user_activity_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_admin_actions_admin ON public.admin_actions(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_actions_target ON public.admin_actions(target_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_actions_created ON public.admin_actions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_actions_type ON public.admin_actions(action_type);
CREATE INDEX IF NOT EXISTS idx_user_notification_prefs_user_id ON public.user_notification_preferences(user_id);

-- Enable RLS
ALTER TABLE public.admin_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_actions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "admin_invitations_admin_select" ON public.admin_invitations
FOR SELECT USING ((SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'admin');

CREATE POLICY "admin_invitations_admin_insert" ON public.admin_invitations
FOR INSERT WITH CHECK (invited_by = auth.uid() AND (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'admin');

CREATE POLICY "admin_invitations_admin_update" ON public.admin_invitations
FOR UPDATE USING ((SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'admin');

CREATE POLICY "activity_logs_user_select" ON public.user_activity_logs
FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "activity_logs_admin_select" ON public.user_activity_logs
FOR SELECT USING ((SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'admin');

CREATE POLICY "activity_logs_insert" ON public.user_activity_logs
FOR INSERT WITH CHECK (user_id = auth.uid() OR (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'admin');

CREATE POLICY "admin_actions_admin_select" ON public.admin_actions
FOR SELECT USING ((SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'admin');

CREATE POLICY "admin_actions_admin_insert" ON public.admin_actions
FOR INSERT WITH CHECK (admin_id = auth.uid() AND (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'admin');

-- Helper Functions
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (SELECT raw_user_meta_data->>'role' = 'admin' FROM auth.users WHERE id = user_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.count_admins()
RETURNS INTEGER AS $$
BEGIN
  RETURN (SELECT COUNT(*)::INTEGER FROM auth.users WHERE raw_user_meta_data->>'role' = 'admin');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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
  INSERT INTO public.admin_actions (admin_id, action_type, target_user_id, previous_value, new_value, reason)
  VALUES (p_admin_id, p_action_type, p_target_user_id, p_previous_value, p_new_value, p_reason)
  RETURNING id INTO v_action_id;
  RETURN v_action_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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
  INSERT INTO public.user_activity_logs (user_id, action, resource_type, resource_id, ip_address, user_agent, metadata)
  VALUES (p_user_id, p_action, p_resource_type, p_resource_id, p_ip_address, p_user_agent, p_metadata)
  RETURNING id INTO v_log_id;
  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- MIGRATION 005: PROPOSAL SUBMISSION WORKFLOW
-- ============================================================

-- Add columns to projects table
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS additional_info_requirements JSONB DEFAULT '[]'::jsonb;

-- Add columns to proposals table
ALTER TABLE public.proposals 
ADD COLUMN IF NOT EXISTS title TEXT,
ADD COLUMN IF NOT EXISTS content TEXT,
ADD COLUMN IF NOT EXISTS budget_estimate NUMERIC,
ADD COLUMN IF NOT EXISTS timeline_estimate TEXT,
ADD COLUMN IF NOT EXISTS executive_summary TEXT,
ADD COLUMN IF NOT EXISTS additional_info JSONB DEFAULT '{}'::jsonb;

-- Proposal Additional Info Table
CREATE TABLE IF NOT EXISTS public.proposal_additional_info (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proposal_id UUID NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
    field_id TEXT NOT NULL,
    field_name TEXT NOT NULL,
    field_value JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (proposal_id, field_id)
);

-- Submission Drafts Table
CREATE TABLE IF NOT EXISTS public.submission_drafts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proposal_id UUID NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    current_step INT NOT NULL DEFAULT 1,
    draft_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (proposal_id, user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_proposal_additional_info_proposal ON public.proposal_additional_info(proposal_id);
CREATE INDEX IF NOT EXISTS idx_proposal_additional_info_field ON public.proposal_additional_info(field_id);
CREATE INDEX IF NOT EXISTS idx_submission_drafts_proposal ON public.submission_drafts(proposal_id);
CREATE INDEX IF NOT EXISTS idx_submission_drafts_user ON public.submission_drafts(user_id);
CREATE INDEX IF NOT EXISTS idx_submission_drafts_updated ON public.submission_drafts(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_projects_additional_requirements ON public.projects USING GIN (additional_info_requirements);
CREATE INDEX IF NOT EXISTS idx_proposals_title ON public.proposals(title);
CREATE INDEX IF NOT EXISTS idx_proposals_budget ON public.proposals(budget_estimate);

-- Enable RLS
ALTER TABLE public.proposal_additional_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submission_drafts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Proposal Additional Info
CREATE POLICY "proposal_additional_info_client_select" ON public.proposal_additional_info
FOR SELECT USING (proposal_id IN (SELECT p.id FROM public.proposals p INNER JOIN public.projects proj ON proj.id = p.project_id WHERE proj.client_id = auth.uid()));

CREATE POLICY "proposal_additional_info_lead_select" ON public.proposal_additional_info
FOR SELECT USING (proposal_id IN (SELECT id FROM public.proposals WHERE lead_id = auth.uid()));

CREATE POLICY "proposal_additional_info_team_select" ON public.proposal_additional_info
FOR SELECT USING (proposal_id IN (SELECT p.id FROM public.proposals p INNER JOIN public.bid_team_members btm ON btm.project_id = p.project_id WHERE btm.user_id = auth.uid()));

CREATE POLICY "proposal_additional_info_lead_insert" ON public.proposal_additional_info
FOR INSERT WITH CHECK (proposal_id IN (SELECT id FROM public.proposals WHERE lead_id = auth.uid()));

CREATE POLICY "proposal_additional_info_lead_update" ON public.proposal_additional_info
FOR UPDATE USING (proposal_id IN (SELECT id FROM public.proposals WHERE lead_id = auth.uid()));

CREATE POLICY "proposal_additional_info_lead_delete" ON public.proposal_additional_info
FOR DELETE USING (proposal_id IN (SELECT id FROM public.proposals WHERE lead_id = auth.uid()));

-- RLS Policies for Submission Drafts
CREATE POLICY "submission_drafts_user_select" ON public.submission_drafts
FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "submission_drafts_user_insert" ON public.submission_drafts
FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "submission_drafts_user_update" ON public.submission_drafts
FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "submission_drafts_user_delete" ON public.submission_drafts
FOR DELETE USING (user_id = auth.uid());

-- Helper Functions
CREATE OR REPLACE FUNCTION public.get_project_requirements(p_project_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_requirements JSONB;
BEGIN
  SELECT additional_info_requirements INTO v_requirements FROM public.projects WHERE id = p_project_id;
  RETURN COALESCE(v_requirements, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_proposal_additional_info_updated_at ON public.proposal_additional_info;
CREATE TRIGGER update_proposal_additional_info_updated_at
  BEFORE UPDATE ON public.proposal_additional_info
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_submission_drafts_updated_at ON public.submission_drafts;
CREATE TRIGGER update_submission_drafts_updated_at
  BEFORE UPDATE ON public.submission_drafts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- MIGRATION 007: Q&A SYSTEM, ANALYTICS, AND ADDITIONAL FEATURES
-- ============================================================

-- Project Questions Table
CREATE TABLE IF NOT EXISTS public.project_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  asked_by UUID NOT NULL REFERENCES auth.users(id),
  question TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Question Answers Table
CREATE TABLE IF NOT EXISTS public.question_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES public.project_questions(id) ON DELETE CASCADE,
  answered_by UUID NOT NULL REFERENCES auth.users(id),
  answer TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Document Comments Table
CREATE TABLE IF NOT EXISTS public.document_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.workspace_documents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  content TEXT NOT NULL,
  is_internal BOOLEAN DEFAULT true,
  parent_id UUID REFERENCES public.document_comments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contract Templates Table
CREATE TABLE IF NOT EXISTS public.contract_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  content TEXT NOT NULL,
  variables JSONB DEFAULT '[]'::jsonb,
  category VARCHAR(100),
  is_active BOOLEAN DEFAULT true,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contracts Table
CREATE TABLE IF NOT EXISTS public.contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id),
  proposal_id UUID NOT NULL REFERENCES public.proposals(id),
  template_id UUID REFERENCES public.contract_templates(id),
  content TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'draft',
  version INT DEFAULT 1,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contract Signatures Table
CREATE TABLE IF NOT EXISTS public.contract_signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL REFERENCES public.contracts(id) ON DELETE CASCADE,
  signer_id UUID NOT NULL REFERENCES auth.users(id),
  signed_at TIMESTAMPTZ,
  signature_data TEXT,
  ip_address VARCHAR(45),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add approval tracking columns to projects
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
ADD COLUMN IF NOT EXISTS approval_notes TEXT;

-- Platform Metrics Table
CREATE TABLE IF NOT EXISTS public.platform_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_date DATE NOT NULL,
  metric_type VARCHAR(100) NOT NULL,
  metric_value JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(metric_date, metric_type)
);

-- User Notification Preferences Table
CREATE TABLE IF NOT EXISTS public.user_notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email_notifications BOOLEAN DEFAULT true,
  project_updates BOOLEAN DEFAULT true,
  new_messages BOOLEAN DEFAULT true,
  proposal_updates BOOLEAN DEFAULT true,
  qa_notifications BOOLEAN DEFAULT true,
  deadline_reminders BOOLEAN DEFAULT true,
  team_notifications BOOLEAN DEFAULT true,
  completion_notifications BOOLEAN DEFAULT true,
  scoring_notifications BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_project_questions_project ON public.project_questions(project_id);
CREATE INDEX IF NOT EXISTS idx_project_questions_created ON public.project_questions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_question_answers_question ON public.question_answers(question_id);
CREATE INDEX IF NOT EXISTS idx_question_answers_created ON public.question_answers(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_document_comments_document ON public.document_comments(document_id);
CREATE INDEX IF NOT EXISTS idx_document_comments_parent ON public.document_comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_document_comments_created ON public.document_comments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contracts_project ON public.contracts(project_id);
CREATE INDEX IF NOT EXISTS idx_contracts_proposal ON public.contracts(proposal_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON public.contracts(status);
CREATE INDEX IF NOT EXISTS idx_contract_signatures_contract ON public.contract_signatures(contract_id);
CREATE INDEX IF NOT EXISTS idx_projects_status_created ON public.projects(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_metrics_date ON public.platform_metrics(metric_date DESC);
CREATE INDEX IF NOT EXISTS idx_platform_metrics_type ON public.platform_metrics(metric_type);

-- Enable RLS
ALTER TABLE public.project_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_notification_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Q&A
CREATE POLICY "Anyone can view project questions" ON public.project_questions FOR SELECT USING (true);
CREATE POLICY "Authenticated users can ask questions" ON public.project_questions FOR INSERT WITH CHECK (auth.uid() = asked_by);
CREATE POLICY "Anyone can view answers" ON public.question_answers FOR SELECT USING (true);
CREATE POLICY "Authenticated users can answer" ON public.question_answers FOR INSERT WITH CHECK (auth.uid() = answered_by);

-- RLS Policies for Comments
CREATE POLICY "Team members can view comments" ON public.document_comments
FOR SELECT USING (EXISTS (SELECT 1 FROM public.document_collaborators dc WHERE dc.document_id = document_comments.document_id AND dc.user_id = auth.uid()));

CREATE POLICY "Team members can create comments" ON public.document_comments
FOR INSERT WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.document_collaborators dc WHERE dc.document_id = document_comments.document_id AND dc.user_id = auth.uid()));

-- RLS Policies for Contracts
CREATE POLICY "Project participants can view contracts" ON public.contracts
FOR SELECT USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = contracts.project_id AND (p.client_id = auth.uid() OR EXISTS (SELECT 1 FROM public.proposals pr WHERE pr.project_id = p.id AND pr.lead_id = auth.uid()))));

-- RLS Policies for Notification Preferences
-- Drop existing policies to ensure clean state
DROP POLICY IF EXISTS "Users can manage their notification preferences" ON public.user_notification_preferences;
DROP POLICY IF EXISTS "user_notification_prefs_select" ON public.user_notification_preferences;
DROP POLICY IF EXISTS "user_notification_prefs_insert" ON public.user_notification_preferences;
DROP POLICY IF EXISTS "user_notification_prefs_update" ON public.user_notification_preferences;
DROP POLICY IF EXISTS "user_notification_prefs_admin_select" ON public.user_notification_preferences;

-- Users can view their own preferences
CREATE POLICY "user_notification_prefs_select" ON public.user_notification_preferences
FOR SELECT USING (user_id = auth.uid());

-- Users can create their own preferences
CREATE POLICY "user_notification_prefs_insert" ON public.user_notification_preferences
FOR INSERT WITH CHECK (user_id = auth.uid());

-- Users can update their own preferences
CREATE POLICY "user_notification_prefs_update" ON public.user_notification_preferences
FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Admins can view all preferences
CREATE POLICY "user_notification_prefs_admin_select" ON public.user_notification_preferences
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM auth.users
        WHERE id = auth.uid() 
        AND raw_user_meta_data->>'role' = 'admin'
    )
);

-- Helper Functions
CREATE OR REPLACE FUNCTION get_pending_projects_count()
RETURNS INTEGER AS $$
BEGIN
  RETURN (SELECT COUNT(*) FROM public.projects WHERE status = 'pending_review');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION approve_project(p_project_id UUID, p_admin_id UUID, p_notes TEXT DEFAULT NULL)
RETURNS VOID AS $$
BEGIN
  UPDATE public.projects SET status = 'open', approved_by = p_admin_id, approved_at = NOW(), approval_notes = p_notes, updated_at = NOW() WHERE id = p_project_id;
  INSERT INTO public.admin_actions (admin_id, action_type, target_user_id, reason, created_at)
  SELECT p_admin_id, 'APPROVE_PROJECT', client_id, p_notes, NOW() FROM public.projects WHERE id = p_project_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION reject_project(p_project_id UUID, p_admin_id UUID, p_reason TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE public.projects SET status = 'pending_review', approved_by = p_admin_id, approved_at = NOW(), rejection_reason = p_reason, updated_at = NOW() WHERE id = p_project_id;
  INSERT INTO public.admin_actions (admin_id, action_type, target_user_id, reason, created_at)
  SELECT p_admin_id, 'REJECT_PROJECT', client_id, p_reason, NOW() FROM public.projects WHERE id = p_project_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.calculate_platform_analytics(
    p_date_from TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days', 
    p_date_to TIMESTAMPTZ DEFAULT NOW()
)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
    user_growth JSONB;
    project_stats JSONB;
    proposal_stats JSONB;
BEGIN
    -- Get user growth data
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'date', date_trunc('day', created_at)::date, 
            'value', cnt
        ) ORDER BY day
    ), '[]'::jsonb)
    INTO user_growth
    FROM (
        SELECT date_trunc('day', created_at) as day, COUNT(*) as cnt
        FROM auth.users 
        WHERE created_at BETWEEN p_date_from AND p_date_to 
        GROUP BY date_trunc('day', created_at)
    ) t;

    -- Get project stats
    SELECT jsonb_build_object(
        'total', COUNT(*), 
        'pending', COUNT(*) FILTER (WHERE status = 'pending_review'), 
        'open', COUNT(*) FILTER (WHERE status = 'open'), 
        'closed', COUNT(*) FILTER (WHERE status = 'closed'), 
        'awarded', COUNT(*) FILTER (WHERE status = 'awarded')
    )
    INTO project_stats
    FROM public.projects 
    WHERE created_at BETWEEN p_date_from AND p_date_to;

    -- Get proposal stats
    SELECT jsonb_build_object(
        'total', COUNT(*), 
        'draft', COUNT(*) FILTER (WHERE status = 'draft'), 
        'submitted', COUNT(*) FILTER (WHERE status = 'submitted'), 
        'approved', COUNT(*) FILTER (WHERE status = 'approved'), 
        'rejected', COUNT(*) FILTER (WHERE status = 'rejected')
    )
    INTO proposal_stats
    FROM public.proposals 
    WHERE created_at BETWEEN p_date_from AND p_date_to;

    -- Build result
    result := jsonb_build_object(
        'userGrowth', COALESCE(user_growth, '[]'::jsonb),
        'projectStats', COALESCE(project_stats, jsonb_build_object('total', 0, 'pending', 0, 'open', 0, 'closed', 0, 'awarded', 0)),
        'proposalStats', COALESCE(proposal_stats, jsonb_build_object('total', 0, 'draft', 0, 'submitted', 0, 'approved', 0, 'rejected', 0))
    );

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Triggers
CREATE OR REPLACE FUNCTION update_project_questions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_project_questions_updated_at
BEFORE UPDATE ON public.project_questions FOR EACH ROW EXECUTE FUNCTION update_project_questions_updated_at();

CREATE OR REPLACE FUNCTION update_document_comments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_document_comments_updated_at
BEFORE UPDATE ON public.document_comments FOR EACH ROW EXECUTE FUNCTION update_document_comments_updated_at();

-- Member Assigned Sections View
CREATE OR REPLACE VIEW member_assigned_sections AS
SELECT 
  ds.id as section_id,
  ds.document_id,
  ds.title as section_title,
  ds.status,
  ds.deadline,
  ds.assigned_to,
  wd.title as document_title,
  wd.workspace_id,
  w.project_id,
  proj.title as project_title,
  proj.client_id,
  w.lead_id
FROM public.document_sections ds
JOIN public.workspace_documents wd ON ds.document_id = wd.id
JOIN public.workspaces w ON wd.workspace_id = w.id
JOIN public.projects proj ON w.project_id = proj.id
WHERE ds.assigned_to IS NOT NULL;

-- Seed default notification preferences for existing users
INSERT INTO public.user_notification_preferences (user_id)
SELECT id FROM auth.users 
WHERE id NOT IN (SELECT user_id FROM public.user_notification_preferences)
ON CONFLICT (user_id) DO NOTHING;

-- ============================================================
-- MIGRATION 009: COLLABORATIVE PROPOSAL EDITOR
-- ============================================================

-- Workspaces Table
CREATE TABLE IF NOT EXISTS public.workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    lead_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- Workspace Documents Table (Collaborative Editor Content)
-- ============================================================
-- NOTE: This table stores COLLABORATIVE DOCUMENT CONTENT for the TipTap editor.
-- NOT to be confused with 'documents' table which stores file attachments.
-- 
-- workspace_documents = collaborative document content (TipTap editor, sections, etc.)
-- documents = file attachments (PDFs, images, etc.) uploaded to proposals
-- ============================================================
CREATE TABLE IF NOT EXISTS public.workspace_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    content JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by UUID NOT NULL REFERENCES auth.users(id),
    last_edited_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE public.workspace_documents IS 'Stores collaborative document content for the TipTap editor. NOT for file attachments - use documents table for that.';

-- Document Versions Table
CREATE TABLE IF NOT EXISTS public.document_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES public.workspace_documents(id) ON DELETE CASCADE,
    version_number INT NOT NULL,
    content JSONB NOT NULL,
    created_by UUID NOT NULL REFERENCES auth.users(id),
    changes_summary TEXT,
    is_rollback BOOLEAN DEFAULT false,
    rolled_back_from UUID REFERENCES public.document_versions(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(document_id, version_number)
);

-- Document Collaborators Table
CREATE TABLE IF NOT EXISTS public.document_collaborators (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES public.workspace_documents(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('owner', 'editor', 'commenter', 'viewer')),
    added_by UUID NOT NULL REFERENCES auth.users(id),
    added_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(document_id, user_id)
);

-- Collaboration Sessions Table
CREATE TABLE IF NOT EXISTS public.collaboration_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES public.workspace_documents(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    user_color TEXT NOT NULL,
    cursor_position JSONB,
    presence_status TEXT DEFAULT 'active' CHECK (presence_status IN ('active', 'idle', 'away')),
    last_activity TIMESTAMPTZ DEFAULT now(),
    joined_at TIMESTAMPTZ DEFAULT now(),
    current_section TEXT
);

-- Document Invitations Table
CREATE TABLE IF NOT EXISTS public.document_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES public.workspace_documents(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('editor', 'commenter', 'viewer')),
    token UUID DEFAULT gen_random_uuid() UNIQUE,
    invited_by UUID NOT NULL REFERENCES auth.users(id),
    expires_at TIMESTAMPTZ NOT NULL,
    accepted_at TIMESTAMPTZ,
    accepted_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_workspaces_project ON public.workspaces(project_id);
CREATE INDEX IF NOT EXISTS idx_workspaces_lead ON public.workspaces(lead_id);
CREATE INDEX IF NOT EXISTS idx_workspaces_updated ON public.workspaces(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_workspace ON public.workspace_documents(workspace_id);
CREATE INDEX IF NOT EXISTS idx_documents_updated ON public.workspace_documents(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_created_by ON public.workspace_documents(created_by);
CREATE INDEX IF NOT EXISTS idx_documents_title_search ON public.workspace_documents USING gin(to_tsvector('english', title));
CREATE INDEX IF NOT EXISTS idx_documents_content_search ON public.workspace_documents USING gin(to_tsvector('english', content::text));
CREATE INDEX IF NOT EXISTS idx_document_versions_document ON public.document_versions(document_id, version_number DESC);
CREATE INDEX IF NOT EXISTS idx_document_versions_created_by ON public.document_versions(created_by);
CREATE INDEX IF NOT EXISTS idx_document_versions_created_at ON public.document_versions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_document_collaborators_document ON public.document_collaborators(document_id);
CREATE INDEX IF NOT EXISTS idx_document_collaborators_user ON public.document_collaborators(user_id);
CREATE INDEX IF NOT EXISTS idx_document_collaborators_role ON public.document_collaborators(document_id, role);
CREATE INDEX IF NOT EXISTS idx_collaboration_sessions_document ON public.collaboration_sessions(document_id);
CREATE INDEX IF NOT EXISTS idx_collaboration_sessions_user ON public.collaboration_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_collaboration_sessions_active ON public.collaboration_sessions(document_id, last_activity DESC);
CREATE INDEX IF NOT EXISTS idx_collaboration_sessions_presence ON public.collaboration_sessions(document_id, presence_status);
CREATE INDEX IF NOT EXISTS idx_collaboration_sessions_current_section ON public.collaboration_sessions(document_id, current_section) WHERE current_section IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_document_invitations_token ON public.document_invitations(token);
CREATE INDEX IF NOT EXISTS idx_document_invitations_email ON public.document_invitations(email);
CREATE INDEX IF NOT EXISTS idx_document_invitations_document ON public.document_invitations(document_id);
CREATE INDEX IF NOT EXISTS idx_document_invitations_expires ON public.document_invitations(expires_at) WHERE accepted_at IS NULL;

-- Enable RLS
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_collaborators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collaboration_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_invitations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Workspaces
CREATE POLICY "workspaces_owner_select" ON public.workspaces FOR SELECT USING (lead_id = auth.uid());
CREATE POLICY "workspaces_owner_insert" ON public.workspaces FOR INSERT WITH CHECK (lead_id = auth.uid());
CREATE POLICY "workspaces_owner_update" ON public.workspaces FOR UPDATE USING (lead_id = auth.uid()) WITH CHECK (lead_id = auth.uid());
CREATE POLICY "workspaces_owner_delete" ON public.workspaces FOR DELETE USING (lead_id = auth.uid());

-- RLS Policies for Documents
CREATE POLICY "documents_collaborator_select" ON public.workspace_documents
FOR SELECT USING (EXISTS (SELECT 1 FROM public.document_collaborators dc WHERE dc.document_id = workspace_documents.id AND dc.user_id = auth.uid()));

CREATE POLICY "documents_creator_insert" ON public.workspace_documents FOR INSERT WITH CHECK (created_by = auth.uid());

CREATE POLICY "documents_editor_update" ON public.workspace_documents
FOR UPDATE USING (EXISTS (SELECT 1 FROM public.document_collaborators dc WHERE dc.document_id = workspace_documents.id AND dc.user_id = auth.uid() AND dc.role IN ('owner', 'editor')))
WITH CHECK (EXISTS (SELECT 1 FROM public.document_collaborators dc WHERE dc.document_id = workspace_documents.id AND dc.user_id = auth.uid() AND dc.role IN ('owner', 'editor')));

CREATE POLICY "documents_owner_delete" ON public.workspace_documents
FOR DELETE USING (EXISTS (SELECT 1 FROM public.document_collaborators dc WHERE dc.document_id = workspace_documents.id AND dc.user_id = auth.uid() AND dc.role = 'owner'));

-- RLS Policies for Document Versions
CREATE POLICY "document_versions_collaborator_select" ON public.document_versions
FOR SELECT USING (EXISTS (SELECT 1 FROM public.document_collaborators dc WHERE dc.document_id = document_versions.document_id AND dc.user_id = auth.uid()));

CREATE POLICY "document_versions_editor_insert" ON public.document_versions
FOR INSERT WITH CHECK (created_by = auth.uid() AND EXISTS (SELECT 1 FROM public.document_collaborators dc WHERE dc.document_id = document_versions.document_id AND dc.user_id = auth.uid() AND dc.role IN ('owner', 'editor')));

-- RLS Policies for Document Collaborators
CREATE POLICY "document_collaborators_select" ON public.document_collaborators
FOR SELECT USING (EXISTS (SELECT 1 FROM public.document_collaborators dc WHERE dc.document_id = document_collaborators.document_id AND dc.user_id = auth.uid()));

CREATE POLICY "document_collaborators_owner_insert" ON public.document_collaborators
FOR INSERT WITH CHECK (added_by = auth.uid() AND EXISTS (SELECT 1 FROM public.document_collaborators dc WHERE dc.document_id = document_collaborators.document_id AND dc.user_id = auth.uid() AND dc.role = 'owner'));

CREATE POLICY "document_collaborators_owner_update" ON public.document_collaborators
FOR UPDATE USING (EXISTS (SELECT 1 FROM public.document_collaborators dc WHERE dc.document_id = document_collaborators.document_id AND dc.user_id = auth.uid() AND dc.role = 'owner'))
WITH CHECK (EXISTS (SELECT 1 FROM public.document_collaborators dc WHERE dc.document_id = document_collaborators.document_id AND dc.user_id = auth.uid() AND dc.role = 'owner'));

CREATE POLICY "document_collaborators_owner_delete" ON public.document_collaborators
FOR DELETE USING (EXISTS (SELECT 1 FROM public.document_collaborators dc WHERE dc.document_id = document_collaborators.document_id AND dc.user_id = auth.uid() AND dc.role = 'owner'));

-- RLS Policies for Collaboration Sessions
CREATE POLICY "collaboration_sessions_collaborator_select" ON public.collaboration_sessions
FOR SELECT USING (EXISTS (SELECT 1 FROM public.document_collaborators dc WHERE dc.document_id = collaboration_sessions.document_id AND dc.user_id = auth.uid()));

CREATE POLICY "collaboration_sessions_user_insert" ON public.collaboration_sessions
FOR INSERT WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.document_collaborators dc WHERE dc.document_id = collaboration_sessions.document_id AND dc.user_id = auth.uid()));

CREATE POLICY "collaboration_sessions_user_update" ON public.collaboration_sessions
FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "collaboration_sessions_user_delete" ON public.collaboration_sessions
FOR DELETE USING (user_id = auth.uid());

-- RLS Policies for Document Invitations
CREATE POLICY "document_invitations_owner_select" ON public.document_invitations
FOR SELECT USING (EXISTS (SELECT 1 FROM public.document_collaborators dc WHERE dc.document_id = document_invitations.document_id AND dc.user_id = auth.uid() AND dc.role = 'owner'));

CREATE POLICY "document_invitations_token_select" ON public.document_invitations FOR SELECT USING (true);

CREATE POLICY "document_invitations_owner_insert" ON public.document_invitations
FOR INSERT WITH CHECK (invited_by = auth.uid() AND EXISTS (SELECT 1 FROM public.document_collaborators dc WHERE dc.document_id = document_invitations.document_id AND dc.user_id = auth.uid() AND dc.role = 'owner'));

CREATE POLICY "document_invitations_accept_update" ON public.document_invitations
FOR UPDATE USING (accepted_by IS NULL OR accepted_by = auth.uid()) WITH CHECK (accepted_by = auth.uid());

CREATE POLICY "document_invitations_owner_delete" ON public.document_invitations
FOR DELETE USING (EXISTS (SELECT 1 FROM public.document_collaborators dc WHERE dc.document_id = document_invitations.document_id AND dc.user_id = auth.uid() AND dc.role = 'owner'));

-- Helper Functions
CREATE OR REPLACE FUNCTION public.create_document_owner()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.document_collaborators (document_id, user_id, role, added_by)
    VALUES (NEW.id, NEW.created_by, 'owner', NEW.created_by);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_create_document_owner ON public.workspace_documents;
CREATE TRIGGER trigger_create_document_owner AFTER INSERT ON public.workspace_documents FOR EACH ROW EXECUTE FUNCTION public.create_document_owner();

CREATE OR REPLACE FUNCTION public.update_document_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_document_timestamp ON public.workspace_documents;
CREATE TRIGGER trigger_update_document_timestamp BEFORE UPDATE ON public.workspace_documents FOR EACH ROW EXECUTE FUNCTION public.update_document_timestamp();

CREATE OR REPLACE FUNCTION public.update_workspace_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_workspace_timestamp ON public.workspaces;
CREATE TRIGGER trigger_update_workspace_timestamp BEFORE UPDATE ON public.workspaces FOR EACH ROW EXECUTE FUNCTION public.update_workspace_timestamp();

CREATE OR REPLACE FUNCTION public.get_next_version_number(p_document_id UUID)
RETURNS INT AS $$
DECLARE
    v_next_version INT;
BEGIN
    SELECT COALESCE(MAX(version_number), 0) + 1 INTO v_next_version FROM public.document_versions WHERE document_id = p_document_id;
    RETURN v_next_version;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.has_document_permission(p_document_id UUID, p_user_id UUID, p_required_role TEXT DEFAULT 'viewer')
RETURNS BOOLEAN AS $$
DECLARE
    v_user_role TEXT;
    v_role_hierarchy INT;
    v_required_hierarchy INT;
BEGIN
    SELECT role INTO v_user_role FROM public.document_collaborators WHERE document_id = p_document_id AND user_id = p_user_id;
    IF v_user_role IS NULL THEN RETURN FALSE; END IF;
    v_user_role := LOWER(v_user_role);
    p_required_role := LOWER(p_required_role);
    v_role_hierarchy := CASE v_user_role WHEN 'owner' THEN 4 WHEN 'editor' THEN 3 WHEN 'commenter' THEN 2 WHEN 'viewer' THEN 1 ELSE 0 END;
    v_required_hierarchy := CASE p_required_role WHEN 'owner' THEN 4 WHEN 'editor' THEN 3 WHEN 'commenter' THEN 2 WHEN 'viewer' THEN 1 ELSE 0 END;
    RETURN v_role_hierarchy >= v_required_hierarchy;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.cleanup_expired_invitations()
RETURNS void AS $$
BEGIN
    DELETE FROM public.document_invitations WHERE expires_at < now() AND accepted_at IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.cleanup_inactive_sessions()
RETURNS void AS $$
BEGIN
    DELETE FROM public.collaboration_sessions WHERE last_activity < now() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- MIGRATION 010: SECTION-BASED LOCKING AND PROGRESS TRACKING
-- ============================================================

-- Document Sections Table
CREATE TABLE IF NOT EXISTS public.document_sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES public.workspace_documents(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    "order" INT NOT NULL,
    status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'in_review', 'completed')),
    assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    deadline TIMESTAMPTZ,
    content JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT document_sections_order_positive CHECK ("order" >= 0)
);

-- Section Locks Table
CREATE TABLE IF NOT EXISTS public.section_locks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section_id UUID NOT NULL REFERENCES public.document_sections(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES public.workspace_documents(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    acquired_at TIMESTAMPTZ DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    last_heartbeat TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT section_locks_expires_after_acquired CHECK (expires_at > acquired_at)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_document_sections_document ON public.document_sections(document_id);
CREATE INDEX IF NOT EXISTS idx_document_sections_order ON public.document_sections(document_id, "order");
CREATE INDEX IF NOT EXISTS idx_document_sections_status ON public.document_sections(document_id, status);
CREATE INDEX IF NOT EXISTS idx_document_sections_assigned ON public.document_sections(assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_document_sections_deadline ON public.document_sections(deadline) WHERE deadline IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_document_sections_updated ON public.document_sections(updated_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_section_locks_active_section ON public.section_locks(section_id, expires_at);
CREATE INDEX IF NOT EXISTS idx_section_locks_document ON public.section_locks(document_id);
CREATE INDEX IF NOT EXISTS idx_section_locks_user ON public.section_locks(user_id);
CREATE INDEX IF NOT EXISTS idx_section_locks_expires ON public.section_locks(expires_at);
CREATE INDEX IF NOT EXISTS idx_section_locks_heartbeat ON public.section_locks(last_heartbeat);

-- Enable RLS
ALTER TABLE public.document_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.section_locks ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Document Sections
CREATE POLICY "document_sections_collaborator_select" ON public.document_sections
FOR SELECT USING (EXISTS (SELECT 1 FROM public.document_collaborators dc WHERE dc.document_id = document_sections.document_id AND dc.user_id = auth.uid()));

CREATE POLICY "document_sections_editor_insert" ON public.document_sections
FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.document_collaborators dc WHERE dc.document_id = document_sections.document_id AND dc.user_id = auth.uid() AND dc.role IN ('owner', 'editor')));

CREATE POLICY "document_sections_editor_update" ON public.document_sections
FOR UPDATE USING (EXISTS (SELECT 1 FROM public.document_collaborators dc WHERE dc.document_id = document_sections.document_id AND dc.user_id = auth.uid() AND dc.role IN ('owner', 'editor')))
WITH CHECK (EXISTS (SELECT 1 FROM public.document_collaborators dc WHERE dc.document_id = document_sections.document_id AND dc.user_id = auth.uid() AND dc.role IN ('owner', 'editor')));

CREATE POLICY "document_sections_owner_delete" ON public.document_sections
FOR DELETE USING (EXISTS (SELECT 1 FROM public.document_collaborators dc WHERE dc.document_id = document_sections.document_id AND dc.user_id = auth.uid() AND dc.role = 'owner'));

-- RLS Policies for Section Locks
CREATE POLICY "section_locks_collaborator_select" ON public.section_locks
FOR SELECT USING (EXISTS (SELECT 1 FROM public.document_collaborators dc WHERE dc.document_id = section_locks.document_id AND dc.user_id = auth.uid()));

CREATE POLICY "section_locks_collaborator_insert" ON public.section_locks
FOR INSERT WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.document_collaborators dc WHERE dc.document_id = section_locks.document_id AND dc.user_id = auth.uid() AND dc.role IN ('owner', 'editor')));

CREATE POLICY "section_locks_user_update" ON public.section_locks
FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "section_locks_user_delete" ON public.section_locks
FOR DELETE USING (user_id = auth.uid());

-- Helper Functions
CREATE OR REPLACE FUNCTION public.update_section_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_section_timestamp ON public.document_sections;
CREATE TRIGGER trigger_update_section_timestamp BEFORE UPDATE ON public.document_sections FOR EACH ROW EXECUTE FUNCTION public.update_section_timestamp();

CREATE OR REPLACE FUNCTION public.auto_update_section_status()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.content IS DISTINCT FROM OLD.content AND OLD.status = 'not_started' THEN
        NEW.status = 'in_progress';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_auto_update_section_status ON public.document_sections;
CREATE TRIGGER trigger_auto_update_section_status BEFORE UPDATE ON public.document_sections FOR EACH ROW EXECUTE FUNCTION public.auto_update_section_status();

CREATE OR REPLACE FUNCTION public.acquire_section_lock(p_section_id UUID, p_document_id UUID, p_user_id UUID, p_ttl_seconds INT DEFAULT 30)
RETURNS TABLE(success BOOLEAN, lock_id UUID, locked_by UUID, expires_at TIMESTAMPTZ) AS $$
DECLARE
    v_lock_id UUID;
    v_expires_at TIMESTAMPTZ;
    v_existing_lock RECORD;
BEGIN
    DELETE FROM public.section_locks WHERE section_id = p_section_id AND expires_at <= now();
    SELECT id, user_id, expires_at INTO v_existing_lock FROM public.section_locks WHERE section_id = p_section_id AND expires_at > now() LIMIT 1;
    IF v_existing_lock.id IS NOT NULL AND v_existing_lock.user_id != p_user_id THEN
        RETURN QUERY SELECT false, v_existing_lock.id, v_existing_lock.user_id, v_existing_lock.expires_at;
        RETURN;
    END IF;
    IF v_existing_lock.id IS NOT NULL AND v_existing_lock.user_id = p_user_id THEN
        v_expires_at := now() + (p_ttl_seconds || ' seconds')::INTERVAL;
        UPDATE public.section_locks SET expires_at = v_expires_at, last_heartbeat = now() WHERE id = v_existing_lock.id;
        RETURN QUERY SELECT true, v_existing_lock.id, p_user_id, v_expires_at;
        RETURN;
    END IF;
    v_lock_id := gen_random_uuid();
    v_expires_at := now() + (p_ttl_seconds || ' seconds')::INTERVAL;
    INSERT INTO public.section_locks (id, section_id, document_id, user_id, expires_at) VALUES (v_lock_id, p_section_id, p_document_id, p_user_id, v_expires_at);
    RETURN QUERY SELECT true, v_lock_id, p_user_id, v_expires_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.release_section_lock(p_section_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_deleted_count INT;
BEGIN
    DELETE FROM public.section_locks WHERE section_id = p_section_id AND user_id = p_user_id;
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RETURN v_deleted_count > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.update_lock_heartbeat(p_lock_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_updated_count INT;
BEGIN
    UPDATE public.section_locks SET last_heartbeat = now(), expires_at = now() + INTERVAL '30 seconds' WHERE id = p_lock_id AND user_id = p_user_id AND expires_at > now();
    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    RETURN v_updated_count > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_section_lock_status(p_section_id UUID)
RETURNS TABLE(is_locked BOOLEAN, locked_by UUID, locked_at TIMESTAMPTZ, expires_at TIMESTAMPTZ) AS $$
BEGIN
    DELETE FROM public.section_locks WHERE section_id = p_section_id AND expires_at <= now();
    RETURN QUERY SELECT true as is_locked, sl.user_id as locked_by, sl.acquired_at as locked_at, sl.expires_at FROM public.section_locks sl WHERE sl.section_id = p_section_id AND sl.expires_at > now() LIMIT 1;
    IF NOT FOUND THEN
        RETURN QUERY SELECT false, NULL::UUID, NULL::TIMESTAMPTZ, NULL::TIMESTAMPTZ;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.cleanup_expired_locks()
RETURNS INT AS $$
DECLARE
    v_deleted_count INT;
BEGIN
    DELETE FROM public.section_locks WHERE expires_at <= now();
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.release_user_locks(p_user_id UUID)
RETURNS INT AS $$
DECLARE
    v_deleted_count INT;
BEGIN
    DELETE FROM public.section_locks WHERE user_id = p_user_id;
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.calculate_document_progress(p_document_id UUID)
RETURNS TABLE(total_sections INT, not_started INT, in_progress INT, in_review INT, completed INT, completion_percentage NUMERIC) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::INT as total_sections,
        COUNT(*) FILTER (WHERE status = 'not_started')::INT as not_started,
        COUNT(*) FILTER (WHERE status = 'in_progress')::INT as in_progress,
        COUNT(*) FILTER (WHERE status = 'in_review')::INT as in_review,
        COUNT(*) FILTER (WHERE status = 'completed')::INT as completed,
        CASE WHEN COUNT(*) = 0 THEN 0 ELSE ROUND((COUNT(*) FILTER (WHERE status = 'completed')::NUMERIC / COUNT(*)::NUMERIC) * 100, 2) END as completion_percentage
    FROM public.document_sections WHERE document_id = p_document_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_upcoming_deadlines(p_document_id UUID, p_hours_ahead INT DEFAULT 24)
RETURNS TABLE(section_id UUID, title TEXT, deadline TIMESTAMPTZ, assigned_to UUID, status TEXT, is_overdue BOOLEAN, hours_remaining NUMERIC) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ds.id as section_id,
        ds.title,
        ds.deadline,
        ds.assigned_to,
        ds.status,
        (ds.deadline < now()) as is_overdue,
        ROUND(EXTRACT(EPOCH FROM (ds.deadline - now())) / 3600, 2) as hours_remaining
    FROM public.document_sections ds
    WHERE ds.document_id = p_document_id AND ds.deadline IS NOT NULL AND ds.deadline <= now() + (p_hours_ahead || ' hours')::INTERVAL AND ds.status != 'completed'
    ORDER BY ds.deadline ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- HELPER FUNCTION: CHECK USER EXISTS
-- ============================================================

CREATE OR REPLACE FUNCTION check_user_exists(user_email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO user_count FROM auth.users WHERE email = user_email;
  RETURN user_count > 0;
END;
$$;

GRANT EXECUTE ON FUNCTION check_user_exists(TEXT) TO authenticated, anon;

-- ============================================================
-- MIGRATION 015: BIDDING LEADER MANAGEMENT
-- ============================================================

-- Proposal Performance Table
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

-- Notification Queue Table
CREATE TABLE IF NOT EXISTS public.notification_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title TEXT NOT NULL,
    body TEXT,
    data JSONB DEFAULT '{}'::jsonb,
    read BOOLEAN DEFAULT false,
    sent_via_email BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    read_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT now(),
    legal_hold BOOLEAN DEFAULT false,
    CONSTRAINT notification_queue_type_valid CHECK (
        type IN (
            'team_member_joined',
            'section_assigned',
            'section_reassigned',
            'section_completed',
            'deadline_approaching',
            'deadline_missed',
            'message_received',
            'proposal_submitted',
            'proposal_status_changed',
            'qa_answer_posted',
            'document_uploaded',
            'invitation_created',
            'member_removed'
        )
    )
);

-- Indexes for Proposal Performance
CREATE INDEX IF NOT EXISTS idx_proposal_performance_lead ON public.proposal_performance(lead_id);
CREATE INDEX IF NOT EXISTS idx_proposal_performance_proposal ON public.proposal_performance(proposal_id);
CREATE INDEX IF NOT EXISTS idx_proposal_performance_created ON public.proposal_performance(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_proposal_performance_lead_created ON public.proposal_performance(lead_id, created_at DESC);

-- Indexes for Notification Queue
CREATE INDEX IF NOT EXISTS idx_notification_queue_user_id ON public.notification_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_queue_read ON public.notification_queue(user_id, read);
CREATE INDEX IF NOT EXISTS idx_notification_queue_type ON public.notification_queue(type);
CREATE INDEX IF NOT EXISTS idx_notification_queue_created_at ON public.notification_queue(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_queue_user_read_created ON public.notification_queue(user_id, read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_queue_unread ON public.notification_queue(user_id, created_at DESC) WHERE read = false;
CREATE INDEX IF NOT EXISTS idx_notification_queue_legal_hold ON public.notification_queue(legal_hold, created_at) WHERE legal_hold = true;
CREATE INDEX IF NOT EXISTS idx_notification_queue_old_notifications ON public.notification_queue(created_at) WHERE legal_hold = false;
CREATE INDEX IF NOT EXISTS idx_notification_queue_email_pending ON public.notification_queue(sent_via_email, created_at) WHERE sent_via_email = false;

-- Additional indexes for bidding leader features
CREATE INDEX IF NOT EXISTS idx_proposal_team_members_proposal_role ON public.proposal_team_members(proposal_id, role);
CREATE INDEX IF NOT EXISTS idx_proposal_team_members_user_role ON public.proposal_team_members(user_id, role);
CREATE INDEX IF NOT EXISTS idx_proposals_lead_status ON public.proposals(lead_id, status);
CREATE INDEX IF NOT EXISTS idx_proposals_project_status ON public.proposals(project_id, status);
CREATE INDEX IF NOT EXISTS idx_proposals_submitted ON public.proposals(submitted_at DESC) WHERE submitted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_document_sections_assigned_status ON public.document_sections(assigned_to, status) WHERE assigned_to IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_document_sections_deadline_upcoming ON public.document_sections(deadline, status) WHERE deadline IS NOT NULL AND status NOT IN ('completed');

-- Enable RLS
ALTER TABLE public.proposal_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_queue ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Proposal Performance
CREATE POLICY "proposal_performance_lead_select" ON public.proposal_performance
FOR SELECT USING (lead_id = auth.uid());

CREATE POLICY "proposal_performance_system_insert" ON public.proposal_performance
FOR INSERT WITH CHECK (true);

CREATE POLICY "proposal_performance_system_update" ON public.proposal_performance
FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "proposal_performance_admin_select" ON public.proposal_performance
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM auth.users
        WHERE id = auth.uid() 
        AND raw_user_meta_data->>'role' = 'admin'
    )
);

-- RLS Policies for Notification Queue
-- Drop existing policies to ensure clean state
DROP POLICY IF EXISTS "notif_read" ON public.notification_queue;
DROP POLICY IF EXISTS "notif_write" ON public.notification_queue;
DROP POLICY IF EXISTS "notification_queue_user_select" ON public.notification_queue;
DROP POLICY IF EXISTS "notification_queue_system_insert" ON public.notification_queue;
DROP POLICY IF EXISTS "notification_queue_user_update" ON public.notification_queue;
DROP POLICY IF EXISTS "notification_queue_system_update" ON public.notification_queue;
DROP POLICY IF EXISTS "notification_queue_user_delete" ON public.notification_queue;
DROP POLICY IF EXISTS "notification_queue_admin_select" ON public.notification_queue;

-- Users can only view their own notifications
CREATE POLICY "notification_queue_user_select" ON public.notification_queue
FOR SELECT USING (user_id = auth.uid());

-- System can insert notifications (service role)
CREATE POLICY "notification_queue_system_insert" ON public.notification_queue
FOR INSERT WITH CHECK (true);

-- Users can update their own notifications (mark as read, delete)
CREATE POLICY "notification_queue_user_update" ON public.notification_queue
FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Users can delete their own notifications
CREATE POLICY "notification_queue_user_delete" ON public.notification_queue
FOR DELETE USING (user_id = auth.uid());

-- Admins can view all notifications
CREATE POLICY "notification_queue_admin_select" ON public.notification_queue
FOR SELECT USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
);

-- Functions for Proposal Performance
CREATE OR REPLACE FUNCTION public.update_proposal_performance(p_proposal_id UUID)
RETURNS void AS $
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
$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.create_notification(
    p_user_id UUID,
    p_type VARCHAR(50),
    p_title TEXT,
    p_body TEXT DEFAULT NULL,
    p_data JSONB DEFAULT NULL
)
RETURNS UUID AS $
DECLARE
    v_notification_id UUID;
BEGIN
    INSERT INTO public.notification_queue (
        user_id,
        type,
        title,
        body,
        data
    )
    VALUES (
        p_user_id,
        p_type,
        p_title,
        p_body,
        p_data
    )
    RETURNING id INTO v_notification_id;
    
    RETURN v_notification_id;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.mark_notification_read(p_notification_id UUID)
RETURNS void AS $
BEGIN
    UPDATE public.notification_queue
    SET read = true, read_at = NOW()
    WHERE id = p_notification_id AND user_id = auth.uid();
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.mark_all_notifications_read(p_user_id UUID)
RETURNS INTEGER AS $
DECLARE
    v_count INTEGER;
BEGIN
    UPDATE public.notification_queue 
    SET read = true, 
        read_at = now(), 
        updated_at = now()
    WHERE user_id = p_user_id 
    AND read = false;
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_unread_notification_count(p_user_id UUID)
RETURNS INTEGER AS $
BEGIN
    RETURN (
        SELECT COUNT(*)::INTEGER 
        FROM public.notification_queue 
        WHERE user_id = p_user_id AND read = false
    );
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.cleanup_old_notifications(p_days_old INTEGER DEFAULT 90)
RETURNS INTEGER AS $
DECLARE
    v_count INTEGER;
    v_cutoff_date TIMESTAMPTZ;
BEGIN
    v_cutoff_date := now() - (p_days_old || ' days')::INTERVAL;
    
    DELETE FROM public.notification_queue 
    WHERE created_at < v_cutoff_date 
    AND legal_hold = false;
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    
    -- Log the cleanup
    INSERT INTO public.admin_actions (
        admin_id, 
        action_type, 
        reason, 
        new_value
    ) VALUES (
        '00000000-0000-0000-0000-000000000000'::UUID, -- System user
        'NOTIFICATION_CLEANUP',
        'Automated cleanup of old notifications',
        jsonb_build_object(
            'deleted_count', v_count,
            'cutoff_date', v_cutoff_date,
            'days_old', p_days_old
        )
    );
    
    RETURN v_count;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_bid_performance(p_lead_id UUID)
RETURNS JSONB AS $
DECLARE
    v_result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'totalProposals', COUNT(*),
        'submitted', COUNT(*) FILTER (WHERE status IN ('submitted', 'reviewing', 'approved', 'rejected')),
        'accepted', COUNT(*) FILTER (WHERE status = 'approved'),
        'rejected', COUNT(*) FILTER (WHERE status = 'rejected'),
        'winRate', CASE 
            WHEN COUNT(*) FILTER (WHERE status IN ('submitted', 'reviewing', 'approved', 'rejected')) > 0 
            THEN ROUND(
                (COUNT(*) FILTER (WHERE status = 'approved')::NUMERIC / 
                COUNT(*) FILTER (WHERE status IN ('submitted', 'reviewing', 'approved', 'rejected'))::NUMERIC) * 100, 
                2
            )
            ELSE 0
        END,
        'statusBreakdown', jsonb_build_object(
            'draft', COUNT(*) FILTER (WHERE status = 'draft'),
            'submitted', COUNT(*) FILTER (WHERE status = 'submitted'),
            'reviewing', COUNT(*) FILTER (WHERE status = 'reviewing'),
            'approved', COUNT(*) FILTER (WHERE status = 'approved'),
            'rejected', COUNT(*) FILTER (WHERE status = 'rejected')
        ),
        'averageTeamSize', COALESCE(ROUND(AVG(pp.team_size), 1), 0),
        'averageSectionsCount', COALESCE(ROUND(AVG(pp.sections_count), 1), 0),
        'averageTimeToSubmit', COALESCE(
            EXTRACT(EPOCH FROM AVG(pp.time_to_submit))::INT, 
            0
        )
    )
    INTO v_result
    FROM public.proposals p
    LEFT JOIN public.proposal_performance pp ON pp.proposal_id = p.id
    WHERE p.lead_id = p_lead_id;
    
    RETURN v_result;
END;
$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.get_bid_performance(UUID) TO authenticated;

COMMENT ON FUNCTION public.get_bid_performance IS 'Returns comprehensive bid performance metrics for a bidding lead';

-- Triggers for Proposal Performance
CREATE OR REPLACE FUNCTION public.update_proposal_performance_timestamp()
RETURNS TRIGGER AS $
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_proposal_performance_timestamp ON public.proposal_performance;
CREATE TRIGGER trigger_update_proposal_performance_timestamp
    BEFORE UPDATE ON public.proposal_performance
    FOR EACH ROW
    EXECUTE FUNCTION public.update_proposal_performance_timestamp();

-- Function to create default notification preferences for new users
CREATE OR REPLACE FUNCTION public.create_default_notification_preferences()
RETURNS TRIGGER AS $
BEGIN
    INSERT INTO public.user_notification_preferences (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to auto-create notification preferences for new users
DROP TRIGGER IF EXISTS trigger_create_notification_preferences ON auth.users;
CREATE TRIGGER trigger_create_notification_preferences
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.create_default_notification_preferences();

-- Function to update updated_at timestamp for notifications
CREATE OR REPLACE FUNCTION public.update_notification_updated_at()
RETURNS TRIGGER AS $
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$ LANGUAGE plpgsql;

-- Create trigger to auto-update updated_at on notification_queue
DROP TRIGGER IF EXISTS trigger_notification_updated_at ON public.notification_queue;
CREATE TRIGGER trigger_notification_updated_at
    BEFORE UPDATE ON public.notification_queue
    FOR EACH ROW
    EXECUTE FUNCTION public.update_notification_updated_at();

-- Create trigger for user_notification_preferences updated_at
DROP TRIGGER IF EXISTS trigger_user_prefs_updated_at ON public.user_notification_preferences;
CREATE TRIGGER trigger_user_prefs_updated_at
    BEFORE UPDATE ON public.user_notification_preferences
    FOR EACH ROW
    EXECUTE FUNCTION public.update_notification_updated_at();

CREATE OR REPLACE FUNCTION public.auto_update_proposal_performance()
RETURNS TRIGGER AS $
BEGIN
    IF NEW.status != OLD.status AND NEW.status IN ('submitted', 'reviewing', 'approved', 'rejected') THEN
        PERFORM public.update_proposal_performance(NEW.id);
    END IF;
    RETURN NEW;
END;
$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_auto_update_proposal_performance ON public.proposals;
CREATE TRIGGER trigger_auto_update_proposal_performance
    AFTER UPDATE ON public.proposals
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION public.auto_update_proposal_performance();

COMMENT ON TABLE public.proposal_performance IS 'Tracks performance metrics for proposals including team size, sections, and time to submit';
COMMENT ON TABLE public.notification_queue IS 'Stores all notifications for users across the platform. Supports in-app, email, and real-time notifications.';
COMMENT ON COLUMN public.notification_queue.type IS 'Type of notification (e.g., proposal_submitted, team_member_joined). Used for routing and preference checking.';
COMMENT ON COLUMN public.notification_queue.data IS 'Additional data for the notification (e.g., projectId, proposalId). Used for navigation and context.';
COMMENT ON COLUMN public.notification_queue.read IS 'Whether the user has read this notification.';
COMMENT ON COLUMN public.notification_queue.read_at IS 'Timestamp when the notification was marked as read.';
COMMENT ON COLUMN public.notification_queue.sent_via_email IS 'Whether this notification was sent via email.';
COMMENT ON COLUMN public.notification_queue.legal_hold IS 'Whether this notification is under legal hold and should not be deleted by cleanup jobs.';
COMMENT ON COLUMN public.notification_queue.updated_at IS 'Timestamp when the notification was last updated.';
COMMENT ON TABLE public.user_notification_preferences IS 'Stores user preferences for notification delivery. Users can control which types of notifications they receive.';
COMMENT ON COLUMN public.user_notification_preferences.email_notifications IS 'Global toggle for all email notifications. When false, no emails are sent regardless of other settings.';
COMMENT ON COLUMN public.user_notification_preferences.team_notifications IS 'Toggle for team-related notifications (member joined, removed, etc.).';
COMMENT ON COLUMN public.user_notification_preferences.completion_notifications IS 'Toggle for project completion and delivery notifications.';
COMMENT ON COLUMN public.user_notification_preferences.scoring_notifications IS 'Toggle for proposal scoring and ranking notifications.';

-- ============================================================
-- MIGRATION 019: PROPOSAL VERSIONS (ENHANCED)
-- ============================================================

-- Add missing columns to proposal_versions if they don't exist
DO $ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'proposal_versions' 
        AND column_name = 'sections_snapshot'
    ) THEN
        ALTER TABLE public.proposal_versions 
        ADD COLUMN sections_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'proposal_versions' 
        AND column_name = 'documents_snapshot'
    ) THEN
        ALTER TABLE public.proposal_versions 
        ADD COLUMN documents_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'proposal_versions' 
        AND column_name = 'change_summary'
    ) THEN
        ALTER TABLE public.proposal_versions 
        ADD COLUMN change_summary TEXT;
    END IF;
END $;

-- Additional RLS Policies for Proposal Versions
CREATE POLICY IF NOT EXISTS "proposal_versions_team_select" ON public.proposal_versions
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.proposals p
        WHERE p.id = proposal_versions.proposal_id
        AND (
            p.lead_id = auth.uid()
            OR EXISTS (
                SELECT 1 FROM public.bid_team_members btm
                WHERE btm.project_id = p.project_id
                AND btm.user_id = auth.uid()
            )
        )
    )
);

CREATE POLICY IF NOT EXISTS "proposal_versions_team_insert" ON public.proposal_versions
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.proposals p
        WHERE p.id = proposal_versions.proposal_id
        AND (
            p.lead_id = auth.uid()
            OR EXISTS (
                SELECT 1 FROM public.bid_team_members btm
                WHERE btm.project_id = p.project_id
                AND btm.user_id = auth.uid()
            )
        )
    )
);

CREATE POLICY IF NOT EXISTS "proposal_versions_client_select" ON public.proposal_versions
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.proposals p
        JOIN public.projects proj ON proj.id = p.project_id
        WHERE p.id = proposal_versions.proposal_id
        AND proj.client_id = auth.uid()
    )
);

-- Functions for Proposal Versions
CREATE OR REPLACE FUNCTION public.get_latest_version(p_proposal_id UUID)
RETURNS public.proposal_versions AS $
DECLARE
    v_version public.proposal_versions;
BEGIN
    SELECT *
    INTO v_version
    FROM public.proposal_versions
    WHERE proposal_id = p_proposal_id
    ORDER BY version_number DESC
    LIMIT 1;
    
    RETURN v_version;
END;
$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_version_count(p_proposal_id UUID)
RETURNS INT AS $
DECLARE
    v_count INT;
BEGIN
    SELECT COUNT(*)
    INTO v_count
    FROM public.proposal_versions
    WHERE proposal_id = p_proposal_id;
    
    RETURN v_count;
END;
$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ============================================================
-- MIGRATION 020: ADD ARCHIVED STATUS
-- ============================================================

-- Add 'archived' to the proposal_status enum
DO $
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'archived' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'proposal_status')
    ) THEN
        ALTER TYPE proposal_status ADD VALUE 'archived';
    END IF;
END $;

-- Ensure archived columns exist
DO $
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'proposals' 
        AND column_name = 'archived_at'
    ) THEN
        ALTER TABLE public.proposals ADD COLUMN archived_at TIMESTAMPTZ;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'proposals' 
        AND column_name = 'archived_by'
    ) THEN
        ALTER TABLE public.proposals ADD COLUMN archived_by UUID REFERENCES auth.users(id);
    END IF;
END $;

-- ============================================================
-- MIGRATION 021: PROPOSAL WORKSPACE STATES
-- ============================================================

-- Create proposal_workspace_states table
CREATE TABLE IF NOT EXISTS public.proposal_workspace_states (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proposal_id UUID NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    state JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (proposal_id, user_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_workspace_states_proposal ON public.proposal_workspace_states(proposal_id);
CREATE INDEX IF NOT EXISTS idx_workspace_states_user ON public.proposal_workspace_states(user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_states_updated ON public.proposal_workspace_states(updated_at DESC);

-- Enable RLS
ALTER TABLE public.proposal_workspace_states ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "workspace_states_user_select" ON public.proposal_workspace_states
FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "workspace_states_user_insert" ON public.proposal_workspace_states
FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "workspace_states_user_update" ON public.proposal_workspace_states
FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "workspace_states_user_delete" ON public.proposal_workspace_states
FOR DELETE USING (user_id = auth.uid());

COMMENT ON TABLE public.proposal_workspace_states IS 'Stores workspace state for each user-proposal combination to preserve UI state when switching between proposals';
COMMENT ON COLUMN public.proposal_workspace_states.state IS 'JSONB object containing workspace state (scroll position, open panels, filters, etc.)';

-- ============================================================
-- MIGRATION 022: PROJECT DELIVERY AND ARCHIVAL SYSTEM
-- ============================================================

-- Add new project statuses for completion workflow
DO $
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'pending_completion' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'project_status')
    ) THEN
        ALTER TYPE project_status ADD VALUE 'pending_completion';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'completed' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'project_status')
    ) THEN
        ALTER TYPE project_status ADD VALUE 'completed';
    END IF;
END $;

-- Project Deliverables Table
CREATE TABLE IF NOT EXISTS public.project_deliverables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    proposal_id UUID NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
    uploaded_by UUID NOT NULL REFERENCES auth.users(id),
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    description TEXT,
    version INT NOT NULL DEFAULT 1,
    is_final BOOLEAN DEFAULT false,
    uploaded_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT deliverables_file_size_check CHECK (file_size > 0 AND file_size <= 104857600)
);

CREATE INDEX IF NOT EXISTS idx_deliverables_project ON public.project_deliverables(project_id);
CREATE INDEX IF NOT EXISTS idx_deliverables_proposal ON public.project_deliverables(proposal_id);
CREATE INDEX IF NOT EXISTS idx_deliverables_uploaded_by ON public.project_deliverables(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_deliverables_uploaded_at ON public.project_deliverables(uploaded_at DESC);

COMMENT ON TABLE public.project_deliverables IS 'Stores final deliverables uploaded by bidding teams upon project completion';

-- Project Completions Table
CREATE TABLE IF NOT EXISTS public.project_completions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE UNIQUE,
    proposal_id UUID NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
    submitted_by UUID NOT NULL REFERENCES auth.users(id),
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    reviewed_by UUID REFERENCES auth.users(id),
    reviewed_at TIMESTAMPTZ,
    review_status TEXT NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending', 'accepted', 'revision_requested')),
    review_comments TEXT,
    revision_count INT DEFAULT 0,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_completions_project ON public.project_completions(project_id);
CREATE INDEX IF NOT EXISTS idx_completions_proposal ON public.project_completions(proposal_id);
CREATE INDEX IF NOT EXISTS idx_completions_status ON public.project_completions(review_status);
CREATE INDEX IF NOT EXISTS idx_completions_submitted_at ON public.project_completions(submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_completions_completed_at ON public.project_completions(completed_at DESC) WHERE completed_at IS NOT NULL;

-- Project Archives Table
CREATE TABLE IF NOT EXISTS public.project_archives (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE UNIQUE,
    archive_identifier TEXT NOT NULL UNIQUE,
    archive_data JSONB NOT NULL,
    compressed_size BIGINT NOT NULL,
    original_size BIGINT NOT NULL,
    compression_ratio NUMERIC(5,2),
    archived_by UUID NOT NULL REFERENCES auth.users(id),
    archived_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    retention_until TIMESTAMPTZ,
    legal_hold BOOLEAN DEFAULT false,
    legal_hold_reason TEXT,
    access_count INT DEFAULT 0,
    last_accessed_at TIMESTAMPTZ,
    marked_for_deletion_at TIMESTAMPTZ,
    scheduled_deletion_at TIMESTAMPTZ,
    legal_hold_applied_by UUID REFERENCES auth.users(id),
    legal_hold_applied_at TIMESTAMPTZ,
    legal_hold_removed_by UUID REFERENCES auth.users(id),
    legal_hold_removed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_archives_project ON public.project_archives(project_id);
CREATE INDEX IF NOT EXISTS idx_archives_identifier ON public.project_archives(archive_identifier);
CREATE INDEX IF NOT EXISTS idx_archives_archived_at ON public.project_archives(archived_at DESC);
CREATE INDEX IF NOT EXISTS idx_archives_retention ON public.project_archives(retention_until) WHERE retention_until IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_archives_legal_hold ON public.project_archives(legal_hold) WHERE legal_hold = true;
CREATE INDEX IF NOT EXISTS idx_archives_marked_for_deletion ON public.project_archives(marked_for_deletion_at) WHERE marked_for_deletion_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_archives_scheduled_deletion ON public.project_archives(scheduled_deletion_at) WHERE scheduled_deletion_at IS NOT NULL;

-- Completion Revisions Table
CREATE TABLE IF NOT EXISTS public.completion_revisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    completion_id UUID NOT NULL REFERENCES public.project_completions(id) ON DELETE CASCADE,
    revision_number INT NOT NULL,
    requested_by UUID NOT NULL REFERENCES auth.users(id),
    requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    revision_notes TEXT NOT NULL,
    resolved_by UUID REFERENCES auth.users(id),
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(completion_id, revision_number)
);

CREATE INDEX IF NOT EXISTS idx_revisions_completion ON public.completion_revisions(completion_id);
CREATE INDEX IF NOT EXISTS idx_revisions_requested_at ON public.completion_revisions(requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_revisions_requested_by ON public.completion_revisions(requested_by);

-- Project Exports Table
CREATE TABLE IF NOT EXISTS public.project_exports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    requested_by UUID NOT NULL REFERENCES auth.users(id),
    requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    export_path TEXT,
    export_size BIGINT,
    expires_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_exports_project ON public.project_exports(project_id);
CREATE INDEX IF NOT EXISTS idx_exports_requested_by ON public.project_exports(requested_by);
CREATE INDEX IF NOT EXISTS idx_exports_status ON public.project_exports(status);
CREATE INDEX IF NOT EXISTS idx_exports_expires ON public.project_exports(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_exports_requested_at ON public.project_exports(requested_at DESC);

-- Archive Deletion Logs Table
CREATE TABLE IF NOT EXISTS public.archive_deletion_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    archive_id UUID NOT NULL,
    project_id UUID NOT NULL,
    archive_identifier TEXT NOT NULL,
    deleted_by UUID NOT NULL REFERENCES auth.users(id),
    deleted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deletion_logs_archive ON public.archive_deletion_logs(archive_id);
CREATE INDEX IF NOT EXISTS idx_deletion_logs_project ON public.archive_deletion_logs(project_id);
CREATE INDEX IF NOT EXISTS idx_deletion_logs_deleted_by ON public.archive_deletion_logs(deleted_by);
CREATE INDEX IF NOT EXISTS idx_deletion_logs_deleted_at ON public.archive_deletion_logs(deleted_at DESC);

-- Legal Hold Logs Table
CREATE TABLE IF NOT EXISTS public.legal_hold_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    archive_id UUID NOT NULL REFERENCES public.project_archives(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    action TEXT NOT NULL CHECK (action IN ('applied', 'removed')),
    reason TEXT NOT NULL,
    performed_by UUID NOT NULL REFERENCES auth.users(id),
    performed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legal_hold_logs_archive ON public.legal_hold_logs(archive_id);
CREATE INDEX IF NOT EXISTS idx_legal_hold_logs_project ON public.legal_hold_logs(project_id);
CREATE INDEX IF NOT EXISTS idx_legal_hold_logs_performed_by ON public.legal_hold_logs(performed_by);
CREATE INDEX IF NOT EXISTS idx_legal_hold_logs_performed_at ON public.legal_hold_logs(performed_at DESC);
CREATE INDEX IF NOT EXISTS idx_legal_hold_logs_action ON public.legal_hold_logs(action);

-- Enable RLS
ALTER TABLE public.project_deliverables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_archives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.completion_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_exports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.archive_deletion_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legal_hold_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Deliverables
CREATE POLICY "deliverables_team_client_select" ON public.project_deliverables
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_deliverables.project_id
    AND (
      p.client_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.bid_team_members btm
        WHERE btm.project_id = p.id AND btm.user_id = auth.uid()
      )
    )
  )
);

CREATE POLICY "deliverables_team_insert" ON public.project_deliverables
FOR INSERT WITH CHECK (
  uploaded_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.bid_team_members btm
    WHERE btm.project_id = project_deliverables.project_id AND btm.user_id = auth.uid()
  )
);

CREATE POLICY "deliverables_team_delete" ON public.project_deliverables
FOR DELETE USING (
  uploaded_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_deliverables.project_id AND p.status = 'awarded'
  )
);

-- RLS Policies for Completions
CREATE POLICY "completions_team_client_select" ON public.project_completions
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_completions.project_id
    AND (
      p.client_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.bid_team_members btm
        WHERE btm.project_id = p.id AND btm.user_id = auth.uid()
      )
    )
  )
);

CREATE POLICY "completions_lead_insert" ON public.project_completions
FOR INSERT WITH CHECK (
  submitted_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.bid_team_members btm
    WHERE btm.project_id = project_completions.project_id
    AND btm.user_id = auth.uid() AND btm.role = 'lead'
  )
);

CREATE POLICY "completions_client_update" ON public.project_completions
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_completions.project_id AND p.client_id = auth.uid()
  )
);

-- RLS Policies for Archives
CREATE POLICY "archives_participants_select" ON public.project_archives
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_archives.project_id
    AND (
      p.client_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.bid_team_members btm
        WHERE btm.project_id = p.id AND btm.user_id = auth.uid()
      )
    )
  )
);

CREATE POLICY "archives_system_insert" ON public.project_archives FOR INSERT WITH CHECK (true);
CREATE POLICY "archives_system_update" ON public.project_archives FOR UPDATE USING (true);

-- RLS Policies for Revisions
CREATE POLICY "revisions_team_client_select" ON public.completion_revisions
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.project_completions pc
    JOIN public.projects p ON p.id = pc.project_id
    WHERE pc.id = completion_revisions.completion_id
    AND (
      p.client_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.bid_team_members btm
        WHERE btm.project_id = p.id AND btm.user_id = auth.uid()
      )
    )
  )
);

CREATE POLICY "revisions_client_insert" ON public.completion_revisions
FOR INSERT WITH CHECK (
  requested_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.project_completions pc
    JOIN public.projects p ON p.id = pc.project_id
    WHERE pc.id = completion_revisions.completion_id AND p.client_id = auth.uid()
  )
);

-- RLS Policies for Exports
CREATE POLICY "exports_user_select" ON public.project_exports FOR SELECT USING (requested_by = auth.uid());
CREATE POLICY "exports_user_insert" ON public.project_exports
FOR INSERT WITH CHECK (
  requested_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_exports.project_id
    AND (
      p.client_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.bid_team_members btm
        WHERE btm.project_id = p.id AND btm.user_id = auth.uid()
      )
    )
  )
);

CREATE POLICY "exports_system_update" ON public.project_exports FOR UPDATE USING (true);

-- RLS Policies for Logs (Admin only)
CREATE POLICY "deletion_logs_admin_select" ON public.archive_deletion_logs
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid() AND raw_user_meta_data->>'role' = 'admin'
  )
);

CREATE POLICY "deletion_logs_system_insert" ON public.archive_deletion_logs FOR INSERT WITH CHECK (true);

CREATE POLICY "legal_hold_logs_admin_select" ON public.legal_hold_logs
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid() AND raw_user_meta_data->>'role' = 'admin'
  )
);

CREATE POLICY "legal_hold_logs_system_insert" ON public.legal_hold_logs FOR INSERT WITH CHECK (true);

-- Helper Functions
CREATE OR REPLACE FUNCTION public.generate_archive_identifier()
RETURNS TEXT AS $
DECLARE
  v_identifier TEXT;
  v_exists BOOLEAN;
BEGIN
  LOOP
    v_identifier := 'ARCH-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6));
    SELECT EXISTS(SELECT 1 FROM public.project_archives WHERE archive_identifier = v_identifier) INTO v_exists;
    EXIT WHEN NOT v_exists;
  END LOOP;
  RETURN v_identifier;
END;
$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.increment_archive_access(p_archive_id UUID)
RETURNS VOID AS $
BEGIN
  UPDATE public.project_archives
  SET access_count = access_count + 1, last_accessed_at = NOW()
  WHERE id = p_archive_id;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_completion_statistics(
  p_client_id UUID DEFAULT NULL,
  p_date_from TIMESTAMPTZ DEFAULT NULL,
  p_date_to TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB AS $
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'totalCompleted', COUNT(*),
    'averageTimeToCompletion', COALESCE(EXTRACT(EPOCH FROM AVG(pc.completed_at - pc.submitted_at))::INT, 0),
    'projectsRequiringRevisions', COUNT(*) FILTER (WHERE pc.revision_count > 0),
    'totalDeliverablesReceived', (
      SELECT COUNT(*) FROM public.project_deliverables pd
      JOIN public.projects p ON p.id = pd.project_id
      WHERE (p_client_id IS NULL OR p.client_id = p_client_id)
      AND (p_date_from IS NULL OR pd.uploaded_at >= p_date_from)
      AND (p_date_to IS NULL OR pd.uploaded_at <= p_date_to)
    )
  ) INTO v_result
  FROM public.project_completions pc
  JOIN public.projects p ON p.id = pc.project_id
  WHERE pc.completed_at IS NOT NULL
  AND (p_client_id IS NULL OR p.client_id = p_client_id)
  AND (p_date_from IS NULL OR pc.completed_at >= p_date_from)
  AND (p_date_to IS NULL OR pc.completed_at <= p_date_to);
  RETURN v_result;
END;
$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.generate_archive_identifier() TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_archive_access(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_completion_statistics(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

-- ============================================================
-- MIGRATION 023: FIX RLS INFINITE RECURSION
-- ============================================================

-- Create SECURITY DEFINER helper functions to avoid RLS recursion
CREATE OR REPLACE FUNCTION public.is_proposal_lead(p_proposal_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.proposals 
        WHERE id = p_proposal_id AND lead_id = p_user_id
    );
END;
$;

CREATE OR REPLACE FUNCTION public.is_user_admin(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM auth.users 
        WHERE id = p_user_id AND raw_user_meta_data->>'role' = 'admin'
    );
END;
$;

CREATE OR REPLACE FUNCTION public.is_document_owner(p_document_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.workspace_documents 
        WHERE id = p_document_id AND created_by = p_user_id
    );
END;
$;

CREATE OR REPLACE FUNCTION public.has_document_role(p_document_id UUID, p_user_id UUID, p_min_role TEXT DEFAULT 'viewer')
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $
DECLARE
    v_user_role TEXT;
    v_role_level INT;
    v_min_level INT;
BEGIN
    SELECT role INTO v_user_role
    FROM public.document_collaborators
    WHERE document_id = p_document_id AND user_id = p_user_id
    LIMIT 1;
    
    IF v_user_role IS NULL THEN
        RETURN FALSE;
    END IF;
    
    v_role_level := CASE v_user_role
        WHEN 'owner' THEN 4
        WHEN 'editor' THEN 3
        WHEN 'commenter' THEN 2
        WHEN 'viewer' THEN 1
        ELSE 0
    END;
    
    v_min_level := CASE p_min_role
        WHEN 'owner' THEN 4
        WHEN 'editor' THEN 3
        WHEN 'commenter' THEN 2
        WHEN 'viewer' THEN 1
        ELSE 0
    END;
    
    RETURN v_role_level >= v_min_level;
END;
$;

GRANT EXECUTE ON FUNCTION public.is_proposal_lead(UUID, UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_user_admin(UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_document_owner(UUID, UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.has_document_role(UUID, UUID, TEXT) TO authenticated, anon;

-- Fix proposal_team_members policies
DO $ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'proposal_team_members' AND schemaname = 'public')
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON public.proposal_team_members';
    END LOOP;
END $;

CREATE POLICY "ptm_view_own" ON public.proposal_team_members
FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "ptm_lead_view" ON public.proposal_team_members
FOR SELECT USING (public.is_proposal_lead(proposal_id, auth.uid()));

CREATE POLICY "ptm_lead_insert" ON public.proposal_team_members
FOR INSERT WITH CHECK (public.is_proposal_lead(proposal_id, auth.uid()));

CREATE POLICY "ptm_lead_update" ON public.proposal_team_members
FOR UPDATE USING (public.is_proposal_lead(proposal_id, auth.uid()));

CREATE POLICY "ptm_lead_delete" ON public.proposal_team_members
FOR DELETE USING (public.is_proposal_lead(proposal_id, auth.uid()));

CREATE POLICY "ptm_admin_all" ON public.proposal_team_members
FOR ALL USING (public.is_user_admin(auth.uid()));

-- Fix document_collaborators policies
DO $ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'document_collaborators' AND schemaname = 'public')
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON public.document_collaborators';
    END LOOP;
END $;

CREATE POLICY "dc_view_own" ON public.document_collaborators
FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "dc_doc_owner_view" ON public.document_collaborators
FOR SELECT USING (public.is_document_owner(document_id, auth.uid()));

CREATE POLICY "dc_owner_insert" ON public.document_collaborators
FOR INSERT WITH CHECK (
    added_by = auth.uid() 
    AND public.has_document_role(document_id, auth.uid(), 'owner')
);

CREATE POLICY "dc_owner_update" ON public.document_collaborators
FOR UPDATE USING (public.has_document_role(document_id, auth.uid(), 'owner'))
WITH CHECK (public.has_document_role(document_id, auth.uid(), 'owner'));

CREATE POLICY "dc_owner_delete" ON public.document_collaborators
FOR DELETE USING (public.has_document_role(document_id, auth.uid(), 'owner'));

CREATE POLICY "dc_admin_all" ON public.document_collaborators
FOR ALL USING (public.is_user_admin(auth.uid()));

-- ============================================================
-- MIGRATION 024: ERROR HANDLING AND LOGGING
-- ============================================================

-- Error Logs Table
CREATE TABLE IF NOT EXISTS public.error_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    error_code TEXT NOT NULL,
    error_category TEXT NOT NULL,
    error_message TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    operation TEXT NOT NULL,
    details JSONB,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
    retryable BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_error_logs_error_code ON public.error_logs(error_code);
CREATE INDEX IF NOT EXISTS idx_error_logs_error_category ON public.error_logs(error_category);
CREATE INDEX IF NOT EXISTS idx_error_logs_user_id ON public.error_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_error_logs_project_id ON public.error_logs(project_id);
CREATE INDEX IF NOT EXISTS idx_error_logs_operation ON public.error_logs(operation);
CREATE INDEX IF NOT EXISTS idx_error_logs_timestamp ON public.error_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_retryable ON public.error_logs(retryable) WHERE retryable = true;

-- Operation Logs Table
CREATE TABLE IF NOT EXISTS public.operation_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    level TEXT NOT NULL CHECK (level IN ('DEBUG', 'INFO', 'WARN', 'ERROR')),
    operation TEXT NOT NULL,
    message TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    deliverable_id UUID REFERENCES public.project_deliverables(id) ON DELETE SET NULL,
    archive_id UUID REFERENCES public.project_archives(id) ON DELETE SET NULL,
    export_id UUID REFERENCES public.project_exports(id) ON DELETE SET NULL,
    completion_id UUID REFERENCES public.project_completions(id) ON DELETE SET NULL,
    metadata JSONB,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
    duration_ms INTEGER,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_operation_logs_level ON public.operation_logs(level);
CREATE INDEX IF NOT EXISTS idx_operation_logs_operation ON public.operation_logs(operation);
CREATE INDEX IF NOT EXISTS idx_operation_logs_user_id ON public.operation_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_operation_logs_project_id ON public.operation_logs(project_id);
CREATE INDEX IF NOT EXISTS idx_operation_logs_timestamp ON public.operation_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_operation_logs_deliverable_id ON public.operation_logs(deliverable_id);
CREATE INDEX IF NOT EXISTS idx_operation_logs_archive_id ON public.operation_logs(archive_id);
CREATE INDEX IF NOT EXISTS idx_operation_logs_export_id ON public.operation_logs(export_id);

-- Enable RLS
ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operation_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies (Admin only)
CREATE POLICY "error_logs_admin_select" ON public.error_logs
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM auth.users
        WHERE id = auth.uid() AND raw_user_meta_data->>'role' = 'admin'
    )
);

CREATE POLICY "operation_logs_admin_select" ON public.operation_logs
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM auth.users
        WHERE id = auth.uid() AND raw_user_meta_data->>'role' = 'admin'
    )
);

CREATE POLICY "error_logs_service_insert" ON public.error_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "operation_logs_service_insert" ON public.operation_logs FOR INSERT WITH CHECK (true);

-- Cleanup function for old logs
CREATE OR REPLACE FUNCTION public.cleanup_old_logs(days_to_keep INTEGER DEFAULT 90)
RETURNS TABLE (
    error_logs_deleted BIGINT,
    operation_logs_deleted BIGINT
) AS $
DECLARE
    cutoff_date TIMESTAMPTZ;
    error_count BIGINT;
    operation_count BIGINT;
BEGIN
    cutoff_date := now() - (days_to_keep || ' days')::INTERVAL;
    
    DELETE FROM public.error_logs WHERE timestamp < cutoff_date;
    GET DIAGNOSTICS error_count = ROW_COUNT;
    
    DELETE FROM public.operation_logs WHERE timestamp < cutoff_date AND level != 'ERROR';
    GET DIAGNOSTICS operation_count = ROW_COUNT;
    
    RETURN QUERY SELECT error_count, operation_count;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.cleanup_old_logs TO authenticated;

COMMENT ON TABLE public.error_logs IS 'Stores error events for debugging and monitoring';
COMMENT ON TABLE public.operation_logs IS 'Stores structured logs for all operations';
COMMENT ON FUNCTION public.cleanup_old_logs IS 'Removes logs older than specified days (default 90)';

-- ============================================================
-- END OF CONSOLIDATED SCHEMA
-- ============================================================

-- ============================================================
-- MIGRATION 012: PROPOSAL SCORING SYSTEM
-- ============================================================

-- Scoring Templates Table
CREATE TABLE IF NOT EXISTS public.scoring_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    is_default BOOLEAN DEFAULT false,
    created_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT scoring_templates_project_unique UNIQUE(project_id)
);

-- Scoring Criteria Table
CREATE TABLE IF NOT EXISTS public.scoring_criteria (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES public.scoring_templates(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    weight NUMERIC(5,2) NOT NULL CHECK (weight >= 0 AND weight <= 100),
    order_index INT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT scoring_criteria_order_positive CHECK (order_index >= 0),
    CONSTRAINT scoring_criteria_template_order_unique UNIQUE(template_id, order_index)
);

-- Proposal Scores Table
CREATE TABLE IF NOT EXISTS public.proposal_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proposal_id UUID NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
    criterion_id UUID NOT NULL REFERENCES public.scoring_criteria(id) ON DELETE CASCADE,
    raw_score NUMERIC(4,2) NOT NULL CHECK (raw_score >= 1 AND raw_score <= 10),
    weighted_score NUMERIC(6,2) NOT NULL,
    notes TEXT,
    scored_by UUID NOT NULL REFERENCES auth.users(id),
    scored_at TIMESTAMPTZ DEFAULT now(),
    is_final BOOLEAN DEFAULT false,
    CONSTRAINT proposal_scores_unique_final UNIQUE(proposal_id, criterion_id, is_final) 
        DEFERRABLE INITIALLY DEFERRED
);

-- Proposal Score History Table
CREATE TABLE IF NOT EXISTS public.proposal_score_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proposal_id UUID NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
    criterion_id UUID NOT NULL REFERENCES public.scoring_criteria(id) ON DELETE CASCADE,
    previous_raw_score NUMERIC(4,2),
    new_raw_score NUMERIC(4,2) NOT NULL,
    previous_notes TEXT,
    new_notes TEXT,
    changed_by UUID NOT NULL REFERENCES auth.users(id),
    changed_at TIMESTAMPTZ DEFAULT now(),
    reason TEXT
);

-- Proposal Rankings Table
CREATE TABLE IF NOT EXISTS public.proposal_rankings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    proposal_id UUID NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
    total_score NUMERIC(6,2) NOT NULL,
    rank INT NOT NULL,
    is_fully_scored BOOLEAN DEFAULT false,
    calculated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT proposal_rankings_project_proposal_unique UNIQUE(project_id, proposal_id)
);

-- Indexes for Scoring System
CREATE INDEX IF NOT EXISTS idx_scoring_templates_project_id ON public.scoring_templates(project_id);
CREATE INDEX IF NOT EXISTS idx_scoring_templates_created_by ON public.scoring_templates(created_by);
CREATE INDEX IF NOT EXISTS idx_scoring_criteria_template_id ON public.scoring_criteria(template_id);
CREATE INDEX IF NOT EXISTS idx_scoring_criteria_template_order ON public.scoring_criteria(template_id, order_index);
CREATE INDEX IF NOT EXISTS idx_proposal_scores_proposal_id ON public.proposal_scores(proposal_id);
CREATE INDEX IF NOT EXISTS idx_proposal_scores_criterion_id ON public.proposal_scores(criterion_id);
CREATE INDEX IF NOT EXISTS idx_proposal_scores_proposal_final ON public.proposal_scores(proposal_id, is_final);
CREATE INDEX IF NOT EXISTS idx_proposal_scores_scored_by ON public.proposal_scores(scored_by);
CREATE INDEX IF NOT EXISTS idx_proposal_score_history_proposal_id ON public.proposal_score_history(proposal_id);
CREATE INDEX IF NOT EXISTS idx_proposal_score_history_criterion_id ON public.proposal_score_history(criterion_id);
CREATE INDEX IF NOT EXISTS idx_proposal_score_history_changed_at ON public.proposal_score_history(changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_proposal_rankings_project_id ON public.proposal_rankings(project_id);
CREATE INDEX IF NOT EXISTS idx_proposal_rankings_proposal_id ON public.proposal_rankings(proposal_id);
CREATE INDEX IF NOT EXISTS idx_proposal_rankings_project_score ON public.proposal_rankings(project_id, total_score DESC);
CREATE INDEX IF NOT EXISTS idx_proposal_rankings_project_rank ON public.proposal_rankings(project_id, rank);

-- Enable RLS
ALTER TABLE public.scoring_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scoring_criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_score_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_rankings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Scoring Templates
CREATE POLICY "clients_manage_own_templates" ON public.scoring_templates
FOR ALL USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = scoring_templates.project_id AND p.client_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = scoring_templates.project_id AND p.client_id = auth.uid()));

-- RLS Policies for Scoring Criteria
CREATE POLICY "clients_manage_own_criteria" ON public.scoring_criteria
FOR ALL USING (EXISTS (SELECT 1 FROM public.scoring_templates st JOIN public.projects p ON p.id = st.project_id WHERE st.id = scoring_criteria.template_id AND p.client_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.scoring_templates st JOIN public.projects p ON p.id = st.project_id WHERE st.id = scoring_criteria.template_id AND p.client_id = auth.uid()));

-- RLS Policies for Proposal Scores
CREATE POLICY "clients_score_own_projects" ON public.proposal_scores
FOR ALL USING (EXISTS (SELECT 1 FROM public.proposals pr JOIN public.projects p ON pr.project_id = p.id WHERE pr.id = proposal_scores.proposal_id AND p.client_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.proposals pr JOIN public.projects p ON pr.project_id = p.id WHERE pr.id = proposal_scores.proposal_id AND p.client_id = auth.uid()));

CREATE POLICY "leads_view_own_scores" ON public.proposal_scores
FOR SELECT USING (EXISTS (SELECT 1 FROM public.proposals pr WHERE pr.id = proposal_scores.proposal_id AND pr.lead_id = auth.uid()));

-- RLS Policies for Proposal Score History
CREATE POLICY "clients_view_own_history" ON public.proposal_score_history
FOR SELECT USING (EXISTS (SELECT 1 FROM public.proposals pr JOIN public.projects p ON pr.project_id = p.id WHERE pr.id = proposal_score_history.proposal_id AND p.client_id = auth.uid()));

CREATE POLICY "system_insert_history" ON public.proposal_score_history
FOR INSERT WITH CHECK (true);

-- RLS Policies for Proposal Rankings
CREATE POLICY "clients_view_own_rankings" ON public.proposal_rankings
FOR SELECT USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = proposal_rankings.project_id AND p.client_id = auth.uid()));

CREATE POLICY "leads_view_own_ranking" ON public.proposal_rankings
FOR SELECT USING (EXISTS (SELECT 1 FROM public.proposals pr WHERE pr.id = proposal_rankings.proposal_id AND pr.lead_id = auth.uid()));

CREATE POLICY "system_manage_rankings" ON public.proposal_rankings
FOR ALL USING (true) WITH CHECK (true);

-- Functions for Scoring System
CREATE OR REPLACE FUNCTION public.calculate_proposal_total_score(p_proposal_id UUID)
RETURNS NUMERIC(6,2) AS $
DECLARE
  v_total NUMERIC(6,2);
BEGIN
  SELECT COALESCE(SUM(weighted_score), 0) INTO v_total FROM public.proposal_scores WHERE proposal_id = p_proposal_id AND is_final = true;
  RETURN ROUND(v_total, 2);
END;
$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION public.recalculate_project_rankings(p_project_id UUID)
RETURNS void AS $
BEGIN
  DELETE FROM public.proposal_rankings WHERE project_id = p_project_id;
  INSERT INTO public.proposal_rankings (project_id, proposal_id, total_score, rank, is_fully_scored, calculated_at)
  SELECT p_project_id, p.id, public.calculate_proposal_total_score(p.id) as total_score,
    ROW_NUMBER() OVER (ORDER BY public.calculate_proposal_total_score(p.id) DESC, p.created_at ASC) as rank,
    (SELECT CASE WHEN COUNT(sc.id) = 0 THEN false ELSE COUNT(sc.id) = COUNT(ps.id) FILTER (WHERE ps.is_final = true) END
     FROM public.scoring_templates st LEFT JOIN public.scoring_criteria sc ON sc.template_id = st.id
     LEFT JOIN public.proposal_scores ps ON ps.criterion_id = sc.id AND ps.proposal_id = p.id WHERE st.project_id = p_project_id) as is_fully_scored,
    NOW()
  FROM public.proposals p WHERE p.project_id = p_project_id ORDER BY total_score DESC, p.created_at ASC;
END;
$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.is_proposal_scoring_locked(p_proposal_id UUID)
RETURNS BOOLEAN AS $
DECLARE
  v_status TEXT;
BEGIN
  SELECT status INTO v_status FROM public.proposals WHERE id = p_proposal_id;
  RETURN v_status IN ('approved', 'rejected', 'accepted');
END;
$ LANGUAGE plpgsql STABLE;

-- Calculate average scoring duration for analytics
CREATE OR REPLACE FUNCTION public.calculate_average_scoring_duration(
    p_date_from TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
    p_date_to TIMESTAMPTZ DEFAULT NOW()
)
RETURNS NUMERIC AS $
DECLARE
    v_avg_duration NUMERIC;
BEGIN
    SELECT COALESCE(AVG(duration_hours), 0)
    INTO v_avg_duration
    FROM (
        SELECT 
            proposal_id,
            EXTRACT(EPOCH FROM (MAX(scored_at) - MIN(scored_at))) / 3600 as duration_hours
        FROM public.proposal_scores
        WHERE scored_at BETWEEN p_date_from AND p_date_to
        GROUP BY proposal_id
        HAVING COUNT(*) > 1
    ) scoring_durations;
    RETURN ROUND(v_avg_duration, 2);
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for Scoring Templates
CREATE OR REPLACE FUNCTION public.update_scoring_template_updated_at()
RETURNS TRIGGER AS $
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_scoring_template_updated_at
BEFORE UPDATE ON public.scoring_templates FOR EACH ROW EXECUTE FUNCTION public.update_scoring_template_updated_at();

COMMENT ON TABLE public.scoring_templates IS 'Stores scoring templates for projects with customizable criteria';
COMMENT ON TABLE public.scoring_criteria IS 'Individual scoring criteria within a template with weights';
COMMENT ON TABLE public.proposal_scores IS 'Scores assigned to proposals for each criterion';
COMMENT ON TABLE public.proposal_score_history IS 'Audit trail of all score changes';
COMMENT ON TABLE public.proposal_rankings IS 'Calculated rankings of proposals within a project';

-- ============================================================
-- MIGRATION 013: FIX ADMIN FUNCTIONS PERMISSIONS
-- ============================================================

CREATE OR REPLACE FUNCTION approve_project(p_project_id UUID, p_admin_id UUID, p_notes TEXT DEFAULT NULL)
RETURNS VOID AS $
BEGIN
  UPDATE public.projects SET status = 'open', approved_by = p_admin_id, approved_at = NOW(), approval_notes = p_notes, updated_at = NOW() WHERE id = p_project_id;
  INSERT INTO public.admin_actions (admin_id, action_type, target_user_id, reason, created_at)
  SELECT p_admin_id, 'APPROVE_PROJECT', client_id, p_notes, NOW() FROM public.projects WHERE id = p_project_id;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION reject_project(p_project_id UUID, p_admin_id UUID, p_reason TEXT)
RETURNS VOID AS $
BEGIN
  UPDATE public.projects SET status = 'pending_review', approved_by = p_admin_id, approved_at = NOW(), rejection_reason = p_reason, updated_at = NOW() WHERE id = p_project_id;
  INSERT INTO public.admin_actions (admin_id, action_type, target_user_id, reason, created_at)
  SELECT p_admin_id, 'REJECT_PROJECT', client_id, p_reason, NOW() FROM public.projects WHERE id = p_project_id;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- MIGRATION 014: ADD PROPOSAL INSERT POLICY
-- ============================================================

CREATE POLICY "proposals_lead_insert" ON public.proposals
FOR INSERT WITH CHECK (auth.uid() = lead_id AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.status = 'open'));

DROP POLICY IF EXISTS "proposal_write" ON public.proposals;
CREATE POLICY "proposals_lead_update" ON public.proposals
FOR UPDATE USING (auth.uid() = lead_id) WITH CHECK (auth.uid() = lead_id);

CREATE POLICY "proposals_lead_delete" ON public.proposals
FOR DELETE USING (auth.uid() = lead_id AND status = 'draft');

-- ============================================================
-- MIGRATION 016: TEAM INVITATIONS TABLE (ENHANCED)
-- ============================================================

-- Add proposal_id column to team_invitations if not exists
DO $
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'team_invitations' 
        AND column_name = 'proposal_id'
    ) THEN
        ALTER TABLE public.team_invitations ADD COLUMN proposal_id UUID REFERENCES public.proposals(id) ON DELETE CASCADE;
    END IF;
END $;

-- Add constraint to ensure either project_id or proposal_id is set
DO $
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'team_invitations_has_project_or_proposal'
    ) THEN
        ALTER TABLE public.team_invitations 
        ADD CONSTRAINT team_invitations_has_project_or_proposal 
        CHECK (project_id IS NOT NULL OR proposal_id IS NOT NULL);
    END IF;
END $;

-- Add index for proposal_id
CREATE INDEX IF NOT EXISTS idx_team_invitations_proposal ON public.team_invitations(proposal_id);
CREATE INDEX IF NOT EXISTS idx_team_invitations_proposal_active ON public.team_invitations(proposal_id, expires_at) WHERE used_at IS NULL;

COMMENT ON COLUMN public.team_invitations.proposal_id IS 'NEW: correct approach - invitations are per proposal, not project';

-- ============================================================
-- MIGRATION 017: ARCHIVED SECTIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.archived_sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    original_id UUID NOT NULL,
    document_id UUID NOT NULL REFERENCES public.workspace_documents(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    "order" INT NOT NULL,
    status TEXT NOT NULL,
    assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    deadline TIMESTAMPTZ,
    content JSONB NOT NULL DEFAULT '{}'::jsonb,
    archived_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    archived_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_archived_sections_document ON public.archived_sections(document_id);
CREATE INDEX IF NOT EXISTS idx_archived_sections_original ON public.archived_sections(original_id);
CREATE INDEX IF NOT EXISTS idx_archived_sections_archived_at ON public.archived_sections(archived_at DESC);

ALTER TABLE public.archived_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "archived_sections_collaborator_select" ON public.archived_sections
FOR SELECT USING (EXISTS (SELECT 1 FROM public.document_collaborators dc WHERE dc.document_id = archived_sections.document_id AND dc.user_id = auth.uid()));

CREATE POLICY "archived_sections_editor_insert" ON public.archived_sections
FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.document_collaborators dc WHERE dc.document_id = archived_sections.document_id AND dc.user_id = auth.uid() AND dc.role IN ('owner', 'editor')));

-- ============================================================
-- MIGRATION 018: ADD DOCUMENT METADATA
-- ============================================================

ALTER TABLE public.documents 
ADD COLUMN IF NOT EXISTS file_name TEXT,
ADD COLUMN IF NOT EXISTS file_size BIGINT,
ADD COLUMN IF NOT EXISTS is_required BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_documents_required ON public.documents(proposal_id, is_required) WHERE is_required = true;
CREATE INDEX IF NOT EXISTS idx_documents_file_name ON public.documents(file_name);

UPDATE public.documents 
SET file_name = COALESCE(file_name, 'Unknown'), file_size = COALESCE(file_size, 0), is_required = COALESCE(is_required, false)
WHERE file_name IS NULL OR file_size IS NULL OR is_required IS NULL;

DO $
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'documents' AND column_name = 'file_name' AND is_nullable = 'YES') THEN
        ALTER TABLE public.documents ALTER COLUMN file_name SET NOT NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'documents' AND column_name = 'file_size' AND is_nullable = 'YES') THEN
        ALTER TABLE public.documents ALTER COLUMN file_size SET NOT NULL;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'documents' AND column_name = 'is_required' AND is_nullable = 'YES') THEN
        ALTER TABLE public.documents ALTER COLUMN is_required SET NOT NULL;
    END IF;
END $;

COMMENT ON TABLE public.documents IS 'Stores proposal document attachments with metadata for validation and tracking';
COMMENT ON COLUMN public.documents.file_name IS 'Original file name';
COMMENT ON COLUMN public.documents.file_size IS 'File size in bytes';
COMMENT ON COLUMN public.documents.is_required IS 'Whether this document is required for proposal submission';

-- ============================================================
-- MIGRATION 032: VERIFY SECURITY MEASURES
-- ============================================================

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "bid_team_members_read" ON public.bid_team_members;
DROP POLICY IF EXISTS "bid_team_members_lead_insert" ON public.bid_team_members;
DROP POLICY IF EXISTS "bid_team_members_lead_delete" ON public.bid_team_members;
DROP POLICY IF EXISTS "bid_team_members_admin_all" ON public.bid_team_members;

-- Team members can view their own team
CREATE POLICY "bid_team_members_read" ON public.bid_team_members
FOR SELECT USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.bid_team_members btm WHERE btm.project_id = bid_team_members.project_id AND btm.user_id = auth.uid()));

-- Only leads can add team members to their projects
CREATE POLICY "bid_team_members_lead_insert" ON public.bid_team_members
FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.bid_team_members btm WHERE btm.project_id = bid_team_members.project_id AND btm.user_id = auth.uid() AND btm.role = 'lead'));

-- Only leads can remove team members from their projects
CREATE POLICY "bid_team_members_lead_delete" ON public.bid_team_members
FOR DELETE USING (EXISTS (SELECT 1 FROM public.bid_team_members btm WHERE btm.project_id = bid_team_members.project_id AND btm.user_id = auth.uid() AND btm.role = 'lead'));

-- Admins can view all team members
CREATE POLICY "bid_team_members_admin_all" ON public.bid_team_members
FOR ALL USING (EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND raw_user_meta_data->>'role' = 'admin'));

-- Helper Functions for Authorization
CREATE OR REPLACE FUNCTION public.is_project_lead(p_project_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $
BEGIN
    RETURN EXISTS (SELECT 1 FROM public.bid_team_members WHERE project_id = p_project_id AND user_id = p_user_id AND role = 'lead');
END;
$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_team_member(p_project_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $
BEGIN
    RETURN EXISTS (SELECT 1 FROM public.bid_team_members WHERE project_id = p_project_id AND user_id = p_user_id);
END;
$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.is_project_lead(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_team_member(UUID, UUID) TO authenticated;

-- ============================================================
-- MIGRATION 033: ADD MISSING PROPOSAL CONTENT FIELDS
-- ============================================================

ALTER TABLE public.proposals 
ADD COLUMN IF NOT EXISTS content TEXT,
ADD COLUMN IF NOT EXISTS additional_info JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_proposals_content_search 
ON public.proposals USING gin(to_tsvector('english', content)) WHERE content IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_proposals_additional_info ON public.proposals USING gin(additional_info);

COMMENT ON COLUMN public.proposals.content IS 'Main proposal content (rich text/HTML)';
COMMENT ON COLUMN public.proposals.additional_info IS 'Additional information responses as JSONB';

-- ============================================================
-- MIGRATION: ADD PROPOSAL TEAM MEMBERS RLS POLICIES
-- ============================================================

ALTER TABLE public.proposal_team_members ENABLE ROW LEVEL SECURITY;

-- Team members can view their own team
CREATE POLICY "proposal_team_members_read" ON public.proposal_team_members
FOR SELECT USING (
    user_id = auth.uid() 
    OR EXISTS (
        SELECT 1 FROM public.proposals p 
        WHERE p.id = proposal_team_members.proposal_id 
        AND p.lead_id = auth.uid()
    )
);

-- Only leads can add team members
CREATE POLICY "proposal_team_members_lead_insert" ON public.proposal_team_members
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.proposals p 
        WHERE p.id = proposal_team_members.proposal_id 
        AND p.lead_id = auth.uid()
    )
);

-- Only leads can remove team members
CREATE POLICY "proposal_team_members_lead_delete" ON public.proposal_team_members
FOR DELETE USING (
    EXISTS (
        SELECT 1 FROM public.proposals p 
        WHERE p.id = proposal_team_members.proposal_id 
        AND p.lead_id = auth.uid()
    )
);

-- Admins can view all team members
CREATE POLICY "proposal_team_members_admin_all" ON public.proposal_team_members
FOR ALL USING (EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND raw_user_meta_data->>'role' = 'admin'));

-- ============================================================
-- END OF ALL MIGRATIONS - BIDSYNC SCHEMA COMPLETE
-- ============================================================

-- ============================================================
-- MIGRATION: PROJECT DELIVERY AND ARCHIVAL SYSTEM
-- ============================================================
-- This migration adds tables and infrastructure for:
-- - Deliverable uploads and management
-- - Project completion workflow
-- - Project archival and retention
-- - Export functionality
-- - Completion statistics
-- ============================================================

-- ============================================================
-- 1. UPDATE PROJECT STATUS ENUM
-- ============================================================

-- Add new project statuses for completion workflow
DO $
BEGIN
    -- Add 'awarded' status if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'awarded' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'project_status')
    ) THEN
        ALTER TYPE project_status ADD VALUE 'awarded';
    END IF;
    
    -- Add 'pending_completion' status if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'pending_completion' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'project_status')
    ) THEN
        ALTER TYPE project_status ADD VALUE 'pending_completion';
    END IF;
    
    -- Add 'completed' status if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'completed' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'project_status')
    ) THEN
        ALTER TYPE project_status ADD VALUE 'completed';
    END IF;
END $;

-- ============================================================
-- 2. PROJECT DELIVERABLES TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.project_deliverables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    proposal_id UUID NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
    uploaded_by UUID NOT NULL REFERENCES auth.users(id),
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    description TEXT,
    version INT NOT NULL DEFAULT 1,
    is_final BOOLEAN DEFAULT false,
    uploaded_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT deliverables_file_size_check CHECK (file_size > 0 AND file_size <= 104857600)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_deliverables_project ON public.project_deliverables(project_id);
CREATE INDEX IF NOT EXISTS idx_deliverables_proposal ON public.project_deliverables(proposal_id);
CREATE INDEX IF NOT EXISTS idx_deliverables_uploaded_by ON public.project_deliverables(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_deliverables_uploaded_at ON public.project_deliverables(uploaded_at DESC);

COMMENT ON TABLE public.project_deliverables IS 'Stores final deliverables uploaded by bidding teams upon project completion';
COMMENT ON COLUMN public.project_deliverables.file_path IS 'Path to file in Supabase Storage';
COMMENT ON COLUMN public.project_deliverables.file_size IS 'File size in bytes (max 100MB)';
COMMENT ON COLUMN public.project_deliverables.is_final IS 'Whether this is the final version of the deliverable';

-- ============================================================
-- 3. PROJECT COMPLETIONS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.project_completions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE UNIQUE,
    proposal_id UUID NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
    submitted_by UUID NOT NULL REFERENCES auth.users(id),
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    reviewed_by UUID REFERENCES auth.users(id),
    reviewed_at TIMESTAMPTZ,
    review_status TEXT NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending', 'accepted', 'revision_requested')),
    review_comments TEXT,
    revision_count INT DEFAULT 0,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_completions_project ON public.project_completions(project_id);
CREATE INDEX IF NOT EXISTS idx_completions_proposal ON public.project_completions(proposal_id);
CREATE INDEX IF NOT EXISTS idx_completions_status ON public.project_completions(review_status);
CREATE INDEX IF NOT EXISTS idx_completions_submitted_at ON public.project_completions(submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_completions_completed_at ON public.project_completions(completed_at DESC) WHERE completed_at IS NOT NULL;

COMMENT ON TABLE public.project_completions IS 'Tracks project completion submissions and review status';
COMMENT ON COLUMN public.project_completions.review_status IS 'Current review status: pending, accepted, or revision_requested';
COMMENT ON COLUMN public.project_completions.revision_count IS 'Number of times revisions have been requested';

-- ============================================================
-- 4. PROJECT ARCHIVES TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.project_archives (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE UNIQUE,
    archive_identifier TEXT NOT NULL UNIQUE,
    archive_data JSONB NOT NULL,
    compressed_size BIGINT NOT NULL,
    original_size BIGINT NOT NULL,
    compression_ratio NUMERIC(5,2),
    archived_by UUID NOT NULL REFERENCES auth.users(id),
    archived_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    retention_until TIMESTAMPTZ,
    legal_hold BOOLEAN DEFAULT false,
    legal_hold_reason TEXT,
    access_count INT DEFAULT 0,
    last_accessed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_archives_project ON public.project_archives(project_id);
CREATE INDEX IF NOT EXISTS idx_archives_identifier ON public.project_archives(archive_identifier);
CREATE INDEX IF NOT EXISTS idx_archives_archived_at ON public.project_archives(archived_at DESC);
CREATE INDEX IF NOT EXISTS idx_archives_retention ON public.project_archives(retention_until) WHERE retention_until IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_archives_legal_hold ON public.project_archives(legal_hold) WHERE legal_hold = true;

COMMENT ON TABLE public.project_archives IS 'Stores compressed archives of completed projects';
COMMENT ON COLUMN public.project_archives.archive_data IS 'JSONB containing all project data (proposals, deliverables, documents, comments)';
COMMENT ON COLUMN public.project_archives.archive_identifier IS 'Unique identifier for archive retrieval';
COMMENT ON COLUMN public.project_archives.legal_hold IS 'Prevents deletion when true, regardless of retention period';

-- ============================================================
-- 5. COMPLETION REVISIONS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.completion_revisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    completion_id UUID NOT NULL REFERENCES public.project_completions(id) ON DELETE CASCADE,
    revision_number INT NOT NULL,
    requested_by UUID NOT NULL REFERENCES auth.users(id),
    requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    revision_notes TEXT NOT NULL,
    resolved_by UUID REFERENCES auth.users(id),
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(completion_id, revision_number)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_revisions_completion ON public.completion_revisions(completion_id);
CREATE INDEX IF NOT EXISTS idx_revisions_requested_at ON public.completion_revisions(requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_revisions_requested_by ON public.completion_revisions(requested_by);

COMMENT ON TABLE public.completion_revisions IS 'Tracks revision requests and their resolution';
COMMENT ON COLUMN public.completion_revisions.revision_notes IS 'Client feedback explaining what needs to be revised';

-- ============================================================
-- 6. PROJECT EXPORTS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.project_exports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    requested_by UUID NOT NULL REFERENCES auth.users(id),
    requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    export_path TEXT,
    export_size BIGINT,
    expires_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_exports_project ON public.project_exports(project_id);
CREATE INDEX IF NOT EXISTS idx_exports_requested_by ON public.project_exports(requested_by);
CREATE INDEX IF NOT EXISTS idx_exports_status ON public.project_exports(status);
CREATE INDEX IF NOT EXISTS idx_exports_expires ON public.project_exports(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_exports_requested_at ON public.project_exports(requested_at DESC);

COMMENT ON TABLE public.project_exports IS 'Tracks export requests and their processing status';
COMMENT ON COLUMN public.project_exports.export_path IS 'Path to export file in storage';
COMMENT ON COLUMN public.project_exports.expires_at IS 'Export download link expiration (7 days from creation)';

-- ============================================================
-- 7. ENABLE ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.project_deliverables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_archives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.completion_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_exports ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 8. RLS POLICIES FOR PROJECT DELIVERABLES
-- ============================================================

-- Team members and client can view deliverables
CREATE POLICY "deliverables_team_client_select" ON public.project_deliverables
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_deliverables.project_id
    AND (
      p.client_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.bid_team_members btm
        WHERE btm.project_id = p.id
        AND btm.user_id = auth.uid()
      )
    )
  )
);

-- Team members can insert deliverables
CREATE POLICY "deliverables_team_insert" ON public.project_deliverables
FOR INSERT WITH CHECK (
  uploaded_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.bid_team_members btm
    WHERE btm.project_id = project_deliverables.project_id
    AND btm.user_id = auth.uid()
  )
);

-- Team members can delete their own deliverables (before submission)
CREATE POLICY "deliverables_team_delete" ON public.project_deliverables
FOR DELETE USING (
  uploaded_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_deliverables.project_id
    AND p.status = 'awarded'
  )
);

-- Admins can view all deliverables
CREATE POLICY "deliverables_admin_select" ON public.project_deliverables
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid() 
    AND raw_user_meta_data->>'role' = 'admin'
  )
);

-- ============================================================
-- 9. RLS POLICIES FOR PROJECT COMPLETIONS
-- ============================================================

-- Team members and client can view completions
CREATE POLICY "completions_team_client_select" ON public.project_completions
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_completions.project_id
    AND (
      p.client_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.bid_team_members btm
        WHERE btm.project_id = p.id
        AND btm.user_id = auth.uid()
      )
    )
  )
);

-- Team leads can insert completions
CREATE POLICY "completions_lead_insert" ON public.project_completions
FOR INSERT WITH CHECK (
  submitted_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.bid_team_members btm
    WHERE btm.project_id = project_completions.project_id
    AND btm.user_id = auth.uid()
    AND btm.role = 'lead'
  )
);

-- Clients can update completions (for review)
CREATE POLICY "completions_client_update" ON public.project_completions
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_completions.project_id
    AND p.client_id = auth.uid()
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_completions.project_id
    AND p.client_id = auth.uid()
  )
);

-- Admins can view all completions
CREATE POLICY "completions_admin_select" ON public.project_completions
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid() 
    AND raw_user_meta_data->>'role' = 'admin'
  )
);

-- ============================================================
-- 10. RLS POLICIES FOR PROJECT ARCHIVES
-- ============================================================

-- Participants can view archives
CREATE POLICY "archives_participants_select" ON public.project_archives
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_archives.project_id
    AND (
      p.client_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.bid_team_members btm
        WHERE btm.project_id = p.id
        AND btm.user_id = auth.uid()
      )
    )
  )
);

-- System can insert archives (via service role)
CREATE POLICY "archives_system_insert" ON public.project_archives
FOR INSERT WITH CHECK (true);

-- System can update archives (for access tracking)
CREATE POLICY "archives_system_update" ON public.project_archives
FOR UPDATE USING (true) WITH CHECK (true);

-- Admins can manage archives
CREATE POLICY "archives_admin_all" ON public.project_archives
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid() 
    AND raw_user_meta_data->>'role' = 'admin'
  )
);

-- ============================================================
-- 11. RLS POLICIES FOR COMPLETION REVISIONS
-- ============================================================

-- Team members and client can view revisions
CREATE POLICY "revisions_team_client_select" ON public.completion_revisions
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.project_completions pc
    JOIN public.projects p ON p.id = pc.project_id
    WHERE pc.id = completion_revisions.completion_id
    AND (
      p.client_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.bid_team_members btm
        WHERE btm.project_id = p.id
        AND btm.user_id = auth.uid()
      )
    )
  )
);

-- Clients can insert revisions
CREATE POLICY "revisions_client_insert" ON public.completion_revisions
FOR INSERT WITH CHECK (
  requested_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.project_completions pc
    JOIN public.projects p ON p.id = pc.project_id
    WHERE pc.id = completion_revisions.completion_id
    AND p.client_id = auth.uid()
  )
);

-- Team leads can update revisions (mark as resolved)
CREATE POLICY "revisions_lead_update" ON public.completion_revisions
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.project_completions pc
    JOIN public.bid_team_members btm ON btm.project_id = pc.project_id
    WHERE pc.id = completion_revisions.completion_id
    AND btm.user_id = auth.uid()
    AND btm.role = 'lead'
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.project_completions pc
    JOIN public.bid_team_members btm ON btm.project_id = pc.project_id
    WHERE pc.id = completion_revisions.completion_id
    AND btm.user_id = auth.uid()
    AND btm.role = 'lead'
  )
);

-- ============================================================
-- 12. RLS POLICIES FOR PROJECT EXPORTS
-- ============================================================

-- Users can view their own export requests
CREATE POLICY "exports_user_select" ON public.project_exports
FOR SELECT USING (requested_by = auth.uid());

-- Users can create export requests for projects they have access to
CREATE POLICY "exports_user_insert" ON public.project_exports
FOR INSERT WITH CHECK (
  requested_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_exports.project_id
    AND (
      p.client_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.bid_team_members btm
        WHERE btm.project_id = p.id
        AND btm.user_id = auth.uid()
      )
    )
  )
);

-- System can update exports (for processing)
CREATE POLICY "exports_system_update" ON public.project_exports
FOR UPDATE USING (true) WITH CHECK (true);

-- Admins can view all exports
CREATE POLICY "exports_admin_select" ON public.project_exports
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid() 
    AND raw_user_meta_data->>'role' = 'admin'
  )
);

-- ============================================================
-- 13. HELPER FUNCTIONS
-- ============================================================

-- Generate unique archive identifier
CREATE OR REPLACE FUNCTION public.generate_archive_identifier()
RETURNS TEXT AS $
DECLARE
  v_identifier TEXT;
  v_exists BOOLEAN;
BEGIN
  LOOP
    -- Generate identifier: ARCH-YYYYMMDD-XXXXXX (random 6 chars)
    v_identifier := 'ARCH-' || 
                    TO_CHAR(NOW(), 'YYYYMMDD') || '-' || 
                    UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6));
    
    -- Check if it exists
    SELECT EXISTS(
      SELECT 1 FROM public.project_archives WHERE archive_identifier = v_identifier
    ) INTO v_exists;
    
    -- Exit loop if unique
    EXIT WHEN NOT v_exists;
  END LOOP;
  
  RETURN v_identifier;
END;
$ LANGUAGE plpgsql VOLATILE SECURITY DEFINER;

-- Update completion timestamp trigger
CREATE OR REPLACE FUNCTION public.update_completion_timestamp()
RETURNS TRIGGER AS $
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_completion_timestamp ON public.project_completions;
CREATE TRIGGER trigger_update_completion_timestamp
  BEFORE UPDATE ON public.project_completions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_completion_timestamp();

-- Update export timestamp trigger
CREATE OR REPLACE FUNCTION public.update_export_timestamp()
RETURNS TRIGGER AS $
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_export_timestamp ON public.project_exports;
CREATE TRIGGER trigger_update_export_timestamp
  BEFORE UPDATE ON public.project_exports
  FOR EACH ROW
  EXECUTE FUNCTION public.update_export_timestamp();

-- Increment archive access count
CREATE OR REPLACE FUNCTION public.increment_archive_access(p_archive_id UUID)
RETURNS VOID AS $
BEGIN
  UPDATE public.project_archives
  SET 
    access_count = access_count + 1,
    last_accessed_at = NOW()
  WHERE id = p_archive_id;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get deliverables count for a project
CREATE OR REPLACE FUNCTION public.get_deliverables_count(p_project_id UUID)
RETURNS INT AS $
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*)
  INTO v_count
  FROM public.project_deliverables
  WHERE project_id = p_project_id;
  
  RETURN v_count;
END;
$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Check if project can be marked ready for delivery
CREATE OR REPLACE FUNCTION public.can_mark_ready_for_delivery(p_project_id UUID)
RETURNS BOOLEAN AS $
DECLARE
  v_deliverables_count INT;
  v_project_status TEXT;
BEGIN
  -- Get project status
  SELECT status INTO v_project_status
  FROM public.projects
  WHERE id = p_project_id;
  
  -- Must be in awarded status
  IF v_project_status != 'awarded' THEN
    RETURN FALSE;
  END IF;
  
  -- Must have at least one deliverable
  SELECT COUNT(*) INTO v_deliverables_count
  FROM public.project_deliverables
  WHERE project_id = p_project_id;
  
  RETURN v_deliverables_count > 0;
END;
$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Calculate completion statistics
CREATE OR REPLACE FUNCTION public.get_completion_statistics(
  p_client_id UUID DEFAULT NULL,
  p_date_from TIMESTAMPTZ DEFAULT NULL,
  p_date_to TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB AS $
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'totalCompleted', COUNT(*),
    'averageTimeToCompletion', COALESCE(
      EXTRACT(EPOCH FROM AVG(pc.completed_at - pc.submitted_at))::INT,
      0
    ),
    'projectsRequiringRevisions', COUNT(*) FILTER (WHERE pc.revision_count > 0),
    'totalDeliverablesReceived', (
      SELECT COUNT(*)
      FROM public.project_deliverables pd
      JOIN public.projects p ON p.id = pd.project_id
      WHERE (p_client_id IS NULL OR p.client_id = p_client_id)
      AND (p_date_from IS NULL OR pd.uploaded_at >= p_date_from)
      AND (p_date_to IS NULL OR pd.uploaded_at <= p_date_to)
    ),
    'completionsByMonth', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'month', TO_CHAR(month_date, 'YYYY-MM'),
          'count', month_count
        )
        ORDER BY month_date
      )
      FROM (
        SELECT 
          DATE_TRUNC('month', pc2.completed_at) as month_date,
          COUNT(*) as month_count
        FROM public.project_completions pc2
        JOIN public.projects p2 ON p2.id = pc2.project_id
        WHERE pc2.completed_at IS NOT NULL
        AND (p_client_id IS NULL OR p2.client_id = p_client_id)
        AND (p_date_from IS NULL OR pc2.completed_at >= p_date_from)
        AND (p_date_to IS NULL OR pc2.completed_at <= p_date_to)
        GROUP BY DATE_TRUNC('month', pc2.completed_at)
      ) monthly_data
    )
  )
  INTO v_result
  FROM public.project_completions pc
  JOIN public.projects p ON p.id = pc.project_id
  WHERE pc.completed_at IS NOT NULL
  AND (p_client_id IS NULL OR p.client_id = p_client_id)
  AND (p_date_from IS NULL OR pc.completed_at >= p_date_from)
  AND (p_date_to IS NULL OR pc.completed_at <= p_date_to);
  
  RETURN v_result;
END;
$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.generate_archive_identifier() TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_archive_access(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_deliverables_count(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_mark_ready_for_delivery(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_completion_statistics(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

-- ============================================================
-- 14. STORAGE BUCKET SETUP (INSTRUCTIONS)
-- ============================================================

-- NOTE: Supabase Storage buckets must be created via the Supabase Dashboard or API
-- Create a bucket named 'deliverables' with the following settings:
-- - Public: false (private bucket)
-- - File size limit: 100MB
-- - Allowed MIME types: all (or restrict as needed)
--
-- Storage policies should be configured to allow:
-- - Team members to upload files to their project folders
-- - Team members and clients to download files from their projects
-- - Automatic cleanup of orphaned files (optional)

-- ============================================================
-- END OF PROJECT DELIVERY AND ARCHIVAL MIGRATION
-- ============================================================


-- ============================================================
-- FIX: Updated has_document_permission function
-- Now also checks workspace leads and team members
-- ============================================================

CREATE OR REPLACE FUNCTION public.has_document_permission(p_document_id UUID, p_user_id UUID, p_required_role TEXT DEFAULT 'viewer')
RETURNS BOOLEAN AS $$
DECLARE
    v_user_role TEXT;
    v_role_hierarchy INT;
    v_required_hierarchy INT;
    v_workspace_id UUID;
    v_project_id UUID;
    v_is_workspace_lead BOOLEAN;
    v_is_team_member BOOLEAN;
BEGIN
    -- First check document_collaborators table
    SELECT role INTO v_user_role 
    FROM public.document_collaborators 
    WHERE document_id = p_document_id AND user_id = p_user_id;
    
    IF v_user_role IS NOT NULL THEN
        v_user_role := LOWER(v_user_role);
        p_required_role := LOWER(p_required_role);
        v_role_hierarchy := CASE v_user_role WHEN 'owner' THEN 4 WHEN 'editor' THEN 3 WHEN 'commenter' THEN 2 WHEN 'viewer' THEN 1 ELSE 0 END;
        v_required_hierarchy := CASE p_required_role WHEN 'owner' THEN 4 WHEN 'editor' THEN 3 WHEN 'commenter' THEN 2 WHEN 'viewer' THEN 1 ELSE 0 END;
        RETURN v_role_hierarchy >= v_required_hierarchy;
    END IF;
    
    -- If not a collaborator, check if user is workspace lead or team member
    -- Get workspace_id from document
    SELECT workspace_id INTO v_workspace_id 
    FROM public.workspace_documents 
    WHERE id = p_document_id;
    
    IF v_workspace_id IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Get project_id from workspace
    SELECT project_id INTO v_project_id 
    FROM public.workspaces 
    WHERE id = v_workspace_id;
    
    IF v_project_id IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Check if user is workspace lead
    SELECT EXISTS(
        SELECT 1 FROM public.workspaces 
        WHERE id = v_workspace_id AND lead_id = p_user_id
    ) INTO v_is_workspace_lead;
    
    IF v_is_workspace_lead THEN
        -- Workspace leads have editor access
        p_required_role := LOWER(p_required_role);
        v_required_hierarchy := CASE p_required_role WHEN 'owner' THEN 4 WHEN 'editor' THEN 3 WHEN 'commenter' THEN 2 WHEN 'viewer' THEN 1 ELSE 0 END;
        RETURN 3 >= v_required_hierarchy; -- Editor level (3)
    END IF;
    
    -- Check if user is a team member for the project
    SELECT EXISTS(
        SELECT 1 FROM public.bid_team_members 
        WHERE project_id = v_project_id AND user_id = p_user_id
    ) INTO v_is_team_member;
    
    IF v_is_team_member THEN
        -- Team members have viewer access by default
        p_required_role := LOWER(p_required_role);
        v_required_hierarchy := CASE p_required_role WHEN 'owner' THEN 4 WHEN 'editor' THEN 3 WHEN 'commenter' THEN 2 WHEN 'viewer' THEN 1 ELSE 0 END;
        RETURN 1 >= v_required_hierarchy; -- Viewer level (1)
    END IF;
    
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.has_document_permission IS 'Checks if a user has the required permission level for a document. Checks collaborators, workspace leads, and team members.';


-- ============================================================
-- MIGRATION 024: PROPOSAL SCORING SYSTEM TABLES
-- ============================================================
-- Creates tables for proposal scoring, criteria, and rankings

-- Scoring Templates Table
CREATE TABLE IF NOT EXISTS public.scoring_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    is_default BOOLEAN DEFAULT false,
    created_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(project_id)
);

-- Scoring Criteria Table
CREATE TABLE IF NOT EXISTS public.scoring_criteria (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES public.scoring_templates(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    weight NUMERIC(5,2) NOT NULL CHECK (weight > 0 AND weight <= 100),
    order_index INT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT scoring_criteria_order_positive CHECK (order_index >= 0),
    CONSTRAINT scoring_criteria_template_order_unique UNIQUE(template_id, order_index)
);

-- Proposal Scores Table
CREATE TABLE IF NOT EXISTS public.proposal_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proposal_id UUID NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
    criterion_id UUID NOT NULL REFERENCES public.scoring_criteria(id) ON DELETE CASCADE,
    scored_by UUID NOT NULL REFERENCES auth.users(id),
    raw_score NUMERIC(4,2) NOT NULL CHECK (raw_score >= 1 AND raw_score <= 10),
    weighted_score NUMERIC(6,2) NOT NULL,
    notes TEXT,
    scored_at TIMESTAMPTZ DEFAULT now(),
    is_final BOOLEAN DEFAULT false,
    CONSTRAINT proposal_scores_unique_final UNIQUE(proposal_id, criterion_id, is_final) 
        DEFERRABLE INITIALLY DEFERRED
);

-- Proposal Score History Table
CREATE TABLE IF NOT EXISTS public.proposal_score_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proposal_id UUID NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
    criterion_id UUID NOT NULL REFERENCES public.scoring_criteria(id) ON DELETE CASCADE,
    scored_by UUID NOT NULL REFERENCES auth.users(id),
    previous_raw_score NUMERIC(4,2),
    new_raw_score NUMERIC(4,2) NOT NULL,
    previous_weighted_score NUMERIC(6,2),
    new_weighted_score NUMERIC(6,2) NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Proposal Rankings Table
CREATE TABLE IF NOT EXISTS public.proposal_rankings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    proposal_id UUID NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
    total_score NUMERIC(6,2) NOT NULL DEFAULT 0,
    rank INT NOT NULL,
    is_fully_scored BOOLEAN DEFAULT false,
    calculated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(project_id, proposal_id)
);

-- ============================================================
-- INDEXES FOR SCORING TABLES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_scoring_templates_project_id ON public.scoring_templates(project_id);
CREATE INDEX IF NOT EXISTS idx_scoring_templates_created_by ON public.scoring_templates(created_by);
CREATE INDEX IF NOT EXISTS idx_scoring_criteria_template_id ON public.scoring_criteria(template_id);
CREATE INDEX IF NOT EXISTS idx_scoring_criteria_template_order ON public.scoring_criteria(template_id, order_index);
CREATE INDEX IF NOT EXISTS idx_proposal_scores_proposal_id ON public.proposal_scores(proposal_id);
CREATE INDEX IF NOT EXISTS idx_proposal_scores_criterion_id ON public.proposal_scores(criterion_id);
CREATE INDEX IF NOT EXISTS idx_proposal_scores_proposal_final ON public.proposal_scores(proposal_id, is_final);
CREATE INDEX IF NOT EXISTS idx_proposal_scores_scored_by ON public.proposal_scores(scored_by);
CREATE INDEX IF NOT EXISTS idx_proposal_score_history_proposal_id ON public.proposal_score_history(proposal_id);
CREATE INDEX IF NOT EXISTS idx_proposal_score_history_criterion_id ON public.proposal_score_history(criterion_id);
CREATE INDEX IF NOT EXISTS idx_proposal_rankings_project_id ON public.proposal_rankings(project_id);
CREATE INDEX IF NOT EXISTS idx_proposal_rankings_proposal_id ON public.proposal_rankings(proposal_id);

-- ============================================================
-- ENABLE RLS FOR SCORING TABLES
-- ============================================================
ALTER TABLE public.scoring_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scoring_criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_score_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_rankings ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS POLICIES FOR SCORING TABLES
-- ============================================================

-- Scoring Templates: Clients can manage templates for their projects
CREATE POLICY "clients_manage_own_templates" ON public.scoring_templates
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.projects p 
        WHERE p.id = scoring_templates.project_id 
        AND p.client_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.projects p 
        WHERE p.id = scoring_templates.project_id 
        AND p.client_id = auth.uid()
    )
);

-- Scoring Criteria: Clients can manage criteria for their templates
CREATE POLICY "clients_manage_own_criteria" ON public.scoring_criteria
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.scoring_templates st 
        JOIN public.projects p ON p.id = st.project_id 
        WHERE st.id = scoring_criteria.template_id 
        AND p.client_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.scoring_templates st 
        JOIN public.projects p ON p.id = st.project_id 
        WHERE st.id = scoring_criteria.template_id 
        AND p.client_id = auth.uid()
    )
);

-- Proposal Scores: Clients can score proposals for their projects
CREATE POLICY "clients_score_own_projects" ON public.proposal_scores
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.proposals pr 
        JOIN public.projects p ON pr.project_id = p.id 
        WHERE pr.id = proposal_scores.proposal_id 
        AND p.client_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.proposals pr 
        JOIN public.projects p ON pr.project_id = p.id 
        WHERE pr.id = proposal_scores.proposal_id 
        AND p.client_id = auth.uid()
    )
);

-- Proposal Scores: Leads can view scores for their proposals
CREATE POLICY "leads_view_own_scores" ON public.proposal_scores
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.proposals pr 
        WHERE pr.id = proposal_scores.proposal_id 
        AND pr.lead_id = auth.uid()
    )
);

-- Proposal Score History: Clients can view history for their projects
CREATE POLICY "clients_view_own_history" ON public.proposal_score_history
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.proposals pr 
        JOIN public.projects p ON pr.project_id = p.id 
        WHERE pr.id = proposal_score_history.proposal_id 
        AND p.client_id = auth.uid()
    )
);

-- Proposal Score History: System can insert history records
CREATE POLICY "system_insert_history" ON public.proposal_score_history
FOR INSERT WITH CHECK (true);

-- Proposal Rankings: Clients can view rankings for their projects
CREATE POLICY "clients_view_own_rankings" ON public.proposal_rankings
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.projects p 
        WHERE p.id = proposal_rankings.project_id 
        AND p.client_id = auth.uid()
    )
);

-- Proposal Rankings: Leads can view rankings for their proposals
CREATE POLICY "leads_view_own_rankings" ON public.proposal_rankings
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.proposals pr 
        WHERE pr.id = proposal_rankings.proposal_id 
        AND pr.lead_id = auth.uid()
    )
);

-- Proposal Rankings: System can manage rankings
CREATE POLICY "system_manage_rankings" ON public.proposal_rankings
FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- SCORING HELPER FUNCTIONS
-- ============================================================

-- Calculate total score for a proposal
CREATE OR REPLACE FUNCTION public.calculate_proposal_total_score(p_proposal_id UUID)
RETURNS NUMERIC(6,2) AS $$
DECLARE
    v_total NUMERIC(6,2);
BEGIN
    SELECT COALESCE(SUM(weighted_score), 0) 
    INTO v_total 
    FROM public.proposal_scores 
    WHERE proposal_id = p_proposal_id AND is_final = true;
    
    RETURN ROUND(v_total, 2);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update proposal rankings for a project
CREATE OR REPLACE FUNCTION public.update_proposal_rankings(p_project_id UUID)
RETURNS void AS $$
BEGIN
    -- Delete existing rankings for this project
    DELETE FROM public.proposal_rankings WHERE project_id = p_project_id;
    
    -- Insert new rankings
    INSERT INTO public.proposal_rankings (project_id, proposal_id, total_score, rank, is_fully_scored, calculated_at)
    SELECT 
        p_project_id,
        p.id,
        public.calculate_proposal_total_score(p.id),
        ROW_NUMBER() OVER (ORDER BY public.calculate_proposal_total_score(p.id) DESC, p.created_at ASC),
        (
            SELECT CASE 
                WHEN COUNT(sc.id) = 0 THEN false 
                ELSE COUNT(sc.id) = COUNT(ps.id) FILTER (WHERE ps.is_final = true) 
            END
            FROM public.scoring_templates st 
            LEFT JOIN public.scoring_criteria sc ON sc.template_id = st.id
            LEFT JOIN public.proposal_scores ps ON ps.criterion_id = sc.id AND ps.proposal_id = p.id 
            WHERE st.project_id = p_project_id
        ) as is_fully_scored,
        NOW()
    FROM public.proposals p 
    WHERE p.project_id = p_project_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- MIGRATION 025: ADD SCORING ANALYTICS FUNCTION
-- ============================================================

-- Calculate average scoring duration (from first score to last score for each proposal)
CREATE OR REPLACE FUNCTION public.calculate_average_scoring_duration(
    p_date_from TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
    p_date_to TIMESTAMPTZ DEFAULT NOW()
)
RETURNS NUMERIC AS $$
DECLARE
    v_avg_duration NUMERIC;
BEGIN
    -- Calculate average duration in hours between first and last score for each proposal
    SELECT COALESCE(AVG(duration_hours), 0)
    INTO v_avg_duration
    FROM (
        SELECT 
            proposal_id,
            EXTRACT(EPOCH FROM (MAX(scored_at) - MIN(scored_at))) / 3600 as duration_hours
        FROM public.proposal_scores
        WHERE scored_at BETWEEN p_date_from AND p_date_to
        GROUP BY proposal_id
        HAVING COUNT(*) > 1  -- Only include proposals with multiple scores
    ) scoring_durations;
    
    RETURN ROUND(v_avg_duration, 2);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.calculate_average_scoring_duration(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_average_scoring_duration(TIMESTAMPTZ, TIMESTAMPTZ) TO service_role;

COMMENT ON FUNCTION public.calculate_average_scoring_duration IS 'Calculates the average time (in hours) between first and last score for proposals within a date range';

-- ============================================================
-- MIGRATION 026: FIX PLATFORM ANALYTICS FUNCTION
-- ============================================================

DROP FUNCTION IF EXISTS public.calculate_platform_analytics(TIMESTAMPTZ, TIMESTAMPTZ);

CREATE OR REPLACE FUNCTION public.calculate_platform_analytics(
    p_date_from TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days', 
    p_date_to TIMESTAMPTZ DEFAULT NOW()
)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
    user_growth JSONB;
    project_stats JSONB;
    proposal_stats JSONB;
BEGIN
    -- Get user growth data
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'date', date_trunc('day', created_at)::date, 
            'value', cnt
        ) ORDER BY day
    ), '[]'::jsonb)
    INTO user_growth
    FROM (
        SELECT date_trunc('day', created_at) as day, COUNT(*) as cnt
        FROM auth.users 
        WHERE created_at BETWEEN p_date_from AND p_date_to 
        GROUP BY date_trunc('day', created_at)
    ) t;

    -- Get project stats
    SELECT jsonb_build_object(
        'total', COUNT(*), 
        'pending', COUNT(*) FILTER (WHERE status = 'pending_review'), 
        'open', COUNT(*) FILTER (WHERE status = 'open'), 
        'closed', COUNT(*) FILTER (WHERE status = 'closed'), 
        'awarded', COUNT(*) FILTER (WHERE status = 'awarded')
    )
    INTO project_stats
    FROM public.projects 
    WHERE created_at BETWEEN p_date_from AND p_date_to;

    -- Get proposal stats
    SELECT jsonb_build_object(
        'total', COUNT(*), 
        'draft', COUNT(*) FILTER (WHERE status = 'draft'), 
        'submitted', COUNT(*) FILTER (WHERE status = 'submitted'), 
        'approved', COUNT(*) FILTER (WHERE status = 'approved'), 
        'rejected', COUNT(*) FILTER (WHERE status = 'rejected')
    )
    INTO proposal_stats
    FROM public.proposals 
    WHERE created_at BETWEEN p_date_from AND p_date_to;

    -- Build result
    result := jsonb_build_object(
        'userGrowth', COALESCE(user_growth, '[]'::jsonb),
        'projectStats', COALESCE(project_stats, jsonb_build_object('total', 0, 'pending', 0, 'open', 0, 'closed', 0, 'awarded', 0)),
        'proposalStats', COALESCE(proposal_stats, jsonb_build_object('total', 0, 'draft', 0, 'submitted', 0, 'approved', 0, 'rejected', 0))
    );

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.calculate_platform_analytics(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_platform_analytics(TIMESTAMPTZ, TIMESTAMPTZ) TO service_role;

COMMENT ON FUNCTION public.calculate_platform_analytics IS 'Calculates platform-wide analytics including user growth, project stats, and proposal stats';

-- ============================================================
-- SCORING TABLES COMMENTS
-- ============================================================
COMMENT ON TABLE public.scoring_templates IS 'Stores scoring templates for projects with customizable criteria';
COMMENT ON TABLE public.scoring_criteria IS 'Individual scoring criteria within a template with weights';
COMMENT ON TABLE public.proposal_scores IS 'Scores assigned to proposals for each criterion';
COMMENT ON TABLE public.proposal_score_history IS 'Audit trail of all score changes';
COMMENT ON TABLE public.proposal_rankings IS 'Calculated rankings of proposals within a project';
