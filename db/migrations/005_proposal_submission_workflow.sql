-- ============================================================
-- PROPOSAL SUBMISSION WORKFLOW MIGRATION
-- ============================================================
-- This migration adds support for the proposal submission workflow,
-- including additional info requirements, submission drafts, and
-- enhanced proposal fields

-- ============================================================
-- 1. ADD ADDITIONAL_INFO_REQUIREMENTS TO PROJECTS TABLE
-- ============================================================

-- Add column to store client-specified additional information requirements
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS additional_info_requirements JSONB DEFAULT '[]'::jsonb;

-- Example structure:
-- [
--   {
--     "id": "uuid",
--     "fieldName": "Company Registration Number",
--     "fieldType": "text",
--     "required": true,
--     "helpText": "Please provide your official company registration number",
--     "options": ["option1", "option2"],  -- for select type
--     "order": 1
--   }
-- ]

COMMENT ON COLUMN public.projects.additional_info_requirements IS 'Client-specified additional information requirements for proposals in JSONB format';

-- ============================================================
-- 2. ADD PROPOSAL DETAIL FIELDS TO PROPOSALS TABLE
-- ============================================================

-- Add columns for enhanced proposal information
ALTER TABLE public.proposals 
ADD COLUMN IF NOT EXISTS title TEXT,
ADD COLUMN IF NOT EXISTS budget_estimate NUMERIC,
ADD COLUMN IF NOT EXISTS timeline_estimate TEXT,
ADD COLUMN IF NOT EXISTS executive_summary TEXT;

COMMENT ON COLUMN public.proposals.title IS 'Proposal title provided during submission';
COMMENT ON COLUMN public.proposals.budget_estimate IS 'Budget estimate for the proposal';
COMMENT ON COLUMN public.proposals.timeline_estimate IS 'Timeline estimate for project completion';
COMMENT ON COLUMN public.proposals.executive_summary IS 'Executive summary of the proposal';

-- ============================================================
-- 3. CREATE PROPOSAL_ADDITIONAL_INFO TABLE
-- ============================================================

-- Table to store responses to client-specified additional info requirements
CREATE TABLE IF NOT EXISTS public.proposal_additional_info (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proposal_id UUID NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
    field_id TEXT NOT NULL,
    field_name TEXT NOT NULL,
    field_value JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (proposal_id, field_id),
    CONSTRAINT proposal_additional_info_proposal_fk FOREIGN KEY (proposal_id) REFERENCES public.proposals(id)
);

COMMENT ON TABLE public.proposal_additional_info IS 'Stores responses to client-specified additional information requirements';
COMMENT ON COLUMN public.proposal_additional_info.field_id IS 'ID of the requirement field from projects.additional_info_requirements';
COMMENT ON COLUMN public.proposal_additional_info.field_name IS 'Name of the field for display purposes';
COMMENT ON COLUMN public.proposal_additional_info.field_value IS 'Value provided by the proposal lead, stored as JSONB for flexibility';

-- ============================================================
-- 4. CREATE SUBMISSION_DRAFTS TABLE
-- ============================================================

-- Table to store partial submission data when users exit the wizard
CREATE TABLE IF NOT EXISTS public.submission_drafts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proposal_id UUID NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    current_step INT NOT NULL DEFAULT 1,
    draft_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (proposal_id, user_id),
    CONSTRAINT submission_drafts_proposal_fk FOREIGN KEY (proposal_id) REFERENCES public.proposals(id),
    CONSTRAINT submission_drafts_user_fk FOREIGN KEY (user_id) REFERENCES auth.users(id)
);

COMMENT ON TABLE public.submission_drafts IS 'Stores partial submission data when users exit the submission wizard';
COMMENT ON COLUMN public.submission_drafts.current_step IS 'The step number where the user left off';
COMMENT ON COLUMN public.submission_drafts.draft_data IS 'Partial submission data in JSONB format';

-- ============================================================
-- 5. CREATE INDEXES FOR PERFORMANCE
-- ============================================================

-- Indexes for proposal_additional_info
CREATE INDEX IF NOT EXISTS idx_proposal_additional_info_proposal 
ON public.proposal_additional_info(proposal_id);

CREATE INDEX IF NOT EXISTS idx_proposal_additional_info_field 
ON public.proposal_additional_info(field_id);

-- Indexes for submission_drafts
CREATE INDEX IF NOT EXISTS idx_submission_drafts_proposal 
ON public.submission_drafts(proposal_id);

CREATE INDEX IF NOT EXISTS idx_submission_drafts_user 
ON public.submission_drafts(user_id);

CREATE INDEX IF NOT EXISTS idx_submission_drafts_updated 
ON public.submission_drafts(updated_at DESC);

-- Index for projects with additional requirements
CREATE INDEX IF NOT EXISTS idx_projects_additional_requirements 
ON public.projects USING GIN (additional_info_requirements);

-- Indexes for proposal fields to optimize queries
CREATE INDEX IF NOT EXISTS idx_proposals_title 
ON public.proposals(title);

CREATE INDEX IF NOT EXISTS idx_proposals_budget 
ON public.proposals(budget_estimate);

-- ============================================================
-- 6. ENABLE ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.proposal_additional_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submission_drafts ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 7. RLS POLICIES FOR PROPOSAL_ADDITIONAL_INFO
-- ============================================================

-- Clients can view additional info for proposals in their projects
CREATE POLICY "proposal_additional_info_client_select" ON public.proposal_additional_info
FOR SELECT
USING (
  proposal_id IN (
    SELECT p.id 
    FROM public.proposals p
    INNER JOIN public.projects proj ON proj.id = p.project_id
    WHERE proj.client_id = auth.uid()
  )
);

