-- Add budget and timeline data to the test proposal
UPDATE proposals
SET 
  budget_estimate = 100,
  timeline_estimate = '2 weeks',
  executive_summary = 'This is a test proposal with budget and timeline information.'
WHERE id = '005a5a78-1dc3-48ce-b90d-4609e5e32b70';

-- Verify the update
SELECT 
  id,
  title,
  budget_estimate,
  timeline_estimate,
  executive_summary,
  status
FROM proposals
WHERE id = '005a5a78-1dc3-48ce-b90d-4609e5e32b70';

-- Optional: Update all submitted proposals that don't have budget/timeline data
-- Uncomment the following if you want to add sample data to all proposals
/*
UPDATE proposals
SET 
  budget_estimate = CASE 
    WHEN budget_estimate IS NULL THEN 5000 + (RANDOM() * 95000)::INTEGER
    ELSE budget_estimate
  END,
  timeline_estimate = CASE 
    WHEN timeline_estimate IS NULL THEN 
      CASE (RANDOM() * 4)::INTEGER
        WHEN 0 THEN '2 weeks'
        WHEN 1 THEN '1 month'
        WHEN 2 THEN '6 weeks'
        ELSE '3 months'
      END
    ELSE timeline_estimate
  END,
  executive_summary = CASE
    WHEN executive_summary IS NULL THEN 'Sample executive summary for this proposal.'
    ELSE executive_summary
  END
WHERE status IN ('submitted', 'reviewing', 'approved', 'rejected');
*/
