# Budget数据问题完整诊断

## 问题现象
在comparison view中，`budgetEstimate`和`timelineEstimate`显示为`undefined`。

## 数据库结构确认

### ✅ proposals表确实有这些列
```sql
ALTER TABLE public.proposals 
ADD COLUMN IF NOT EXISTS budget_estimate NUMERIC,
ADD COLUMN IF NOT EXISTS timeline_estimate TEXT,
ADD COLUMN IF NOT EXISTS executive_summary TEXT;
```

位置：`db/bidsync.sql` 第685-687行

### ✅ 索引也已创建
```sql
CREATE INDEX IF NOT EXISTS idx_proposals_budget ON public.proposals(budget_estimate);
```

## 问题原因

有两个可能的原因：

### 1. 数据库中没有数据
这些列存在，但是这个特定的proposal行中，这些列的值是`NULL`。

### 2. 迁移没有运行
如果你的数据库是从旧版本迁移过来的，可能这个ALTER TABLE语句没有执行。

## 诊断步骤

### 步骤1：检查列是否存在
在你的数据库客户端运行：

```sql
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'proposals'
  AND column_name IN ('budget_estimate', 'timeline_estimate', 'executive_summary', 'title')
ORDER BY column_name;
```

**期望结果：**
```
column_name        | data_type | is_nullable
-------------------+-----------+-------------
budget_estimate    | numeric   | YES
executive_summary  | text      | YES
timeline_estimate  | text      | YES
title              | text      | YES
```

### 步骤2：检查数据是否存在
```sql
SELECT 
    id,
    title,
    budget_estimate,
    timeline_estimate,
    executive_summary,
    status
FROM proposals
WHERE id IN (
    '09cf9719-f83a-419e-b2df-5b2e9a35e6bb',
    '005a5a78-1dc3-48ce-b90d-4609e5e32b70'
);
```

**如果结果显示NULL：**
- 说明列存在，但是没有数据
- 需要运行UPDATE语句添加数据

**如果报错"column does not exist"：**
- 说明列不存在
- 需要运行ALTER TABLE语句

## 修复方案

### 方案A：列不存在（运行迁移）

如果步骤1显示列不存在，运行：

```sql
-- 添加缺失的列
ALTER TABLE public.proposals 
ADD COLUMN IF NOT EXISTS title TEXT,
ADD COLUMN IF NOT EXISTS budget_estimate NUMERIC,
ADD COLUMN IF NOT EXISTS timeline_estimate TEXT,
ADD COLUMN IF NOT EXISTS executive_summary TEXT;

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_proposals_budget ON public.proposals(budget_estimate);
```

### 方案B：列存在但没有数据（添加测试数据）

运行 `update-proposal-budget-now.sql` 文件：

```sql
UPDATE proposals
SET 
  budget_estimate = 100,
  timeline_estimate = '2 weeks',
  executive_summary = 'This is a test proposal with budget and timeline information.',
  title = COALESCE(title, 'Proposal'),
  updated_at = NOW()
WHERE id IN (
    '09cf9719-f83a-419e-b2df-5b2e9a35e6bb',
    '005a5a78-1dc3-48ce-b90d-4609e5e32b70'
);
```

### 方案C：批量更新所有proposals

如果你想给所有已提交的proposals添加默认数据：

```sql
UPDATE proposals
SET 
  budget_estimate = COALESCE(budget_estimate, 5000 + (RANDOM() * 95000)::INTEGER),
  timeline_estimate = COALESCE(timeline_estimate, 
    CASE (RANDOM() * 4)::INTEGER
      WHEN 0 THEN '2 weeks'
      WHEN 1 THEN '1 month'
      WHEN 2 THEN '6 weeks'
      ELSE '3 months'
    END
  ),
  executive_summary = COALESCE(executive_summary, 'Executive summary for this proposal.'),
  title = COALESCE(title, 'Proposal'),
  updated_at = NOW()
WHERE status IN ('submitted', 'reviewing', 'approved', 'rejected')
  AND (budget_estimate IS NULL OR timeline_estimate IS NULL);
```

## 验证修复

### 1. 在数据库中验证
```sql
SELECT 
    id,
    title,
    budget_estimate,
    timeline_estimate,
    status
FROM proposals
WHERE id = '09cf9719-f83a-419e-b2df-5b2e9a35e6bb';
```

应该看到：
```
budget_estimate: 100
timeline_estimate: 2 weeks
```

### 2. 重启开发服务器
```bash
# 停止服务器 (Ctrl+C)
# 重新启动
npm run dev
```

### 3. 清除浏览器缓存
按 `Ctrl+Shift+R` (Windows) 或 `Cmd+Shift+R` (Mac)

### 4. 检查服务器日志
在终端中查找：
```
[proposalDetail] Raw proposal from database: {
  budget_estimate: 100,
  timeline_estimate: '2 weeks',
  ...
}
```

### 5. 检查浏览器控制台
应该看到：
```javascript
[ProposalColumn] Proposal data: {
  budgetEstimate: 100,
  budgetEstimate_type: "number",
  timelineEstimate: "2 weeks",
  timelineEstimate_type: "string"
}
```

## 代码改进

我已经在resolver中添加了调试日志：

```typescript
// lib/graphql/resolvers.ts
console.log('[proposalDetail] Raw proposal from database:', {
  proposal_id: proposalId,
  budget_estimate: proposal?.budget_estimate,
  timeline_estimate: proposal?.timeline_estimate,
  ...
});
```

这将帮助你看到从数据库读取的原始数据。

## 快速修复命令

在你的数据库客户端（Supabase Dashboard, pgAdmin, DBeaver等）中运行：

```sql
-- 1. 确保列存在
ALTER TABLE public.proposals 
ADD COLUMN IF NOT EXISTS budget_estimate NUMERIC,
ADD COLUMN IF NOT EXISTS timeline_estimate TEXT,
ADD COLUMN IF NOT EXISTS executive_summary TEXT;

-- 2. 更新测试数据
UPDATE proposals
SET 
  budget_estimate = 100,
  timeline_estimate = '2 weeks',
  executive_summary = 'Test proposal with budget information.'
WHERE id = '09cf9719-f83a-419e-b2df-5b2e9a35e6bb';

-- 3. 验证
SELECT id, budget_estimate, timeline_estimate 
FROM proposals 
WHERE id = '09cf9719-f83a-419e-b2df-5b2e9a35e6bb';
```

## 下一步

运行完SQL后：
1. 重启dev server
2. 清除浏览器缓存
3. 刷新comparison view
4. 检查控制台日志
5. 验证显示 "$100" 和 "2 weeks"

## 相关文件

- `update-proposal-budget-now.sql` - 立即更新数据的SQL脚本
- `debug-proposal-data.sql` - 诊断数据的SQL脚本
- `lib/graphql/resolvers.ts` - 已添加调试日志
