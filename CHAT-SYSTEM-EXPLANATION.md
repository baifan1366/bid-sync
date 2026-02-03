# Chat System 设计说明

## 概述

BidSync的chat系统设计为**项目级别的对话**，而不是proposal级别的对话。这意味着所有关于同一个项目的对话都在一个chat中进行。

## Chat系统的参数

ChatSection组件接收两个关键参数：
- `projectId`: 项目ID（必需）
- `proposalId`: Proposal ID（可选，通常为null）

## 使用场景

### 1. Workspace页面（Bidding Lead视角）

**位置**: `/workspace`

**参数**:
```tsx
<ChatSection
  projectId={selectedProposal.project.id}
  proposalId={null}  // 项目级别对话
  projectTitle={selectedProposal.project.title}
/>
```

**对话参与者**:
- **Bidding Lead** (当前用户)
- **Client** (项目创建者)

**对话内容**:
- 关于项目的一般性问题
- 澄清项目需求
- 讨论proposal的修改建议
- 协商时间表和预算

**场景说明**:
- Bidding Lead可能有多个proposals（如果是team member参与的）
- 但所有proposals都是针对同一个项目
- 所以chat是项目级别的，不管选择哪个proposal，chat内容都是一样的

### 2. Client Decision页面（Client视角）

**位置**: `/client-projects/[projectId]/decision`

**参数**:
```tsx
<ChatSection
  projectId={projectId}
  proposalId={null}  // 项目级别对话
  projectTitle={projectData.project.title}
/>
```

**对话参与者**:
- **Client** (当前用户)
- **所有提交了proposal的Bidding Leads**

**对话内容**:
- Client可以向所有bidding leads提问
- Bidding leads可以回答client的问题
- 所有人都能看到所有消息（公开讨论）

**场景说明**:
- Client在decision页面左边看到多个proposals
- 右边的chat是整个项目的公开讨论区
- 不管client选择查看哪个proposal，chat内容都是一样的
- 这样设计的好处：
  - Client可以一次性向所有bidding teams提问
  - 所有teams都能看到问题和答案，保持信息透明
  - 避免重复回答相同的问题

## 数据库设计

### chat_messages表结构

```sql
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL,        -- 项目ID
  proposal_id UUID,                 -- Proposal ID (通常为NULL)
  sender_id UUID NOT NULL,          -- 发送者ID
  content TEXT NOT NULL,            -- 消息内容
  created_at TIMESTAMPTZ,
  read BOOLEAN DEFAULT FALSE
);
```

### 查询逻辑

```typescript
// 获取项目级别的消息
const query = supabase
  .from("chat_messages")
  .select("*")
  .eq("project_id", projectId)

if (proposalId) {
  // 如果有proposalId，只获取该proposal的消息
  query = query.eq("proposal_id", proposalId)
} else {
  // 如果没有proposalId，获取项目级别的消息
  query = query.is("proposal_id", null)
}
```

## 设计优势

### 1. 信息透明
- 所有bidding teams都能看到client的问题
- 避免信息不对称
- 促进公平竞争

### 2. 效率提升
- Client不需要重复向每个team提问
- 一次提问，所有teams都能看到
- 减少沟通成本

### 3. 简化实现
- 不需要为每个proposal创建单独的chat
- 减少数据库记录
- 简化UI逻辑

### 4. 更好的用户体验
- Client在decision页面可以同时查看proposals和进行沟通
- Bidding lead在workspace可以边编辑proposal边与client沟通
- 实时更新，无需刷新页面

## 未来扩展可能性

如果需要支持**私密对话**（Client与特定bidding team的一对一对话），可以：

1. 使用`proposalId`参数
2. 添加UI切换：
   - "Public Discussion" (proposalId = null)
   - "Private Chat with Team X" (proposalId = specific_id)

3. 修改查询逻辑以支持两种模式

## 示例场景

### 场景1: Client提问

1. Client在decision页面看到3个proposals
2. Client在右侧chat输入："请问你们的团队有AWS认证吗？"
3. 所有3个bidding teams都能看到这个问题
4. 每个team可以分别回答

### 场景2: Bidding Lead回复

1. Bidding Lead在workspace页面编辑proposal
2. 看到右侧chat有client的新问题
3. 直接在chat中回复："是的，我们团队有5名AWS认证工程师"
4. Client和其他teams都能看到这个回复

### 场景3: 多个Proposals的情况

**Workspace页面（Bidding Lead）**:
- 左边显示：Proposal A, Proposal B（同一个lead的不同proposals）
- 右边chat：项目级别对话（不管选择哪个proposal，chat内容相同）

**Decision页面（Client）**:
- 左边显示：Team 1的Proposal, Team 2的Proposal, Team 3的Proposal
- 右边chat：项目级别对话（所有teams的公开讨论）

## 总结

Chat系统设计为**项目级别的公开讨论区**，而不是proposal级别的私密对话。这种设计：
- ✅ 促进信息透明和公平竞争
- ✅ 提高沟通效率
- ✅ 简化实现和维护
- ✅ 提供更好的用户体验

如果未来需要私密对话功能，可以通过`proposalId`参数轻松扩展。
