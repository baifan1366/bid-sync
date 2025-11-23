-- Migration: Q&A System, Analytics, and Additional Features
-- Created: 2025-11-23

-- ============================================================================
-- Q&A SYSTEM
-- ============================================================================

-- Project Questions Table
CREATE TABLE IF NOT EXISTS project_questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  asked_by UUID NOT NULL REFERENCES auth.users(id),
  question TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Question Answers Table
CREATE TABLE IF NOT EXISTS question_answers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  question_id UUID NOT NULL REFERENCES project_questions(id) ON DELETE CASCADE,
  answered_by UUID NOT NULL REFERENCES auth.users(id),
  answer TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for Q&A
CREATE INDEX IF NOT EXISTS idx_project_questions_project ON project_questions(project_id);
CREATE INDEX IF NOT EXISTS idx_project_questions_created ON project_questions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_question_answers_question ON question_answers(question_id);
CREATE INDEX IF NOT EXISTS idx_question_answers_created ON question_answers(created_at DESC);

-- ============================================================================
-- INTERNAL COMMENTS SYSTEM
-- ============================================================================

-- Document Comments Table
CREATE TABLE IF NOT EXISTS document_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  content TEXT NOT NULL,
  is_internal BOOLEAN DEFAULT true,
  parent_id UUID REFERENCES document_comments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for Comments
CREATE INDEX IF NOT EXISTS idx_document_comments_document ON document_comments(document_id);
CREATE INDEX IF NOT EXISTS idx_document_comments_parent ON document_comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_document_comments_created ON document_comments(created_at DESC);

-- ============================================================================
-- CONTRACT GENERATION SYSTEM
-- ============================================================================

-- Contract Templates Table
CREATE TABLE IF NOT EXISTS contract_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
CREATE TABLE IF NOT EXISTS contracts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id),
  proposal_id UUID NOT NULL REFERENCES proposals(id),
  template_id UUID REFERENCES contract_templates(id),
  content TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'draft',
  version INT DEFAULT 1,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contract Signatures Table
