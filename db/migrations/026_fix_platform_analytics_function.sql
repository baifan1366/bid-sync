-- ============================================================
-- MIGRATION 026: FIX PLATFORM ANALYTICS FUNCTION
-- ============================================================
-- Fixes the calculate_platform_analytics function to use SECURITY DEFINER
-- and handle empty results properly

DROP FUNCTION IF EXISTS public.calculate_platform_analytics(TIMESTAMPTZ, TIMESTAMPTZ);

CREATE OR REPLACE FUNCTION public.calculate_platform_analytics(
    p_date_from TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days', 
    p_date_to TIMESTAMPTZ DEFAULT NOW()
)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
    user_growth JSONB;
    project_stats JSONB;
    proposal_stats JSONB;
BEGIN
    -- Get user growth data
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'date', date_trunc('day', created_at)::date, 
            'value', cnt
        ) ORDER BY day
    ), '[]'::jsonb)
    INTO user_growth
    FROM (
        SELECT date_trunc('day', created_at) as day, COUNT(*) as cnt
        FROM auth.users 
        WHERE created_at BETWEEN p_date_from AND p_date_to 
        GROUP BY date_trunc('day', created_at)
    ) t;

    -- Get project stats
    SELECT jsonb_build_object(
        'total', COUNT(*), 
        'pending', COUNT(*) FILTER (WHERE status = 'pending_review'), 
        'open', COUNT(*) FILTER (WHERE status = 'open'), 
        'closed', COUNT(*) FILTER (WHERE status = 'closed'), 
        'awarded', COUNT(*) FILTER (WHERE status = 'awarded')
    )
    INTO project_stats
    FROM public.projects 
    WHERE created_at BETWEEN p_date_from AND p_date_to;

    -- Get proposal stats
    SELECT jsonb_build_object(
        'total', COUNT(*), 
        'draft', COUNT(*) FILTER (WHERE status = 'draft'), 
        'submitted', COUNT(*) FILTER (WHERE status = 'submitted'), 
        'approved', COUNT(*) FILTER (WHERE status = 'approved'), 
        'rejected', COUNT(*) FILTER (WHERE status = 'rejected')
    )
    INTO proposal_stats
    FROM public.proposals 
    WHERE created_at BETWEEN p_date_from AND p_date_to;

    -- Build result
    result := jsonb_build_object(
        'userGrowth', COALESCE(user_growth, '[]'::jsonb),
        'projectStats', COALESCE(project_stats, jsonb_build_object('total', 0, 'pending', 0, 'open', 0, 'closed', 0, 'awarded', 0)),
        'proposalStats', COALESCE(proposal_stats, jsonb_build_object('total', 0, 'draft', 0, 'submitted', 0, 'approved', 0, 'rejected', 0))
    );

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.calculate_platform_analytics(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_platform_analytics(TIMESTAMPTZ, TIMESTAMPTZ) TO service_role;

COMMENT ON FUNCTION public.calculate_platform_analytics IS 'Calculates platform-wide analytics including user growth, project stats, and proposal stats';
