# 修复 Proposal Sections 显示相同内容的问题

## 问题描述

在 Client Decision Page 中，查看不同 proposals 的详情时，所有 proposals 在 "Sections" tab 中显示相同的内容。在 comparison 视图中也是比较相同的内容。

## 根本原因

虽然数据库中 `workspaces` 表已经有 `proposal_id` 列（通过 migration 044 添加），但问题是：

**多个 proposals 可能共享同一个 workspace**

Migration 044 只是添加了 `proposal_id` 列并更新了现有的 workspaces，但如果一个 project 有多个 proposals，只有第一个 proposal 会被关联到现有的 workspace，其他 proposals 没有自己的 workspace。

### 数据流程问题

```
Project A
  ├─ Proposal 1 → Workspace 1 (有 proposal_id)
  ├─ Proposal 2 → ❌ 没有 workspace
  └─ Proposal 3 → ❌ 没有 workspace

当查询 Proposal 2 或 3 时：
  → resolver 找不到 workspace (proposal_id = proposal_2_id)
  → 回退到使用 project_id 查询
  → 找到 Workspace 1
  → 显示 Workspace 1 的 sections
  → 结果：所有 proposals 显示相同内容
```

## 解决方案

### 步骤 1: 诊断问题

运行诊断脚本查看当前状态：

```bash
# 在 Supabase SQL Editor 中执行
```

复制 `DIAGNOSE-WORKSPACE-PROPOSAL-MAPPING.sql` 的内容并执行。

这会显示：
- 每个 project 有多少个 proposals
- 哪些 proposals 有专属的 workspace
- 哪些 proposals 没有 workspace
- 哪些 sections 被多个 proposals 共享

### 步骤 2: 创建专属 Workspaces

运行修复脚本：

```bash
# 在 Supabase SQL Editor 中执行
```

复制 `CREATE-DEDICATED-WORKSPACES-FOR-PROPOSALS.sql` 的内容并执行。

这个脚本会：
1. 找到所有没有专属 workspace 的 proposals
2. 为每个 proposal 创建新的 workspace
3. 从同一 project 的现有 workspace 复制 documents 和 sections
4. 验证所有 proposals 都有自己的 workspace

### 步骤 3: 验证修复

执行后，脚本会自动显示验证结果：

```sql
✅ SUCCESS: All proposals now have dedicated workspaces!
```

### 步骤 4: 测试应用

1. 重启 Next.js 应用（如果需要）
2. 登录为 client
3. 进入一个有多个 proposals 的 project
4. 点击不同的 proposals 查看详情
5. 验证每个 proposal 的 "Sections" tab 显示不同的内容
6. 使用 comparison 功能比较多个 proposals
7. 验证比较的内容是不同的

## 代码更改

GraphQL resolver 已经更新（`lib/graphql/resolvers.ts`）：

```typescript
// 优先使用 proposal_id 查询 workspace
const { data: proposalWorkspaces } = await supabase
  .from('workspaces')
  .select('id')
  .eq('proposal_id', proposalId)  // ✅ 每个 proposal 有自己的 workspace
  .limit(1);

// 回退逻辑（向后兼容）
if (!proposalWorkspaces || proposalWorkspaces.length === 0) {
  const { data: projectWorkspaces } = await supabase
    .from('workspaces')
    .select('id')
    .eq('project_id', proposal.project_id)
    .limit(1);
  workspace = projectWorkspaces?.[0];
}
```

## 预期结果

修复后：

```
Project A
  ├─ Proposal 1 → Workspace 1 (独立的 sections)
  ├─ Proposal 2 → Workspace 2 (独立的 sections)
  └─ Proposal 3 → Workspace 3 (独立的 sections)

每个 proposal 显示自己的 sections 内容 ✅
Comparison 比较不同的内容 ✅
```

## 注意事项

1. **数据复制**：脚本会为每个 proposal 复制 workspace documents 和 sections，这会增加数据库存储使用
2. **初始内容**：新创建的 workspaces 会从同一 project 的第一个 workspace 复制内容作为模板
3. **独立编辑**：修复后，每个 proposal 的 sections 可以独立编辑，不会影响其他 proposals
4. **备份**：建议在执行前备份数据库

## 相关文件

- `DIAGNOSE-WORKSPACE-PROPOSAL-MAPPING.sql` - 诊断脚本
- `CREATE-DEDICATED-WORKSPACES-FOR-PROPOSALS.sql` - 修复脚本
- `lib/graphql/resolvers.ts` - 更新的 GraphQL resolver
- `db/migrations/044_add_proposal_id_to_workspaces.sql` - 原始 migration

## 如果问题仍然存在

如果执行修复脚本后问题仍然存在，检查：

1. **浏览器缓存**：清除浏览器缓存或使用无痕模式
2. **GraphQL 缓存**：检查 React Query 缓存是否需要清除
3. **Console 日志**：查看浏览器 console 中的 `[proposalDetail]` 日志
4. **数据库查询**：直接在 Supabase 中查询验证数据

调试查询：
```sql
-- 查看特定 proposal 的 workspace
SELECT 
    p.id as proposal_id,
    p.title as proposal_title,
    w.id as workspace_id,
    w.name as workspace_name,
    COUNT(ds.id) as section_count
FROM proposals p
LEFT JOIN workspaces w ON w.proposal_id = p.id
LEFT JOIN workspace_documents wd ON wd.workspace_id = w.id
LEFT JOIN document_sections ds ON ds.document_id = wd.id
WHERE p.id = 'YOUR_PROPOSAL_ID_HERE'
GROUP BY p.id, p.title, w.id, w.name;
```
