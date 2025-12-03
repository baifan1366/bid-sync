-- Migration: Add get_bid_performance function
-- This function is required for the performance analytics dashboard

CREATE OR REPLACE FUNCTION public.get_bid_performance(p_lead_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'totalProposals', COUNT(*),
        'submitted', COUNT(*) FILTER (WHERE status IN ('submitted', 'reviewing', 'approved', 'rejected')),
        'accepted', COUNT(*) FILTER (WHERE status = 'approved'),
        'rejected', COUNT(*) FILTER (WHERE status = 'rejected'),
        'winRate', CASE 
            WHEN COUNT(*) FILTER (WHERE status IN ('submitted', 'reviewing', 'approved', 'rejected')) > 0 
            THEN ROUND(
                (COUNT(*) FILTER (WHERE status = 'approved')::NUMERIC / 
                COUNT(*) FILTER (WHERE status IN ('submitted', 'reviewing', 'approved', 'rejected'))::NUMERIC) * 100, 
                2
            )
            ELSE 0
        END,
        'statusBreakdown', jsonb_build_object(
            'draft', COUNT(*) FILTER (WHERE status = 'draft'),
            'submitted', COUNT(*) FILTER (WHERE status = 'submitted'),
            'reviewing', COUNT(*) FILTER (WHERE status = 'reviewing'),
            'approved', COUNT(*) FILTER (WHERE status = 'approved'),
            'rejected', COUNT(*) FILTER (WHERE status = 'rejected')
        ),
        'averageTeamSize', COALESCE(ROUND(AVG(pp.team_size), 1), 0),
        'averageSectionsCount', COALESCE(ROUND(AVG(pp.sections_count), 1), 0),
        'averageTimeToSubmit', COALESCE(
            EXTRACT(EPOCH FROM AVG(pp.time_to_submit))::INT, 
            0
        )
    )
    INTO v_result
    FROM public.proposals p
    LEFT JOIN public.proposal_performance pp ON pp.proposal_id = p.id
    WHERE p.lead_id = p_lead_id;
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_bid_performance(UUID) TO authenticated;

COMMENT ON FUNCTION public.get_bid_performance IS 'Returns comprehensive bid performance metrics for a bidding lead';
