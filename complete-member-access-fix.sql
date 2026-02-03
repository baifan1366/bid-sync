-- Complete Member Access Fix
-- This script fixes all issues preventing members from seeing sections

-- ============================================================
-- STEP 1: DIAGNOSE THE ISSUE
-- ============================================================

-- Check the specific workspace
SELECT 
    'Current workspace state' as check_type,
    w.id as workspace_id,
    w.name,
    w.proposal_id as current_proposal_id,
    w.project_id,
    w.lead_id,
    p.id as proposal_exists,
    CASE 
        WHEN w.proposal_id IS NULL THEN '❌ Missing proposal_id'
        WHEN p.id IS NULL THEN '❌ Proposal does not exist (orphaned)'
        ELSE '✅ OK'
    END as status
FROM workspaces w
LEFT JOIN proposals p ON p.id = w.proposal_id
WHERE w.id = '45a99ca8-2066-44ff-b3e6-ea81588902e2';

-- Find the correct proposal for this workspace
SELECT 
    'Correct proposal lookup' as check_type,
    p.id as correct_proposal_id,
    p.title,
    p.status,
    w.id as workspace_id,
    w.proposal_id as current_wrong_proposal_id
FROM workspaces w
INNER JOIN proposals p ON p.project_id = w.project_id AND p.lead_id = w.lead_id
WHERE w.id = '45a99ca8-2066-44ff-b3e6-ea81588902e2';

-- ============================================================
-- STEP 2: FIX ORPHANED WORKSPACES
-- ============================================================

-- Update the specific workspace with correct proposal_id
UPDATE workspaces w
SET proposal_id = p.id,
    updated_at = NOW()
FROM proposals p
WHERE w.id = '45a99ca8-2066-44ff-b3e6-ea81588902e2'
  AND p.project_id = w.project_id
  AND p.lead_id = w.lead_id;

-- Fix all other orphaned workspaces
UPDATE workspaces w
SET proposal_id = p.id,
    updated_at = NOW()
FROM proposals p
WHERE (
    w.proposal_id IS NULL
    OR NOT EXISTS (SELECT 1 FROM proposals WHERE id = w.proposal_id)
)
AND p.project_id = w.project_id
AND p.lead_id = w.lead_id;

-- ============================================================
-- STEP 3: VERIFY THE FIX
-- ============================================================

SELECT 
    'After fix verification' as check_type,
    w.id as workspace_id,
    w.name,
    w.proposal_id,
    p.id as proposal_check,
    p.title,
    CASE 
        WHEN p.id IS NOT NULL THEN '✅ Fixed'
        ELSE '❌ Still broken'
    END as status
FROM workspaces w
LEFT JOIN proposals p ON p.id = w.proposal_id
WHERE w.id = '45a99ca8-2066-44ff-b3e6-ea81588902e2';

-- ============================================================
-- STEP 4: UPDATE RLS POLICIES FOR DOCUMENT_SECTIONS
-- ============================================================

-- Drop old policies
DROP POLICY IF EXISTS "document_sections_select" ON public.document_sections;
DROP POLICY IF EXISTS "document_sections_insert" ON public.document_sections;
DROP POLICY IF EXISTS "document_sections_update" ON public.document_sections;
DROP POLICY IF EXISTS "document_sections_delete" ON public.document_sections;

-- SELECT: Allow if user is a document collaborator OR a proposal team member
CREATE POLICY "document_sections_select" ON public.document_sections
FOR SELECT USING (
    -- Allow document collaborators
    EXISTS (
        SELECT 1 FROM public.document_collaborators dc 
        WHERE dc.document_id = document_sections.document_id 
        AND dc.user_id = auth.uid()
    )
    OR
    -- Allow proposal team members (using proposal_id for direct lookup)
    EXISTS (
        SELECT 1 FROM public.workspace_documents wd
        INNER JOIN public.workspaces w ON w.id = wd.workspace_id
        INNER JOIN public.proposal_team_members ptm ON ptm.proposal_id = w.proposal_id
        WHERE wd.id = document_sections.document_id
        AND w.proposal_id IS NOT NULL
        AND ptm.user_id = auth.uid()
    )
    OR
    -- Fallback for legacy workspaces without proposal_id
    EXISTS (
        SELECT 1 FROM public.workspace_documents wd
        INNER JOIN public.workspaces w ON w.id = wd.workspace_id
        INNER JOIN public.proposals p ON p.project_id = w.project_id AND p.lead_id = w.lead_id
        INNER JOIN public.proposal_team_members ptm ON ptm.proposal_id = p.id
        WHERE wd.id = document_sections.document_id
        AND w.proposal_id IS NULL
        AND ptm.user_id = auth.uid()
    )
);

-- INSERT: Allow if user is a document editor OR a proposal team member
CREATE POLICY "document_sections_insert" ON public.document_sections
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.document_collaborators dc 
        WHERE dc.document_id = document_sections.document_id 
        AND dc.user_id = auth.uid() 
        AND dc.role IN ('owner', 'editor')
    )
    OR
    EXISTS (
        SELECT 1 FROM public.workspace_documents wd
        INNER JOIN public.workspaces w ON w.id = wd.workspace_id
        INNER JOIN public.proposal_team_members ptm ON ptm.proposal_id = w.proposal_id
        WHERE wd.id = document_sections.document_id
        AND w.proposal_id IS NOT NULL
        AND ptm.user_id = auth.uid()
    )
    OR
    EXISTS (
        SELECT 1 FROM public.workspace_documents wd
        INNER JOIN public.workspaces w ON w.id = wd.workspace_id
        INNER JOIN public.proposals p ON p.project_id = w.project_id AND p.lead_id = w.lead_id
        INNER JOIN public.proposal_team_members ptm ON ptm.proposal_id = p.id
        WHERE wd.id = document_sections.document_id
        AND w.proposal_id IS NULL
        AND ptm.user_id = auth.uid()
    )
);

