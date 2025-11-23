-- Migration: Proposal Scoring System
-- Description: Creates tables, indexes, functions, and RLS policies for the proposal scoring/ranking system
-- Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6

-- ============================================================================
-- TABLES
-- ============================================================================

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

-- ============================================================================
-- INDEXES FOR PERFORMANCE OPTIMIZATION
-- ============================================================================

-- Scoring Templates indexes
CREATE INDEX IF NOT EXISTS idx_scoring_templates_project_id 
    ON public.scoring_templates(project_id);
CREATE INDEX IF NOT EXISTS idx_scoring_templates_created_by 
    ON public.scoring_templates(created_by);

-- Scoring Criteria indexes
CREATE INDEX IF NOT EXISTS idx_scoring_criteria_template_id 
    ON public.scoring_criteria(template_id);
CREATE INDEX IF NOT EXISTS idx_scoring_criteria_template_order 
    ON public.scoring_criteria(template_id, order_index);

-- Proposal Scores indexes
CREATE INDEX IF NOT EXISTS idx_proposal_scores_proposal_id 
    ON public.proposal_scores(proposal_id);
CREATE INDEX IF NOT EXISTS idx_proposal_scores_criterion_id 
    ON public.proposal_scores(criterion_id);
CREATE INDEX IF NOT EXISTS idx_proposal_scores_proposal_final 
    ON public.proposal_scores(proposal_id, is_final);
CREATE INDEX IF NOT EXISTS idx_proposal_scores_scored_by 
    ON public.proposal_scores(scored_by);

-- Proposal Score History indexes
CREATE INDEX IF NOT EXISTS idx_proposal_score_history_proposal_id 
    ON public.proposal_score_history(proposal_id);
CREATE INDEX IF NOT EXISTS idx_proposal_score_history_criterion_id 
    ON public.proposal_score_history(criterion_id);
CREATE INDEX IF NOT EXISTS idx_proposal_score_history_changed_at 
    ON public.proposal_score_history(changed_at DESC);

-- Proposal Rankings indexes
CREATE INDEX IF NOT EXISTS idx_proposal_rankings_project_id 
    ON public.proposal_rankings(project_id);
CREATE INDEX IF NOT EXISTS idx_proposal_rankings_proposal_id 
    ON public.proposal_rankings(proposal_id);
CREATE INDEX IF NOT EXISTS idx_proposal_rankings_project_score 
    ON public.proposal_rankings(project_id, total_score DESC);
CREATE INDEX IF NOT EXISTS idx_proposal_rankings_project_rank 
    ON public.proposal_rankings(project_id, rank);

-- ============================================================================
-- DATABASE FUNCTIONS
-- ============================================================================

-- Function: Calculate total score for a proposal
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
$$ LANGUAGE plpgsql STABLE;

-- Function: Recalculate rankings for a project
CREATE OR REPLACE FUNCTION public.recalculate_project_rankings(p_project_id UUID)
RETURNS void AS $$
BEGIN
  -- Delete existing rankings for this project
  DELETE FROM public.proposal_rankings WHERE project_id = p_project_id;
  
  -- Insert new rankings
  INSERT INTO public.proposal_rankings (
    project_id, 
    proposal_id, 
    total_score, 
    rank, 
    is_fully_scored, 
    calculated_at
  )
  SELECT 
    p_project_id,
    p.id,
    public.calculate_proposal_total_score(p.id) as total_score,
    ROW_NUMBER() OVER (
      ORDER BY 
        public.calculate_proposal_total_score(p.id) DESC,
        p.created_at ASC
    ) as rank,
    (
      SELECT 
        CASE 
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
  WHERE p.project_id = p_project_id
  ORDER BY total_score DESC, p.created_at ASC;
END;
$$ LANGUAGE plpgsql;

-- Function: Check if proposal scoring is locked
CREATE OR REPLACE FUNCTION public.is_proposal_scoring_locked(p_proposal_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_status TEXT;
BEGIN
  SELECT status INTO v_status 
  FROM public.proposals 
  WHERE id = p_proposal_id;
  
  RETURN v_status IN ('approved', 'rejected', 'accepted');
END;
$$ LANGUAGE plpgsql STABLE;

-- Function: Calculate average scoring duration
CREATE OR REPLACE FUNCTION public.calculate_average_scoring_duration(
  p_date_from TIMESTAMPTZ,
  p_date_to TIMESTAMPTZ
)
RETURNS NUMERIC AS $
DECLARE
  v_avg_duration NUMERIC;
BEGIN
  -- Calculate average time from first score to finalization (in hours)
  WITH scoring_sessions AS (
    SELECT 
      proposal_id,
      MIN(scored_at) as first_score,
      MAX(scored_at) FILTER (WHERE is_final = true) as finalized_at
    FROM public.proposal_scores
    WHERE scored_at >= p_date_from 
      AND scored_at <= p_date_to
      AND is_final = true
    GROUP BY proposal_id
    HAVING MAX(scored_at) FILTER (WHERE is_final = true) IS NOT NULL
  )
  SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (finalized_at - first_score)) / 3600), 0)
  INTO v_avg_duration
  FROM scoring_sessions;
  
  RETURN ROUND(v_avg_duration, 2);
