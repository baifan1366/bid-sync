-- Test query to check proposals for user
SELECT 
  id,
  project_id,
  lead_id,
  status,
  created_at,
  submitted_at
FROM public.proposals
WHERE lead_id = 'dc7ac117-f4fa-492a-a7ad-44c0ebe74cbf';

-- Also check if there are ANY proposals
SELECT COUNT(*) as total_proposals FROM public.proposals;

-- Check projects
SELECT id, title, status FROM public.projects WHERE status = 'open';
