# 修复 Comparison View 缓存问题

## 问题分析

Decision page 显示的 budget 数据是正确的（MYR 199, MYR 339, MYR 100），但是进入 comparison view 后显示 "Not specified"。

### 数据流对比

**Decision Page (正常)**:
```
projectWithProposals resolver
  ↓ 读取 proposals.budget_estimate (有值: 199, 339, 100)
  ↓ 返回 budgetEstimate
  ↓ 显示正常 ✅
```

**Comparison View (异常)**:
```
proposalDetail resolver (每个proposal单独查询)
  ↓ 读取 proposals.budget_estimate (???)
  ↓ 返回 budgetEstimate: undefined
  ↓ 显示 "Not specified" ❌
```

## 可能的原因

### 1. 缓存问题
Comparison view 使用 React Query 缓存，可能使用了旧数据：
```typescript
staleTime: 1 * 60 * 1000, // 1 minute
```

### 2. 不同的proposal IDs
Comparison view 可能在查询不同的 proposal IDs

### 3. RLS (Row Level Security) 权限问题
`proposalDetail` resolver 可能有不同的权限检查

## 解决方案

### 方案 1: 从 Decision Page 传递数据（推荐）

修改 comparison view 直接使用已经获取的数据，而不是重新查询：

```typescript
// client-decision-page.tsx
<ProposalComparisonView
  proposalIds={selectedProposals}
  proposals={projectData.proposals.filter(p => selectedProposals.includes(p.id))}
  onClose={() => handleViewModeChange('list')}
/>
```

### 方案 2: 清除缓存

在进入 comparison view 前清除缓存：

```typescript
import { useQueryClient } from '@tanstack/react-query'

const queryClient = useQueryClient()

const handleCompareClick = () => {
  // 清除缓存
  selectedProposals.forEach(id => {
    queryClient.invalidateQueries(['proposal-detail', id])
  })
  setViewMode('comparison')
}
```

### 方案 3: 使用 projectWithProposals 数据

修改 `ProposalComparisonView` 接受 proposals 数据作为 prop：

```typescript
interface ProposalComparisonViewProps {
  proposalIds: string[]
  proposals?: ProposalSummary[]  // 新增
  onClose: () => void
}

export function ProposalComparisonView({ proposalIds, proposals: providedProposals, onClose }) {
  // 如果提供了 proposals，直接使用
  if (providedProposals && providedProposals.length > 0) {
    // 使用提供的数据
    return <ComparisonUI proposals={providedProposals} />
  }
  
  // 否则，查询 proposalDetail
  // ...现有逻辑
}
```

## 调试步骤

### 1. 检查服务器日志

查看终端输出：
```
[proposalDetail] Raw proposal from database: {
  proposal_id: '...',
  budget_estimate: ???,  // 这里是什么值？
  timeline_estimate: ???
}
```

### 2. 检查浏览器 Network 标签

1. 打开 DevTools → Network
2. 筛选 "graphql"
3. 点击进入 comparison view
4. 查看 `proposalDetail` 请求的响应
5. 检查 `budgetEstimate` 和 `timelineEstimate` 的值

### 3. 检查 proposal IDs

在 comparison view 中添加日志：
```typescript
console.log('[Comparison] Selected proposal IDs:', proposalIds)
console.log('[Comparison] Available proposals:', projectData.proposals.map(p => ({
  id: p.id,
  budget: p.budgetEstimate
})))
```

## 快速测试

### 测试 1: 检查是否是缓存问题

1. 打开 decision page
2. 打开 DevTools → Application → Storage
3. 清除所有 Storage
4. 刷新页面
5. 进入 comparison view
6. 检查是否显示 budget

### 测试 2: 检查是否是 ID 问题

在浏览器控制台运行：
```javascript
// 获取当前 URL 的 proposal IDs
const url = new URL(window.location.href)
const params = new URLSearchParams(url.search)
console.log('Current proposal ID:', params.get('proposal'))
```

### 测试 3: 直接查询数据库

运行 `verify-actual-data.sql` 查看实际的数据库值

## 推荐实现

我推荐使用**方案 1**，因为：
1. 避免重复查询
2. 数据一致性更好
3. 性能更优
4. 不依赖缓存

### 实现步骤

1. 修改 `ProposalComparisonView` 接受 proposals prop
2. 修改 decision page 传递已有的 proposals 数据
3. 在 comparison view 中优先使用传递的数据
4. 保留 fallback 查询逻辑（以防万一）

## 下一步

1. 检查服务器日志中的 `[proposalDetail] Raw proposal from database:` 输出
2. 检查 Network 标签中的 GraphQL 响应
3. 确认 proposal IDs 是否正确
4. 实现推荐的解决方案
