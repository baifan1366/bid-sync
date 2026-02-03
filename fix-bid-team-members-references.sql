-- ============================================================
-- FIX ALL bid_team_members REFERENCES
-- ============================================================
-- This script updates all remaining references to the deprecated
-- bid_team_members table to use proposal_team_members instead.
-- ============================================================

BEGIN;

-- ============================================================
-- 1. DROP OLD bid_team_members TABLE AND POLICIES
-- ============================================================

-- Drop policies first
DROP POLICY IF EXISTS "bid_team_members_read" ON public.bid_team_members;
DROP POLICY IF EXISTS "bid_team_members_lead_insert" ON public.bid_team_members;
DROP POLICY IF EXISTS "bid_team_members_lead_delete" ON public.bid_team_members;
DROP POLICY IF EXISTS "bid_team_members_admin_all" ON public.bid_team_members;

-- Drop functions that reference bid_team_members
DROP FUNCTION IF EXISTS public.is_project_lead(UUID, UUID);
DROP FUNCTION IF EXISTS public.is_team_member(UUID, UUID);

-- Drop the old table if it exists
DROP TABLE IF EXISTS public.bid_team_members CASCADE;

-- ============================================================
-- 2. CREATE NEW HELPER FUNCTIONS USING proposal_team_members
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_proposal_lead(p_proposal_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.proposal_team_members 
        WHERE proposal_id = p_proposal_id 
        AND user_id = p_user_id 
        AND role = 'lead'
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_proposal_team_member(p_proposal_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.proposal_team_members 
        WHERE proposal_id = p_proposal_id 
        AND user_id = p_user_id
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ============================================================
-- 3. UPDATE proposal_additional_info POLICIES
-- ============================================================

DROP POLICY IF EXISTS "proposal_additional_info_team_select" ON public.proposal_additional_info;

CREATE POLICY "proposal_additional_info_team_select" ON public.proposal_additional_info
FOR SELECT USING (
  proposal_id IN (
    SELECT ptm.proposal_id 
    FROM public.proposal_team_members ptm 
    WHERE ptm.user_id = auth.uid()
  )
);

-- ============================================================
-- 4. UPDATE document_sections POLICIES
-- ============================================================

DROP POLICY IF EXISTS "document_sections_team_select" ON public.document_sections;
DROP POLICY IF EXISTS "document_sections_team_update" ON public.document_sections;

CREATE POLICY "document_sections_team_select" ON public.document_sections
FOR SELECT USING (
  document_id IN (
    SELECT d.id FROM public.documents d
    INNER JOIN public.proposals p ON p.id = d.proposal_id
    WHERE p.lead_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.proposal_team_members ptm
      WHERE ptm.proposal_id = p.id
      AND ptm.user_id = auth.uid()
    )
  )
);

CREATE POLICY "document_sections_team_update" ON public.document_sections
FOR UPDATE USING (
  document_id IN (
    SELECT d.id FROM public.documents d
    INNER JOIN public.proposals p ON p.id = d.proposal_id
    WHERE p.lead_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.proposal_team_members ptm
      WHERE ptm.proposal_id = p.id
      AND ptm.user_id = auth.uid()
    )
  )
);

COMMIT;

-- ============================================================
-- VERIFICATION
-- ============================================================

-- Check for any remaining bid_team_members references
SELECT 
    'POLICY' as object_type,
    schemaname,
    tablename,
    policyname as object_name,
    definition
FROM pg_policies 
WHERE definition LIKE '%bid_team_members%'

UNION ALL

SELECT 
    'FUNCTION' as object_type,
    n.nspname as schemaname,
    '' as tablename,
    p.proname as object_name,
    pg_get_functiondef(p.oid) as definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE pg_get_functiondef(p.oid) LIKE '%bid_team_members%'
AND n.nspname = 'public';

-- Success message
DO $$
BEGIN
    RAISE NOTICE '==============================================';
    RAISE NOTICE 'Fixed all bid_team_members references!';
    RAISE NOTICE 'All policies now use proposal_team_members.';
    RAISE NOTICE '==============================================';
END $$;
