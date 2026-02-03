-- 验证decision page显示的这些proposals的实际数据
-- 从截图看到的budget: MYR 199, MYR 339, MYR 100

-- 查询project下的所有proposals
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
WHERE project_id = '624ccb8c-2806-404d-8be9-6a8e19d402b6'
ORDER BY created_at DESC;

-- 查询特定的proposals（如果你知道ID）
SELECT 
    id,
    title,
    budget_estimate,
    timeline_estimate,
    executive_summary,
    status,
    lead_id
FROM proposals
WHERE id IN (
    'e1ab0abf-e1f3-4663-a87a-0c591f164fe1',
    '09cf9719-f83a-419e-b2df-5b2e9a35e6bb',
    '005a5a78-1dc3-48ce-b90d-4609e5e32b70'
);

-- 检查是否有budget_estimate = 199, 339, 100的proposals
SELECT 
    id,
    title,
    budget_estimate,
    timeline_estimate,
    status
FROM proposals
WHERE budget_estimate IN (199, 339, 100)
ORDER BY budget_estimate;