-- Proposal leads can view additional info for their proposals
CREATE POLICY "proposal_additional_info_lead_select" ON public.proposal_additional_info
FOR SELECT
USING (
  proposal_id IN (
    SELECT id FROM public.proposals WHERE lead_id = auth.uid()
  )
);

-- Team members can view additional info for their team's proposals
CREATE POLICY "proposal_additional_info_team_select" ON public.proposal_additional_info
FOR SELECT
USING (
  proposal_id IN (
    SELECT p.id 
    FROM public.proposals p
    INNER JOIN public.bid_team_members btm ON btm.project_id = p.project_id
    WHERE btm.user_id = auth.uid()
  )
);

-- Proposal leads can insert additional info for their proposals
CREATE POLICY "proposal_additional_info_lead_insert" ON public.proposal_additional_info
FOR INSERT
WITH CHECK (
  proposal_id IN (
    SELECT id FROM public.proposals WHERE lead_id = auth.uid()
  )
);

-- Proposal leads can update additional info for their proposals
CREATE POLICY "proposal_additional_info_lead_update" ON public.proposal_additional_info
FOR UPDATE
USING (
  proposal_id IN (
    SELECT id FROM public.proposals WHERE lead_id = auth.uid()
  )
);

-- Proposal leads can delete additional info for their proposals
CREATE POLICY "proposal_additional_info_lead_delete" ON public.proposal_additional_info
FOR DELETE
USING (
  proposal_id IN (
    SELECT id FROM public.proposals WHERE lead_id = auth.uid()
  )
);

-- ============================================================
-- 8. RLS POLICIES FOR SUBMISSION_DRAFTS
-- ============================================================

-- Users can view their own submission drafts
CREATE POLICY "submission_drafts_user_select" ON public.submission_drafts
FOR SELECT
USING (user_id = auth.uid());

-- Users can insert their own submission drafts
CREATE POLICY "submission_drafts_user_insert" ON public.submission_drafts
FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Users can update their own submission drafts
CREATE POLICY "submission_drafts_user_update" ON public.submission_drafts
FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Users can delete their own submission drafts
CREATE POLICY "submission_drafts_user_delete" ON public.submission_drafts
FOR DELETE
USING (user_id = auth.uid());

-- ============================================================
-- 9. HELPER FUNCTIONS
-- ============================================================

-- Function to get additional info requirements for a project
CREATE OR REPLACE FUNCTION public.get_project_requirements(p_project_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_requirements JSONB;
BEGIN
  SELECT additional_info_requirements INTO v_requirements
  FROM public.projects
  WHERE id = p_project_id;
  
  RETURN COALESCE(v_requirements, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.get_project_requirements IS 'Retrieves additional info requirements for a specific project';

-- Function to validate proposal submission readiness
CREATE OR REPLACE FUNCTION public.is_proposal_ready_for_submission(p_proposal_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_proposal RECORD;
  v_requirements JSONB;
  v_provided_fields JSONB;
  v_requirement JSONB;
  v_field_id TEXT;
  v_is_required BOOLEAN;
BEGIN
  -- Get proposal details
  SELECT p.*, proj.additional_info_requirements
  INTO v_proposal
  FROM public.proposals p
  INNER JOIN public.projects proj ON proj.id = p.project_id
  WHERE p.id = p_proposal_id;
  
  -- Check if basic proposal fields are filled
  IF v_proposal.title IS NULL OR 
     v_proposal.budget_estimate IS NULL OR 
     v_proposal.timeline_estimate IS NULL OR 
     v_proposal.executive_summary IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Get provided additional info fields
  SELECT jsonb_object_agg(field_id, field_value)
  INTO v_provided_fields
  FROM public.proposal_additional_info
  WHERE proposal_id = p_proposal_id;
  
  v_provided_fields := COALESCE(v_provided_fields, '{}'::jsonb);
  
  -- Check if all required additional info fields are provided
  FOR v_requirement IN SELECT * FROM jsonb_array_elements(v_proposal.additional_info_requirements)
  LOOP
    v_field_id := v_requirement->>'id';
    v_is_required := COALESCE((v_requirement->>'required')::BOOLEAN, false);
    
    IF v_is_required AND NOT (v_provided_fields ? v_field_id) THEN
      RETURN FALSE;
    END IF;
  END LOOP;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.is_proposal_ready_for_submission IS 'Checks if a proposal has all required fields filled for submission';

-- Function to clean up old submission drafts (for maintenance)
CREATE OR REPLACE FUNCTION public.cleanup_old_submission_drafts(days_old INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  DELETE FROM public.submission_drafts
  WHERE updated_at < NOW() - (days_old || ' days')::INTERVAL;
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.cleanup_old_submission_drafts IS 'Deletes submission drafts older than specified days (default 30)';

-- ============================================================
-- 10. TRIGGERS FOR UPDATED_AT TIMESTAMPS
-- ============================================================

-- Trigger function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to proposal_additional_info
DROP TRIGGER IF EXISTS update_proposal_additional_info_updated_at ON public.proposal_additional_info;
CREATE TRIGGER update_proposal_additional_info_updated_at
  BEFORE UPDATE ON public.proposal_additional_info
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Apply trigger to submission_drafts
DROP TRIGGER IF EXISTS update_submission_drafts_updated_at ON public.submission_drafts;
CREATE TRIGGER update_submission_drafts_updated_at
  BEFORE UPDATE ON public.submission_drafts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 11. ANALYZE TABLES FOR QUERY PLANNER
-- ============================================================

-- Update statistics for the query planner to use the new indexes effectively
ANALYZE public.projects;
ANALYZE public.proposals;
ANALYZE public.proposal_additional_info;
ANALYZE public.submission_drafts;

-- ============================================================
-- END OF MIGRATION
-- ============================================================
