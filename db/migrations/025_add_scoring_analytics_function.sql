-- ============================================================
-- MIGRATION 025: ADD SCORING ANALYTICS FUNCTION
-- ============================================================
-- Creates the calculate_average_scoring_duration function for analytics

-- Calculate average scoring duration (from first score to last score for each proposal)
CREATE OR REPLACE FUNCTION public.calculate_average_scoring_duration(
    p_date_from TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
    p_date_to TIMESTAMPTZ DEFAULT NOW()
)
RETURNS NUMERIC AS $$
DECLARE
    v_avg_duration NUMERIC;
BEGIN
    -- Calculate average duration in hours between first and last score for each proposal
    SELECT COALESCE(AVG(duration_hours), 0)
    INTO v_avg_duration
    FROM (
        SELECT 
            proposal_id,
            EXTRACT(EPOCH FROM (MAX(scored_at) - MIN(scored_at))) / 3600 as duration_hours
        FROM public.proposal_scores
        WHERE scored_at BETWEEN p_date_from AND p_date_to
        GROUP BY proposal_id
        HAVING COUNT(*) > 1  -- Only include proposals with multiple scores
    ) scoring_durations;
    
    RETURN ROUND(v_avg_duration, 2);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.calculate_average_scoring_duration(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_average_scoring_duration(TIMESTAMPTZ, TIMESTAMPTZ) TO service_role;

COMMENT ON FUNCTION public.calculate_average_scoring_duration IS 'Calculates the average time (in hours) between first and last score for proposals within a date range';
