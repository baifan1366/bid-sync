-- Check if the proposal has budget and timeline data
SELECT 
  id,
  title,
  budget_estimate,
  timeline_estimate,
  executive_summary,
  status,
  submitted_at,
  created_at
FROM proposals
WHERE id = '005a5a78-1dc3-48ce-b90d-4609e5e32b70';

-- Check all proposals to see which ones have budget data
SELECT 
  id,
  title,
  budget_estimate,
  timeline_estimate,
  status
FROM proposals
ORDER BY created_at DESC
LIMIT 10;
