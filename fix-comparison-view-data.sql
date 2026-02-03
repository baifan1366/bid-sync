-- 修复comparison view中显示的proposals的budget数据
-- 这个脚本会更新所有在decision页面显示的proposals

-- 1. 更新特定的proposals
UPDATE proposals
SET 
  budget_estimate = 100,
  timeline_estimate = '2 weeks',
  executive_summary = 'This is a test proposal with budget and timeline information.',
  title = COALESCE(title, 'Proposal'),
  updated_at = NOW()
WHERE id IN (
    'e1ab0abf-e1f3-4663-a87a-0c591f164fe1',
    '09cf9719-f83a-419e-b2df-5b2e9a35e6bb',
    '005a5a78-1dc3-48ce-b90d-4609e5e32b70'
);

-- 2. 验证更新
SELECT 
    id,
    title,
    budget_estimate,
    timeline_estimate,
    executive_summary,
    status,
    submitted_at
FROM proposals
WHERE id IN (
    'e1ab0abf-e1f3-4663-a87a-0c591f164fe1',
    '09cf9719-f83a-419e-b2df-5b2e9a35e6bb',
    '005a5a78-1dc3-48ce-b90d-4609e5e32b70'
)
ORDER BY created_at DESC;

-- 3. 查看project下的所有proposals
SELECT 
    p.id,
    p.title,
    p.budget_estimate,
    p.timeline_estimate,
    p.status,
    p.project_id,
    pr.title as project_title
FROM proposals p
JOIN projects pr ON p.project_id = pr.id
WHERE p.project_id = '624ccb8c-2806-404d-8be9-6a8e19d402b6'
ORDER BY p.created_at DESC;

-- 4. 如果需要，更新这个project下的所有proposals
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
    WHEN executive_summary IS NULL THEN 'Executive summary for this proposal.'
    ELSE executive_summary
  END,
  title = COALESCE(title, 'Proposal'),
  updated_at = NOW()
WHERE project_id = '624ccb8c-2806-404d-8be9-6a8e19d402b6'
  AND status IN ('submitted', 'under_review', 'reviewing', 'approved', 'rejected');
*/
