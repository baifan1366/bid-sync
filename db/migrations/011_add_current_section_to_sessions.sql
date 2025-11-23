-- ============================================================
-- Migration: Add current_section to collaboration_sessions
-- Description: Adds section-specific presence tracking
-- Requirements: 2.3 - Section-specific presence
-- ============================================================

-- Add current_section column to track which section a user is editing
ALTER TABLE public.collaboration_sessions
ADD COLUMN IF NOT EXISTS current_section TEXT;

-- Add index for efficient section-based queries
CREATE INDEX IF NOT EXISTS idx_collaboration_sessions_current_section
ON public.collaboration_sessions(document_id, current_section)
WHERE current_section IS NOT NULL;

-- Add comment
COMMENT ON COLUMN public.collaboration_sessions.current_section IS 'The section ID that the user is currently editing';
