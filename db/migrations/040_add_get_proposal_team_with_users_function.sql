-- ============================================================
-- MIGRATION 040: ADD GET_PROPOSAL_TEAM_WITH_USERS FUNCTION
-- ============================================================
-- 
-- PROBLEM: Cannot directly join proposal_team_members with auth.users
-- because auth.users is not in the public schema and Supabase REST API
-- doesn't support cross-schema foreign key relationships.
--
-- SOLUTION: Create an RPC function that returns team members with user info
-- ============================================================

BEGIN;

-- ============================================================
-- 1. CREATE FUNCTION TO GET PROPOSAL TEAM WITH USER INFO
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_proposal_team_with_users(p_proposal_id UUID)
RETURNS TABLE (
    id UUID,
    proposal_id UUID,
    user_id UUID,
    role TEXT,
    joined_at TIMESTAMPTZ,
    assigned_sections TEXT[],
    contribution_stats JSONB,
    user_email TEXT,
    user_name TEXT,
    user_role TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ptm.id,
        ptm.proposal_id,
        ptm.user_id,
        ptm.role,
        ptm.joined_at,
        ptm.assigned_sections,
        ptm.contribution_stats,
        u.email::TEXT as user_email,
        (u.raw_user_meta_data->>'name')::TEXT as user_name,
        (u.raw_user_meta_data->>'role')::TEXT as user_role
    FROM public.proposal_team_members ptm
    INNER JOIN auth.users u ON u.id = ptm.user_id
    WHERE ptm.proposal_id = p_proposal_id
    ORDER BY 
        CASE ptm.role 
            WHEN 'lead' THEN 1 
            WHEN 'member' THEN 2 
            ELSE 3 
        END,
        ptm.joined_at ASC;
END;
$$;

-- ============================================================
-- 2. GRANT EXECUTE PERMISSION
-- ============================================================

GRANT EXECUTE ON FUNCTION public.get_proposal_team_with_users(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_proposal_team_with_users(UUID) TO anon;

-- ============================================================
-- 3. ADD COMMENTS
-- ============================================================

COMMENT ON FUNCTION public.get_proposal_team_with_users IS 
'Returns proposal team members with user information from auth.users. 
Ordered by role (lead first) then by join date.
Accessible by authenticated users who can view the proposal.';

COMMIT;

-- Success message
DO $$
BEGIN
    RAISE NOTICE '==============================================';
    RAISE NOTICE 'Migration 040 completed successfully!';
    RAISE NOTICE 'Created get_proposal_team_with_users function.';
    RAISE NOTICE 'This function allows querying team members with user info.';
    RAISE NOTICE '==============================================';
END $$;

-- ============================================================
-- VERIFICATION QUERIES
-- ============================================================
-- Run these after migration to verify:
--
-- 1. Check function exists:
--    SELECT proname, proargnames, proargtypes 
--    FROM pg_proc 
--    WHERE proname = 'get_proposal_team_with_users';
--
-- 2. Test the function (replace with actual proposal_id):
--    SELECT * FROM get_proposal_team_with_users('your-proposal-id-here');
--
-- 3. Check permissions:
--    SELECT grantee, privilege_type 
--    FROM information_schema.routine_privileges 
--    WHERE routine_name = 'get_proposal_team_with_users';
-- ============================================================
