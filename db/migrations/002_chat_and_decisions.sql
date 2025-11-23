-- ============================================================
-- CHAT AND DECISIONS MIGRATION
-- ============================================================
-- This migration adds support for chat messages and proposal decisions
-- for the Client Decision Page feature

-- ============================================================
-- 1. CHAT MESSAGES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  proposal_id UUID REFERENCES public.proposals(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  read BOOLEAN DEFAULT FALSE,
  CONSTRAINT chat_messages_project_fk FOREIGN KEY (project_id) REFERENCES public.projects(id),
  CONSTRAINT chat_messages_proposal_fk FOREIGN KEY (proposal_id) REFERENCES public.proposals(id),
  CONSTRAINT chat_messages_sender_fk FOREIGN KEY (sender_id) REFERENCES auth.users(id)
);

-- ============================================================
-- 2. PROPOSAL DECISIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.proposal_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  decision_type VARCHAR(20) NOT NULL CHECK (decision_type IN ('accepted', 'rejected')),
  decided_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  decided_at TIMESTAMPTZ DEFAULT now(),
  feedback TEXT,
  CONSTRAINT proposal_decisions_proposal_fk FOREIGN KEY (proposal_id) REFERENCES public.proposals(id),
  CONSTRAINT proposal_decisions_project_fk FOREIGN KEY (project_id) REFERENCES public.projects(id),
  CONSTRAINT proposal_decisions_decided_by_fk FOREIGN KEY (decided_by) REFERENCES auth.users(id)
);

-- ============================================================
-- 3. INDEXES FOR PERFORMANCE
-- ============================================================
-- Chat messages indexes
CREATE INDEX IF NOT EXISTS idx_chat_messages_project ON public.chat_messages(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_proposal ON public.chat_messages(proposal_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_unread ON public.chat_messages(sender_id, read) WHERE read = FALSE;

-- Proposal decisions indexes
CREATE INDEX IF NOT EXISTS idx_proposal_decisions_proposal ON public.proposal_decisions(proposal_id);
CREATE INDEX IF NOT EXISTS idx_proposal_decisions_project ON public.proposal_decisions(project_id);

-- ============================================================
-- 4. ENABLE ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposal_decisions ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 5. RLS POLICIES FOR CHAT_MESSAGES
-- ============================================================

-- Clients can view messages for their projects
CREATE POLICY "chat_messages_client_select" ON public.chat_messages
FOR SELECT
USING (
  project_id IN (
    SELECT id FROM public.projects WHERE client_id = auth.uid()
  )
);

-- Clients can send messages for their projects
CREATE POLICY "chat_messages_client_insert" ON public.chat_messages
FOR INSERT
WITH CHECK (
  sender_id = auth.uid() AND
  project_id IN (
    SELECT id FROM public.projects WHERE client_id = auth.uid()
  )
);

-- Bidding team members can view messages for their proposals
CREATE POLICY "chat_messages_team_select" ON public.chat_messages
FOR SELECT
USING (
  proposal_id IN (
    SELECT p.id 
    FROM public.proposals p
    INNER JOIN public.bid_team_members btm ON btm.project_id = p.project_id
    WHERE btm.user_id = auth.uid()
  )
);

-- Bidding team members can send messages for their proposals
CREATE POLICY "chat_messages_team_insert" ON public.chat_messages
FOR INSERT
WITH CHECK (
  sender_id = auth.uid() AND
  proposal_id IN (
    SELECT p.id 
    FROM public.proposals p
    INNER JOIN public.bid_team_members btm ON btm.project_id = p.project_id
    WHERE btm.user_id = auth.uid()
  )
);

-- Users can update their own messages (for marking as read)
CREATE POLICY "chat_messages_update_own" ON public.chat_messages
FOR UPDATE
USING (sender_id = auth.uid())
WITH CHECK (sender_id = auth.uid());

-- Recipients can mark messages as read
CREATE POLICY "chat_messages_mark_read" ON public.chat_messages
FOR UPDATE
USING (
  -- Client can mark messages in their projects as read
  (project_id IN (SELECT id FROM public.projects WHERE client_id = auth.uid()))
  OR
  -- Team members can mark messages in their proposals as read
  (proposal_id IN (
    SELECT p.id 
    FROM public.proposals p
    INNER JOIN public.bid_team_members btm ON btm.project_id = p.project_id
    WHERE btm.user_id = auth.uid()
  ))
);

-- ============================================================
-- 6. RLS POLICIES FOR PROPOSAL_DECISIONS
-- ============================================================

-- Clients can view decisions for their projects
CREATE POLICY "proposal_decisions_client_select" ON public.proposal_decisions
FOR SELECT
USING (
  project_id IN (
    SELECT id FROM public.projects WHERE client_id = auth.uid()
  )
);

-- Clients can create decisions for their projects
CREATE POLICY "proposal_decisions_client_insert" ON public.proposal_decisions
FOR INSERT
WITH CHECK (
  decided_by = auth.uid() AND
  project_id IN (
    SELECT id FROM public.projects WHERE client_id = auth.uid()
  )
);

-- Bidding team members can view decisions for their proposals
CREATE POLICY "proposal_decisions_team_select" ON public.proposal_decisions
FOR SELECT
USING (
  proposal_id IN (
    SELECT p.id 
    FROM public.proposals p
    INNER JOIN public.bid_team_members btm ON btm.project_id = p.project_id
    WHERE btm.user_id = auth.uid()
  )
);

-- ============================================================
-- END OF MIGRATION
-- ============================================================