CREATE TABLE IF NOT EXISTS contract_signatures (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  signer_id UUID NOT NULL REFERENCES auth.users(id),
  signed_at TIMESTAMPTZ,
  signature_data TEXT,
  ip_address VARCHAR(45),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for Contracts
CREATE INDEX IF NOT EXISTS idx_contracts_project ON contracts(project_id);
CREATE INDEX IF NOT EXISTS idx_contracts_proposal ON contracts(proposal_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(status);
CREATE INDEX IF NOT EXISTS idx_contract_signatures_contract ON contract_signatures(contract_id);

-- ============================================================================
-- PROJECT APPROVAL TRACKING
-- ============================================================================

-- Add approval tracking columns to projects if not exists
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
ADD COLUMN IF NOT EXISTS approval_notes TEXT;

-- Index for pending projects
CREATE INDEX IF NOT EXISTS idx_projects_status_created ON projects(status, created_at DESC);

-- ============================================================================
-- ANALYTICS TRACKING
-- ============================================================================

-- Platform Metrics Table (for caching analytics)
CREATE TABLE IF NOT EXISTS platform_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  metric_date DATE NOT NULL,
  metric_type VARCHAR(100) NOT NULL,
  metric_value JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(metric_date, metric_type)
);

CREATE INDEX IF NOT EXISTS idx_platform_metrics_date ON platform_metrics(metric_date DESC);
CREATE INDEX IF NOT EXISTS idx_platform_metrics_type ON platform_metrics(metric_type);

-- ============================================================================
-- MEMBER DASHBOARD VIEWS
-- ============================================================================

-- Create a view for member assigned sections
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
FROM document_sections ds
JOIN workspace_documents wd ON ds.document_id = wd.id
JOIN workspaces w ON wd.workspace_id = w.id
JOIN projects proj ON w.project_id = proj.id
WHERE ds.assigned_to IS NOT NULL;

-- ============================================================================
-- NOTIFICATION PREFERENCES
-- ============================================================================

-- User Notification Preferences Table
CREATE TABLE IF NOT EXISTS user_notification_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email_notifications BOOLEAN DEFAULT true,
  project_updates BOOLEAN DEFAULT true,
  new_messages BOOLEAN DEFAULT true,
  proposal_updates BOOLEAN DEFAULT true,
  qa_notifications BOOLEAN DEFAULT true,
  deadline_reminders BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to get pending projects count
CREATE OR REPLACE FUNCTION get_pending_projects_count()
RETURNS INTEGER AS $$
BEGIN
  RETURN (SELECT COUNT(*) FROM projects WHERE status = 'PENDING_REVIEW');
END;
$$ LANGUAGE plpgsql;

-- Function to approve project
CREATE OR REPLACE FUNCTION approve_project(
  p_project_id UUID,
  p_admin_id UUID,
  p_notes TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  UPDATE projects
  SET 
    status = 'OPEN',
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
$$ LANGUAGE plpgsql;

-- Function to reject project
CREATE OR REPLACE FUNCTION reject_project(
  p_project_id UUID,
  p_admin_id UUID,
  p_reason TEXT
)
RETURNS VOID AS $$
BEGIN
  UPDATE projects
  SET 
    status = 'REJECTED',
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
$$ LANGUAGE plpgsql;

-- Function to calculate platform analytics
CREATE OR REPLACE FUNCTION calculate_platform_analytics(
  p_date_from TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
  p_date_to TIMESTAMPTZ DEFAULT NOW()
)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'userGrowth', (
      SELECT jsonb_agg(jsonb_build_object(
        'date', date_trunc('day', created_at)::date,
        'value', COUNT(*)
      ))
      FROM auth.users
      WHERE created_at BETWEEN p_date_from AND p_date_to
      GROUP BY date_trunc('day', created_at)
      ORDER BY date_trunc('day', created_at)
    ),
    'projectStats', (
      SELECT jsonb_build_object(
        'total', COUNT(*),
        'pending', COUNT(*) FILTER (WHERE status = 'PENDING_REVIEW'),
        'open', COUNT(*) FILTER (WHERE status = 'OPEN'),
        'closed', COUNT(*) FILTER (WHERE status = 'CLOSED'),
        'awarded', COUNT(*) FILTER (WHERE status = 'AWARDED')
      )
      FROM projects
      WHERE created_at BETWEEN p_date_from AND p_date_to
    ),
    'proposalStats', (
      SELECT jsonb_build_object(
        'total', COUNT(*),
        'draft', COUNT(*) FILTER (WHERE status = 'DRAFT'),
        'submitted', COUNT(*) FILTER (WHERE status = 'SUBMITTED'),
        'accepted', COUNT(*) FILTER (WHERE status = 'ACCEPTED'),
        'rejected', COUNT(*) FILTER (WHERE status = 'REJECTED')
      )
      FROM proposals
      WHERE created_at BETWEEN p_date_from AND p_date_to
    )
  ) INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Trigger to update updated_at on project_questions
CREATE OR REPLACE FUNCTION update_project_questions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_project_questions_updated_at
BEFORE UPDATE ON project_questions
FOR EACH ROW
EXECUTE FUNCTION update_project_questions_updated_at();

-- Trigger to update updated_at on document_comments
CREATE OR REPLACE FUNCTION update_document_comments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_document_comments_updated_at
BEFORE UPDATE ON document_comments
FOR EACH ROW
EXECUTE FUNCTION update_document_comments_updated_at();

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- Enable RLS on new tables
ALTER TABLE project_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_notification_preferences ENABLE ROW LEVEL SECURITY;

-- Q&A Policies: Anyone can read, authenticated users can create
CREATE POLICY "Anyone can view project questions"
  ON project_questions FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can ask questions"
  ON project_questions FOR INSERT
  WITH CHECK (auth.uid() = asked_by);

CREATE POLICY "Anyone can view answers"
  ON question_answers FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can answer"
  ON question_answers FOR INSERT
  WITH CHECK (auth.uid() = answered_by);

-- Comments Policies: Team members can view/create
CREATE POLICY "Team members can view comments"
  ON document_comments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM document_collaborators dc
      WHERE dc.document_id = document_comments.document_id
      AND dc.user_id = auth.uid()
    )
  );

CREATE POLICY "Team members can create comments"
  ON document_comments FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM document_collaborators dc
      WHERE dc.document_id = document_comments.document_id
      AND dc.user_id = auth.uid()
    )
  );

-- Contract Policies: Project participants can view
CREATE POLICY "Project participants can view contracts"
  ON contracts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = contracts.project_id
      AND (p.client_id = auth.uid() OR EXISTS (
        SELECT 1 FROM proposals pr
        WHERE pr.project_id = p.id
        AND pr.lead_id = auth.uid()
      ))
    )
  );

-- Notification Preferences: Users can manage their own
CREATE POLICY "Users can manage their notification preferences"
  ON user_notification_preferences
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- SEED DATA
-- ============================================================================

-- Insert default notification preferences for existing users
INSERT INTO user_notification_preferences (user_id)
SELECT id FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

COMMENT ON TABLE project_questions IS 'Q&A system for project clarifications';
COMMENT ON TABLE question_answers IS 'Answers to project questions';
COMMENT ON TABLE document_comments IS 'Internal and external comments on documents';
COMMENT ON TABLE contracts IS 'Generated contracts for accepted proposals';
COMMENT ON TABLE contract_templates IS 'Reusable contract templates';
COMMENT ON TABLE platform_metrics IS 'Cached analytics metrics for performance';
