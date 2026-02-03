-- 检查这个proposal的所有数据
SELECT 
    id,
    project_id,
    lead_id,
    status,
    title,
    budget_estimate,
    timeline_estimate,
    executive_summary,
    submitted_at,
    created_at,
    updated_at
FROM proposals
WHERE id = '09cf9719-f83a-419e-b2df-5b2e9a35e6bb';

-- 检查proposals表的列结构
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'proposals'
  AND column_name IN ('budget_estimate', 'timeline_estimate', 'executive_summary', 'title')
ORDER BY ordinal_position;

-- 检查所有proposals，看哪些有budget数据
SELECT 
    id,
    title,
    budget_estimate,
    timeline_estimate,
    status,
    submitted_at
FROM proposals
ORDER BY created_at DESC
LIMIT 10;

-- 检查proposal_versions表中是否存储了budget信息
SELECT 
    pv.id,
    pv.proposal_id,
    pv.version_number,
    pv.content::text as content_preview,
    pv.created_at
FROM proposal_versions pv
WHERE pv.proposal_id = '09cf9719-f83a-419e-b2df-5b2e9a35e6bb'
ORDER BY pv.version_number DESC
LIMIT 3;
