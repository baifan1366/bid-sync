-- Migration: Add proposal_id to workspaces table
-- This creates a direct link between workspaces and proposals
-- Previously, workspaces were only linked via project_id and lead_id

-- Add proposal_id column to workspaces
ALTER TABLE workspaces 
ADD COLUMN IF NOT EXISTS proposal_id UUID REFERENCES proposals(id) ON DELETE CASCADE;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_workspaces_proposal_id ON workspaces(proposal_id);

-- Update existing workspaces to link them to their proposals
-- Match by project_id and lead_id
UPDATE workspaces w
SET proposal_id = p.id
FROM proposals p
WHERE w.project_id = p.project_id 
  AND w.lead_id = p.lead_id
  AND w.proposal_id IS NULL;

-- Add comment
COMMENT ON COLUMN workspaces.proposal_id IS 'Direct link to the proposal this workspace belongs to';
