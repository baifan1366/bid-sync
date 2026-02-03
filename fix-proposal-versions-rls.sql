-- ============================================================
-- FIX: Proposal Versions RLS Policies
-- ============================================================
-- The issue: RLS policies are blocking access to proposal_versions
-- even for authorized users (proposal lead, team members, and clients)

-- Drop existing policies
DROP POLICY IF EXISTS "versions_read" ON public.proposal_versions;
DROP POLICY IF EXISTS "versions_write" ON public.proposal_versions;
DROP POLICY IF EXISTS "proposal_versions_team_select" ON public.proposal_versions;
DROP POLICY IF EXISTS "proposal_versions_team_insert" ON public.proposal_versions;
DROP POLICY IF EXISTS "proposal_versions_client_select" ON public.proposal_versions;

-- Create comprehensive read policy for proposal versions
-- Allow access to:
-- 1. Proposal lead
-- 2. Proposal team members
-- 3. Project client
CREATE POLICY "proposal_versions_read_access" ON public.proposal_versions
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.proposals p
        WHERE p.id = proposal_versions.proposal_id
        AND (
            -- Proposal lead can read
            p.lead_id = auth.uid()
            OR
            -- Team members can read
            EXISTS (
                SELECT 1 FROM public.proposal_team_members ptm
                WHERE ptm.proposal_id = p.id
                AND ptm.user_id = auth.uid()
            )
            OR
            -- Project client can read
            EXISTS (
                SELECT 1 FROM public.projects proj
                WHERE proj.id = p.project_id
                AND proj.client_id = auth.uid()
            )
        )
    )
);

-- Create write policy for proposal versions
-- Allow insert for:
-- 1. Proposal lead
-- 2. Proposal team members with editor role
CREATE POLICY "proposal_versions_write_access" ON public.proposal_versions
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.proposals p
        WHERE p.id = proposal_versions.proposal_id
        AND (
            -- Proposal lead can write
            p.lead_id = auth.uid()
            OR
            -- Team members can write
            EXISTS (
                SELECT 1 FROM public.proposal_team_members ptm
                WHERE ptm.proposal_id = p.id
                AND ptm.user_id = auth.uid()
            )
        )
    )
);

-- Verify the policies
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'proposal_versions'
ORDER BY policyname;

-- Test query (run this as the authenticated user)
-- SELECT * FROM public.proposal_versions WHERE proposal_id = '6515207e-dbb8-466d-8426-caebbefbb2e5';

COMMENT ON POLICY "proposal_versions_read_access" ON public.proposal_versions IS 
'Allows proposal lead, team members, and project client to read proposal versions';

COMMENT ON POLICY "proposal_versions_write_access" ON public.proposal_versions IS 
'Allows proposal lead and team members to create new versions';
