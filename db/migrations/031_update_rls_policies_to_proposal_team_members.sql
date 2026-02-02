-- ============================================================
-- MIGRATION 031: UPDATE RLS POLICIES TO USE proposal_team_members
-- ============================================================
-- 
-- This migration updates all RLS policies that reference the deprecated
-- bid_team_members table to use proposal_team_members instead.
--
-- IMPORTANT: Run this after migrations 029 and 030
-- ============================================================

BEGIN;

-- ============================================================
-- 1. UPDATE proposal_additional_info POLICIES
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
-- 2. UPDATE document_sections POLICIES
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

-- ============================================================
-- 3. UPDATE project_deliverables POLICIES (if table exists)
-- ============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'project_deliverables'
  ) THEN
    DROP POLICY IF EXISTS "project_deliverables_team_select" ON public.project_deliverables;
    DROP POLICY IF EXISTS "project_deliverables_team_insert" ON public.project_deliverables;
    DROP POLICY IF EXISTS "project_deliverables_team_update" ON public.project_deliverables;
    DROP POLICY IF EXISTS "project_deliverables_team_delete" ON public.project_deliverables;

    CREATE POLICY "project_deliverables_team_select" ON public.project_deliverables
    FOR SELECT USING (
      EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = project_deliverables.project_id
        AND (
          p.client_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.proposals prop
            INNER JOIN public.proposal_team_members ptm ON ptm.proposal_id = prop.id
            WHERE prop.project_id = p.id 
            AND ptm.user_id = auth.uid()
          )
        )
      )
    );

    CREATE POLICY "project_deliverables_team_insert" ON public.project_deliverables
    FOR INSERT WITH CHECK (
      uploaded_by = auth.uid()
      AND EXISTS (
        SELECT 1 FROM public.proposals prop
        INNER JOIN public.proposal_team_members ptm ON ptm.proposal_id = prop.id
        WHERE prop.project_id = project_deliverables.project_id 
        AND ptm.user_id = auth.uid()
      )
    );

    CREATE POLICY "project_deliverables_team_update" ON public.project_deliverables
    FOR UPDATE USING (
      EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = project_deliverables.project_id
        AND (
          p.client_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.proposals prop
            INNER JOIN public.proposal_team_members ptm ON ptm.proposal_id = prop.id
            WHERE prop.project_id = p.id 
            AND ptm.user_id = auth.uid()
          )
        )
      )
    );

    CREATE POLICY "project_deliverables_team_delete" ON public.project_deliverables
    FOR DELETE USING (
      EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = project_deliverables.project_id
        AND (
          p.client_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.proposals prop
            INNER JOIN public.proposal_team_members ptm ON ptm.proposal_id = prop.id
            WHERE prop.project_id = p.id 
            AND ptm.user_id = auth.uid()
          )
        )
      )
    );
    
    RAISE NOTICE 'Updated project_deliverables policies';
  ELSE
    RAISE NOTICE 'Skipping project_deliverables - table does not exist';
  END IF;
END $$;

-- ============================================================
-- 4. UPDATE project_completions POLICIES (if table exists)
-- ============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'project_completions'
  ) THEN
    DROP POLICY IF EXISTS "project_completions_team_insert" ON public.project_completions;
    DROP POLICY IF EXISTS "project_completions_team_select" ON public.project_completions;

    CREATE POLICY "project_completions_team_insert" ON public.project_completions
    FOR INSERT WITH CHECK (
      submitted_by = auth.uid()
      AND EXISTS (
        SELECT 1 FROM public.proposals prop
        INNER JOIN public.proposal_team_members ptm ON ptm.proposal_id = prop.id
        WHERE prop.project_id = project_completions.project_id
        AND ptm.user_id = auth.uid() 
        AND ptm.role = 'lead'
      )
    );

    CREATE POLICY "project_completions_team_select" ON public.project_completions
    FOR SELECT USING (
      EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = project_completions.project_id
        AND (
          p.client_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.proposals prop
            INNER JOIN public.proposal_team_members ptm ON ptm.proposal_id = prop.id
            WHERE prop.project_id = p.id 
            AND ptm.user_id = auth.uid()
          )
        )
      )
    );
    
    RAISE NOTICE 'Updated project_completions policies';
  ELSE
    RAISE NOTICE 'Skipping project_completions - table does not exist';
  END IF;
END $$;

