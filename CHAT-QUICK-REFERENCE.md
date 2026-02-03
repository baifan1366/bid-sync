# Chat系统快速参考

## 一对一私密对话系统

### Bidding Lead（Workspace页面）

**自动行为**:
- 选择proposal → 自动显示该proposal的chat
- 切换proposal → chat内容自动切换
- 发送消息 → 只有client能看到

**Chat位置**:
- 桌面：右侧sidebar
- 移动：proposal下方

### Client（Decision页面）

**手动选择**:
1. 使用下拉菜单选择要沟通的team
2. 或点击proposal卡片自动选择

**Chat位置**:
- 桌面：右侧sidebar（带proposal选择器）
- 移动：页面底部（带proposal选择器）

## 关键参数

```tsx
<ChatSection
  projectId={projectId}        // 项目ID
  proposalId={proposalId}      // ✅ 必须指定（不再是null）
  projectTitle={projectTitle}  // 项目标题
  proposalTitle={proposalTitle} // Proposal标题
/>
```

## 数据流

```
Bidding Lead → Chat → Client
     ↓                    ↓
Proposal A          Proposal A
Proposal B          Proposal B
Proposal C          Proposal C

每个proposal = 独立对话
```

## 隐私保证

✅ Bidding Lead A 看不到 Bidding Lead B 的消息
✅ Client 可以选择与哪个team沟通
✅ 所有对话都是一对一私密的
✅ 符合商业隐私最佳实践
