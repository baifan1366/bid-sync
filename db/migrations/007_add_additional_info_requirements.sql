-- ============================================================
-- Migration: Add additional_info_requirements to projects table
-- ============================================================

-- Add JSONB column to store additional information requirements
ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS additional_info_requirements JSONB DEFAULT '[]'::jsonb;