-- ============================================================
-- 5. UPDATE completion_feedback POLICIES (if table exists)
-- ============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'completion_feedback'
  ) THEN
    DROP POLICY IF EXISTS "completion_feedback_team_select" ON public.completion_feedback;
    DROP POLICY IF EXISTS "completion_feedback_team_update" ON public.completion_feedback;

    CREATE POLICY "completion_feedback_team_select" ON public.completion_feedback
    FOR SELECT USING (
      EXISTS (
        SELECT 1 FROM public.project_completions pc
        INNER JOIN public.projects p ON p.id = pc.project_id
        WHERE pc.id = completion_feedback.completion_id
        AND (
          p.client_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.proposals prop
            INNER JOIN public.proposal_team_members ptm ON ptm.proposal_id = prop.id
            WHERE prop.project_id = p.id 
            AND ptm.user_id = auth.uid()
          )
        )
      )
    );

    CREATE POLICY "completion_feedback_team_update" ON public.completion_feedback
    FOR UPDATE USING (
      EXISTS (
        SELECT 1 FROM public.project_completions pc
        INNER JOIN public.projects p ON p.id = pc.project_id
        WHERE pc.id = completion_feedback.completion_id
        AND (
          p.client_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.proposals prop
            INNER JOIN public.proposal_team_members ptm ON ptm.proposal_id = prop.id
            WHERE prop.project_id = p.id 
            AND ptm.user_id = auth.uid()
          )
        )
      )
    );
    
    RAISE NOTICE 'Updated completion_feedback policies';
  ELSE
    RAISE NOTICE 'Skipping completion_feedback - table does not exist';
  END IF;
END $$;

-- ============================================================
-- 6. UPDATE completion_revisions POLICIES (if table exists)
-- ============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'completion_revisions'
  ) THEN
    DROP POLICY IF EXISTS "completion_revisions_team_select" ON public.completion_revisions;
    DROP POLICY IF EXISTS "completion_revisions_team_insert" ON public.completion_revisions;

    CREATE POLICY "completion_revisions_team_select" ON public.completion_revisions
    FOR SELECT USING (
      EXISTS (
        SELECT 1 FROM public.project_completions pc
        INNER JOIN public.proposals prop ON prop.project_id = pc.project_id
        INNER JOIN public.proposal_team_members ptm ON ptm.proposal_id = prop.id
        WHERE pc.id = completion_revisions.completion_id
        AND ptm.user_id = auth.uid()
      )
    );

    CREATE POLICY "completion_revisions_team_insert" ON public.completion_revisions
    FOR INSERT WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.project_completions pc
        INNER JOIN public.proposals prop ON prop.project_id = pc.project_id
        INNER JOIN public.proposal_team_members ptm ON ptm.proposal_id = prop.id
        WHERE pc.id = completion_revisions.completion_id
        AND ptm.user_id = auth.uid()
      )
    );
    
    RAISE NOTICE 'Updated completion_revisions policies';
  ELSE
    RAISE NOTICE 'Skipping completion_revisions - table does not exist';
  END IF;
END $$;

-- ============================================================
-- 7. UPDATE project_qa POLICIES (if table exists)
-- ============================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'project_qa'
  ) THEN
    DROP POLICY IF EXISTS "project_qa_team_select" ON public.project_qa;

    CREATE POLICY "project_qa_team_select" ON public.project_qa
    FOR SELECT USING (
      EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.id = project_qa.project_id
        AND (
          p.client_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.proposals prop
            INNER JOIN public.proposal_team_members ptm ON ptm.proposal_id = prop.id
            WHERE prop.project_id = p.id 
            AND ptm.user_id = auth.uid()
          )
        )
      )
    );
    
    RAISE NOTICE 'Updated project_qa policies';
  ELSE
    RAISE NOTICE 'Skipping project_qa - table does not exist';
  END IF;
END $$;

-- ============================================================
-- 8. REMOVE OLD bid_team_members POLICIES (if table and policies exist)
-- ============================================================

DO $$
DECLARE
    v_btm_exists BOOLEAN;
BEGIN
    -- Check if bid_team_members table exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'bid_team_members'
    ) INTO v_btm_exists;
    
    IF v_btm_exists THEN
        -- Drop old policies if they exist
        DROP POLICY IF EXISTS "bid_team_members_read" ON public.bid_team_members;
        DROP POLICY IF EXISTS "bid_team_members_lead_insert" ON public.bid_team_members;
        DROP POLICY IF EXISTS "bid_team_members_lead_delete" ON public.bid_team_members;
        
        RAISE NOTICE 'Removed old bid_team_members policies';
    ELSE
        RAISE NOTICE 'Skipping bid_team_members policy removal - table does not exist';
    END IF;
END $$;

COMMIT;

-- Success message
DO $$
BEGIN
    RAISE NOTICE '==============================================';
    RAISE NOTICE 'Migration 031 completed successfully!';
    RAISE NOTICE 'All RLS policies updated to use proposal_team_members.';
    RAISE NOTICE '==============================================';
END $$;

-- ============================================================
-- VERIFICATION QUERIES
-- ============================================================
-- Run these after migration to verify:
--
-- 1. Check for any remaining bid_team_members references in policies:
--    SELECT * FROM pg_policies 
--    WHERE definition LIKE '%bid_team_members%';
--    (Should return 0 rows)
--
-- 2. Verify new policies exist:
--    SELECT schemaname, tablename, policyname 
--    FROM pg_policies 
--    WHERE definition LIKE '%proposal_team_members%'
--    ORDER BY tablename, policyname;
--
-- 3. Test access as a team member:
--    -- Login as a team member and try to access proposal data
-- ============================================================
