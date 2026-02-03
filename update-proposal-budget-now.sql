-- 立即更新这个proposal的budget和timeline数据
UPDATE proposals
SET 
  budget_estimate = 100,
  timeline_estimate = '2 weeks',
  executive_summary = 'This is a test proposal with budget and timeline information.',
  title = COALESCE(title, 'Proposal'),
  updated_at = NOW()
WHERE id = '09cf9719-f83a-419e-b2df-5b2e9a35e6bb';

-- 验证更新
SELECT 
    id,
    title,
    budget_estimate,
    timeline_estimate,
    executive_summary,
    status,
    updated_at
FROM proposals
WHERE id = '09cf9719-f83a-419e-b2df-5b2e9a35e6bb';

-- 如果上面的proposal不存在，更新另一个
UPDATE proposals
SET 
  budget_estimate = 100,
  timeline_estimate = '2 weeks',
  executive_summary = 'This is a test proposal with budget and timeline information.',
  title = COALESCE(title, 'Proposal'),
  updated_at = NOW()
WHERE id = '005a5a78-1dc3-48ce-b90d-4609e5e32b70';

-- 验证第二个proposal
SELECT 
    id,
    title,
    budget_estimate,
    timeline_estimate,
    executive_summary,
    status,
    updated_at
FROM proposals
WHERE id = '005a5a78-1dc3-48ce-b90d-4609e5e32b70';

-- 查看所有proposals的budget状态
SELECT 
    id,
    title,
    budget_estimate,
    timeline_estimate,
    status,
    submitted_at,
    created_at
FROM proposals
ORDER BY created_at DESC;
