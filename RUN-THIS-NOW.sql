-- ============================================================
-- IMMEDIATE FIX: Run this to fix proposal submission
-- ============================================================

BEGIN;

-- 1. Drop the deprecated table
DROP TABLE IF EXISTS public.bid_team_members CASCADE;

-- 2. Drop old functions
DROP FUNCTION IF EXISTS public.is_project_lead(UUID, UUID);
DROP FUNCTION IF EXISTS public.is_team_member(UUID, UUID);

-- 3. Ensure proposal_performance table exists
CREATE TABLE IF NOT EXISTS public.proposal_performance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    proposal_id UUID NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
    time_to_submit INTERVAL,
    team_size INT,
    sections_count INT,
    documents_count INT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT proposal_performance_team_size_positive CHECK (team_size >= 0),
    CONSTRAINT proposal_performance_sections_positive CHECK (sections_count >= 0),
    CONSTRAINT proposal_performance_documents_positive CHECK (documents_count >= 0),
    UNIQUE(proposal_id)
);

-- 4. Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_proposal_performance_lead ON public.proposal_performance(lead_id);
CREATE INDEX IF NOT EXISTS idx_proposal_performance_proposal ON public.proposal_performance(proposal_id);
CREATE INDEX IF NOT EXISTS idx_proposal_performance_created ON public.proposal_performance(created_at DESC);

-- 5. Enable RLS
ALTER TABLE public.proposal_performance ENABLE ROW LEVEL SECURITY;

-- 6. Create RLS policies
DROP POLICY IF EXISTS "proposal_performance_lead_select" ON public.proposal_performance;
CREATE POLICY "proposal_performance_lead_select" ON public.proposal_performance
FOR SELECT USING (lead_id = auth.uid());

DROP POLICY IF EXISTS "proposal_performance_system_insert" ON public.proposal_performance;
CREATE POLICY "proposal_performance_system_insert" ON public.proposal_performance
FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "proposal_performance_system_update" ON public.proposal_performance;
CREATE POLICY "proposal_performance_system_update" ON public.proposal_performance
FOR UPDATE USING (true) WITH CHECK (true);

-- 7. Recreate the update function (using proposal_team_members)
CREATE OR REPLACE FUNCTION public.update_proposal_performance(p_proposal_id UUID)
RETURNS void AS $$
DECLARE
    v_lead_id UUID;
    v_team_size INT;
    v_sections_count INT;
    v_documents_count INT;
    v_time_to_submit INTERVAL;
    v_created_at TIMESTAMPTZ;
    v_submitted_at TIMESTAMPTZ;
BEGIN
    SELECT lead_id, created_at, submitted_at
    INTO v_lead_id, v_created_at, v_submitted_at
    FROM public.proposals
    WHERE id = p_proposal_id;
    
    IF v_submitted_at IS NOT NULL THEN
        v_time_to_submit := v_submitted_at - v_created_at;
    END IF;
    
    -- Use proposal_team_members (NOT bid_team_members)
    SELECT COUNT(DISTINCT user_id)
    INTO v_team_size
    FROM public.proposal_team_members
    WHERE proposal_id = p_proposal_id;
    
    SELECT COUNT(*)
    INTO v_sections_count
    FROM public.document_sections ds
    JOIN public.workspace_documents wd ON wd.id = ds.document_id
    JOIN public.workspaces w ON w.id = wd.workspace_id
    JOIN public.proposals p ON p.project_id = w.project_id
    WHERE p.id = p_proposal_id;
    
    SELECT COUNT(*)
    INTO v_documents_count
    FROM public.documents d
    WHERE d.proposal_id = p_proposal_id;
    
    INSERT INTO public.proposal_performance (
        lead_id,
        proposal_id,
        time_to_submit,
        team_size,
        sections_count,
        documents_count,
        updated_at
    )
    VALUES (
        v_lead_id,
        p_proposal_id,
        v_time_to_submit,
        v_team_size,
        v_sections_count,
        v_documents_count,
        NOW()
    )
    ON CONFLICT (proposal_id) DO UPDATE SET
        time_to_submit = EXCLUDED.time_to_submit,
        team_size = EXCLUDED.team_size,
        sections_count = EXCLUDED.sections_count,
        documents_count = EXCLUDED.documents_count,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Recreate the trigger
DROP TRIGGER IF EXISTS trigger_auto_update_proposal_performance ON public.proposals;

CREATE OR REPLACE FUNCTION public.auto_update_proposal_performance()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status != OLD.status AND NEW.status IN ('submitted', 'reviewing', 'approved', 'rejected') THEN
        PERFORM public.update_proposal_performance(NEW.id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_update_proposal_performance
    AFTER UPDATE ON public.proposals
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION public.auto_update_proposal_performance();

COMMIT;

-- Verification
SELECT 
    'bid_team_members table exists' as check_name,
    EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'bid_team_members'
    ) as result,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'bid_team_members')
        THEN '❌ STILL EXISTS - PROBLEM!'
        ELSE '✅ REMOVED'
    END as status

UNION ALL

SELECT 
    'proposal_team_members table exists' as check_name,
    EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'proposal_team_members'
    ) as result,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'proposal_team_members')
        THEN '✅ EXISTS'
        ELSE '❌ MISSING - PROBLEM!'
    END as status

UNION ALL

SELECT 
    'proposal_performance table exists' as check_name,
    EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'proposal_performance'
    ) as result,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'proposal_performance')
        THEN '✅ EXISTS'
        ELSE '❌ MISSING - PROBLEM!'
    END as status;
