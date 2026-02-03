# 修复 Proposal Details 缺少 Budget 等数据的问题

## 问题描述

在 Client Decision Page 中，proposal cards 可以显示 budget（例如 MYR 199, MYR 339, MYR 100），但点击进入 Proposal Details 页面后，Budget Estimate 和 Timeline Estimate 显示 "Not specified"。

## 根本原因

### GraphQL Resolver 缺少字段

`proposalDetail` resolver 在返回数据时，没有包含以下字段：
- `budgetEstimate` - 预算估算
- `timelineEstimate` - 时间线估算
- `executiveSummary` - 执行摘要
- `additionalInfo` - 额外信息

虽然 GraphQL Schema 中定义了这些字段，但 resolver 没有从数据库中查询并返回它们。

## 解决方案

### 1. 更新 GraphQL Resolver (`lib/graphql/resolvers.ts`)

在 `proposalDetail` resolver 中添加缺失的字段：

```typescript
// 查询 additional info
const { data: additionalInfoData } = await supabase
  .from('proposal_additional_info')
  .select('*')
  .eq('proposal_id', proposalId);

const result = {
  id: proposal.id,
  title: proposal.title || `Proposal for ${proposal.projects.title}`,
  budgetEstimate: proposal.budget_estimate || null,        // ✅ 添加
  timelineEstimate: proposal.timeline_estimate || null,    // ✅ 添加
  executiveSummary: proposal.executive_summary || null,    // ✅ 添加
  status: proposal.status ? proposal.status.toUpperCase() : 'DRAFT',
  submissionDate: proposal.submitted_at || proposal.created_at,
  // ... 其他字段
  additionalInfo: (additionalInfoData || []).map((info: any) => ({  // ✅ 添加
    id: info.id,
    fieldId: info.field_id,
    fieldName: info.field_name,
    fieldValue: info.field_value,
  })),
  // ...
};
```

### 2. 更新 GraphQL Query (`lib/graphql/queries.ts`)

在 `GET_PROPOSAL_DETAILS` query 中添加缺失的字段：

```graphql
query GetProposalDetails($proposalId: ID!) {
  proposalDetail(proposalId: $proposalId) {
    id
    title
    budgetEstimate        # ✅ 添加
    timelineEstimate      # ✅ 添加
    executiveSummary      # ✅ 添加
    status
    submissionDate
    # ... 其他字段
    additionalInfo {      # ✅ 添加
      id
      fieldId
      fieldName
      fieldValue
    }
    # ...
  }
}
```

### 3. 更新 UI 组件 (`components/client/proposal-detail-view.tsx`)

更新 OverviewTab 组件以显示实际数据：

```typescript
{/* Budget Estimate */}
<div className="flex items-start gap-3 rounded-lg border border-yellow-400/20 p-4">
  <DollarSign className="mt-0.5 h-5 w-5 text-yellow-400" />
  <div>
    <p className="text-sm text-muted-foreground">Budget Estimate</p>
    <p className="font-medium text-black dark:text-white">
      {proposal.budgetEstimate 
        ? `MYR ${proposal.budgetEstimate.toLocaleString()}`
        : 'Not specified'}
    </p>
  </div>
</div>

{/* Timeline Estimate */}
<div className="flex items-start gap-3 rounded-lg border border-yellow-400/20 p-4">
  <Clock className="mt-0.5 h-5 w-5 text-yellow-400" />
  <div>
    <p className="text-sm text-muted-foreground">Timeline Estimate</p>
    <p className="font-medium text-black dark:text-white">
      {proposal.timelineEstimate || 'Not specified'}
    </p>
  </div>
</div>
```

## 数据库字段映射

| GraphQL 字段 | 数据库字段 | 类型 |
|-------------|-----------|------|
| `budgetEstimate` | `budget_estimate` | Float |
| `timelineEstimate` | `timeline_estimate` | String |
| `executiveSummary` | `executive_summary` | String |
| `additionalInfo` | `proposal_additional_info` 表 | Array |

## 修改的文件

1. ✅ `lib/graphql/resolvers.ts` - 添加字段到 resolver 返回值
2. ✅ `lib/graphql/queries.ts` - 添加字段到 GraphQL query
3. ✅ `components/client/proposal-detail-view.tsx` - 更新 UI 显示实际数据
4. ✅ `lib/graphql/types.ts` - TypeScript 类型已经正确（无需修改）

## 测试步骤

1. 重启 Next.js 应用（如果需要）
2. 登录为 client
3. 进入一个 project 的 decision page
4. 点击任意 proposal card 查看详情
5. 验证 "Key Information" 部分显示：
   - ✅ Budget Estimate: MYR XXX（如果有数据）
   - ✅ Timeline Estimate: XXX（如果有数据）
   - ✅ Compliance Status: X% Complete

## 预期结果

修复后，Proposal Details 页面应该显示：
- **Budget Estimate**: 显示实际的预算金额（例如 MYR 199）
- **Timeline Estimate**: 显示实际的时间线（例如 "2 weeks"）
- **Executive Summary**: 如果有的话，可以在 Overview 中显示
- **Additional Info**: 可以在需要时访问额外的自定义字段

## 注意事项

1. **数据格式**：Budget 以数字形式存储，显示时使用 `toLocaleString()` 格式化
2. **空值处理**：如果字段为 null，显示 "Not specified"
3. **货币符号**：目前硬编码为 "MYR"，如果需要支持多币种，需要额外的字段
4. **缓存**：如果数据没有立即更新，清除浏览器缓存或使用无痕模式测试

## 相关文件

- `lib/graphql/resolvers.ts` - GraphQL resolver 实现
- `lib/graphql/queries.ts` - GraphQL queries
- `lib/graphql/types.ts` - TypeScript 类型定义
- `components/client/proposal-detail-view.tsx` - Proposal 详情视图
- `app/(app)/(client)/client-projects/[projectId]/decision/client-decision-page.tsx` - Decision page（参考）