-- UPDATE: Allow if user is a document editor OR a proposal team member
CREATE POLICY "document_sections_update" ON public.document_sections
FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM public.document_collaborators dc 
        WHERE dc.document_id = document_sections.document_id 
        AND dc.user_id = auth.uid() 
        AND dc.role IN ('owner', 'editor')
    )
    OR
    EXISTS (
        SELECT 1 FROM public.workspace_documents wd
        INNER JOIN public.workspaces w ON w.id = wd.workspace_id
        INNER JOIN public.proposal_team_members ptm ON ptm.proposal_id = w.proposal_id
        WHERE wd.id = document_sections.document_id
        AND w.proposal_id IS NOT NULL
        AND ptm.user_id = auth.uid()
    )
    OR
    EXISTS (
        SELECT 1 FROM public.workspace_documents wd
        INNER JOIN public.workspaces w ON w.id = wd.workspace_id
        INNER JOIN public.proposals p ON p.project_id = w.project_id AND p.lead_id = w.lead_id
        INNER JOIN public.proposal_team_members ptm ON ptm.proposal_id = p.id
        WHERE wd.id = document_sections.document_id
        AND w.proposal_id IS NULL
        AND ptm.user_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.document_collaborators dc 
        WHERE dc.document_id = document_sections.document_id 
        AND dc.user_id = auth.uid() 
        AND dc.role IN ('owner', 'editor')
    )
    OR
    EXISTS (
        SELECT 1 FROM public.workspace_documents wd
        INNER JOIN public.workspaces w ON w.id = wd.workspace_id
        INNER JOIN public.proposal_team_members ptm ON ptm.proposal_id = w.proposal_id
        WHERE wd.id = document_sections.document_id
        AND w.proposal_id IS NOT NULL
        AND ptm.user_id = auth.uid()
    )
    OR
    EXISTS (
        SELECT 1 FROM public.workspace_documents wd
        INNER JOIN public.workspaces w ON w.id = wd.workspace_id
        INNER JOIN public.proposals p ON p.project_id = w.project_id AND p.lead_id = w.lead_id
        INNER JOIN public.proposal_team_members ptm ON ptm.proposal_id = p.id
        WHERE wd.id = document_sections.document_id
        AND w.proposal_id IS NULL
        AND ptm.user_id = auth.uid()
    )
);

-- DELETE: Allow if user is document owner OR proposal lead
CREATE POLICY "document_sections_delete" ON public.document_sections
FOR DELETE USING (
    EXISTS (
        SELECT 1 FROM public.document_collaborators dc 
        WHERE dc.document_id = document_sections.document_id 
        AND dc.user_id = auth.uid() 
        AND dc.role = 'owner'
    )
    OR
    EXISTS (
        SELECT 1 FROM public.workspace_documents wd
        INNER JOIN public.workspaces w ON w.id = wd.workspace_id
        INNER JOIN public.proposal_team_members ptm ON ptm.proposal_id = w.proposal_id
        WHERE wd.id = document_sections.document_id
        AND w.proposal_id IS NOT NULL
        AND ptm.user_id = auth.uid()
        AND ptm.role = 'lead'
    )
    OR
    EXISTS (
        SELECT 1 FROM public.workspace_documents wd
        INNER JOIN public.workspaces w ON w.id = wd.workspace_id
        INNER JOIN public.proposals p ON p.project_id = w.project_id AND p.lead_id = w.lead_id
        INNER JOIN public.proposal_team_members ptm ON ptm.proposal_id = p.id
        WHERE wd.id = document_sections.document_id
        AND w.proposal_id IS NULL
        AND ptm.user_id = auth.uid()
        AND ptm.role = 'lead'
    )
);

-- ============================================================
-- STEP 5: FINAL VERIFICATION
-- ============================================================

-- Show updated policies
SELECT 
    'RLS Policies' as check_type,
    schemaname,
    tablename,
    policyname,
    cmd
FROM pg_policies 
WHERE tablename = 'document_sections'
ORDER BY policyname, cmd;

-- Show sections for the document
SELECT 
    'Sections in document' as check_type,
    ds.id,
    ds.title,
    ds.assigned_to,
    ds.status,
    wd.id as document_id,
    w.id as workspace_id,
    w.proposal_id
FROM document_sections ds
INNER JOIN workspace_documents wd ON ds.document_id = wd.id
INNER JOIN workspaces w ON wd.workspace_id = w.id
WHERE w.id = '45a99ca8-2066-44ff-b3e6-ea81588902e2'
ORDER BY ds.order;

-- Summary
SELECT 
    '✅ FIX COMPLETE' as status,
    'Workspace proposal_id updated and RLS policies fixed' as message,
    'Please refresh the page to see sections' as next_step;