END;
$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.scoring_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scoring_criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_score_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_rankings ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- SCORING TEMPLATES POLICIES
-- ============================================================================

-- Clients can manage templates for their own projects
CREATE POLICY "clients_manage_own_templates" ON public.scoring_templates
  FOR ALL 
  USING (
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

-- Admins can view all templates
CREATE POLICY "admins_view_all_templates" ON public.scoring_templates
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================================================
-- SCORING CRITERIA POLICIES
-- ============================================================================

-- Clients can manage criteria for their own project templates
CREATE POLICY "clients_manage_own_criteria" ON public.scoring_criteria
  FOR ALL
  USING (
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

-- Admins can view all criteria
CREATE POLICY "admins_view_all_criteria" ON public.scoring_criteria
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================================================
-- PROPOSAL SCORES POLICIES
-- ============================================================================

-- Clients can manage scores for proposals in their projects
CREATE POLICY "clients_score_own_projects" ON public.proposal_scores
  FOR ALL
  USING (
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

-- Leads can view scores for their own proposals (but not notes)
CREATE POLICY "leads_view_own_scores" ON public.proposal_scores
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.proposals pr
      WHERE pr.id = proposal_scores.proposal_id
      AND pr.lead_id = auth.uid()
    )
  );

-- Admins can view all scores
CREATE POLICY "admins_view_all_scores" ON public.proposal_scores
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================================================
-- PROPOSAL SCORE HISTORY POLICIES
-- ============================================================================

-- Clients can view history for their own projects
CREATE POLICY "clients_view_own_history" ON public.proposal_score_history
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.proposals pr
      JOIN public.projects p ON pr.project_id = p.id
      WHERE pr.id = proposal_score_history.proposal_id
      AND p.client_id = auth.uid()
    )
  );

-- System can insert history records
CREATE POLICY "system_insert_history" ON public.proposal_score_history
  FOR INSERT
  WITH CHECK (true);

-- Admins can view all history
CREATE POLICY "admins_view_all_history" ON public.proposal_score_history
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================================================
-- PROPOSAL RANKINGS POLICIES
-- ============================================================================

-- Clients can view rankings for their own projects
CREATE POLICY "clients_view_own_rankings" ON public.proposal_rankings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = proposal_rankings.project_id
      AND p.client_id = auth.uid()
    )
  );

-- Leads can view their own proposal ranking
CREATE POLICY "leads_view_own_ranking" ON public.proposal_rankings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.proposals pr
      WHERE pr.id = proposal_rankings.proposal_id
      AND pr.lead_id = auth.uid()
    )
  );

-- System can manage rankings
CREATE POLICY "system_manage_rankings" ON public.proposal_rankings
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Admins can view all rankings
CREATE POLICY "admins_view_all_rankings" ON public.proposal_rankings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Trigger: Update updated_at timestamp on scoring_templates
CREATE OR REPLACE FUNCTION public.update_scoring_template_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_scoring_template_updated_at
  BEFORE UPDATE ON public.scoring_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_scoring_template_updated_at();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE public.scoring_templates IS 'Stores scoring templates for projects with customizable criteria';
COMMENT ON TABLE public.scoring_criteria IS 'Individual scoring criteria within a template with weights';
COMMENT ON TABLE public.proposal_scores IS 'Scores assigned to proposals for each criterion';
COMMENT ON TABLE public.proposal_score_history IS 'Audit trail of all score changes';
COMMENT ON TABLE public.proposal_rankings IS 'Calculated rankings of proposals within a project';

COMMENT ON FUNCTION public.calculate_proposal_total_score(UUID) IS 'Calculates the total weighted score for a proposal';
COMMENT ON FUNCTION public.recalculate_project_rankings(UUID) IS 'Recalculates and updates rankings for all proposals in a project';
COMMENT ON FUNCTION public.is_proposal_scoring_locked(UUID) IS 'Checks if a proposal is locked from scoring changes';
