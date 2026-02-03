# Client Proposal Workflow Guide

## 如何使用 Proposal 比较功能和选择 Proposal

### 📋 功能概述

Client 可以：
1. **查看所有提交的 proposals**
2. **选择多个 proposals 进行比较**（2-4个）
3. **查看详细的 proposal 内容**
4. **接受或拒绝 proposals**
5. **关闭项目**

---

## 🔍 比较 Proposals (Compare 功能)

### 步骤 1: 选择 Proposals

在 Decision 页面 (`/client-projects/[projectId]/decision`)：

1. **找到 Proposal 卡片**
   - 每个 proposal 卡片左上角有一个 **checkbox（复选框）**
   
2. **勾选要比较的 proposals**
   - 点击 checkbox 选择 proposal
   - 最少选择 **2 个**
   - 最多选择 **4 个**

3. **查看选择状态**
   - 右上角会显示 badge：`X selected`
   - 如果少于 2 个：显示 "Select X more"
   - 如果超过 4 个：显示 "Deselect X"

### 步骤 2: 启用 Compare 按钮

- **Compare 按钮状态**：
  - ❌ **Disabled（灰色）**: 选择少于 2 个 proposals
  - ✅ **Enabled（黄色）**: 选择 2-4 个 proposals

### 步骤 3: 进入比较视图

1. 点击 **"Compare"** 按钮
2. 进入并排比较视图
3. 可以查看：
   - Team 信息对比
   - Budget 对比
   - Timeline 对比
   - Compliance score 对比
   - 详细内容对比

### 步骤 4: 退出比较

- 点击 **"Exit Compare"** 按钮返回列表视图

---

## ✅ 选择 Proposal 并关闭项目

### 方法 1: 通过 Proposal Detail 页面

1. **查看 Proposal 详情**
   - 点击任意 proposal 卡片（不是 checkbox）
   - 进入详细页面

2. **接受 Proposal**
   - 在详情页面找到 **"Accept Proposal"** 按钮
   - 点击确认接受
   - 系统会：
     - 将 proposal 状态改为 `ACCEPTED`
     - 其他 proposals 自动变为 `REJECTED`
     - 项目状态可能变为 `AWARDED`

3. **拒绝 Proposal**
   - 点击 **"Reject Proposal"** 按钮
   - 填写拒绝原因（可选）
   - 确认拒绝

### 方法 2: 通过比较视图

1. 在比较视图中查看多个 proposals
2. 每个 proposal 列都有 **"Accept"** 和 **"Reject"** 按钮
3. 直接在比较视图中做决定

---

## 🔒 关闭项目

### 在 Project Detail 页面

1. 导航到 `/client-projects/[projectId]`
2. 找到 **"Close Project"** 按钮
3. 点击并确认
4. 项目状态变为 `CLOSED`
5. 效果：
   - 不再接受新的 proposals
   - 现有 proposals 仍可查看
   - 可以重新打开项目

### 重新打开项目

1. 在已关闭的项目页面
2. 点击 **"Reopen Project"** 按钮
3. 项目状态变回 `OPEN`
4. 可以继续接受新 proposals

---

## 📊 项目状态流程

```
PENDING_REVIEW (待审核)
    ↓
OPEN (开放接受 proposals)
    ↓
CLOSED (关闭，不接受新 proposals)
    ↓
AWARDED (已选择 proposal)
```

---

## 🎯 最佳实践

### 比较 Proposals

1. **先筛选**
   - 使用 filter 按状态筛选（Submitted, Under Review 等）
   - 使用 sort 按预算或提交日期排序

2. **选择对比**
   - 选择 2-4 个最有潜力的 proposals
   - 使用比较视图并排查看

3. **详细审查**
   - 点击进入每个 proposal 的详情页
   - 查看完整的 sections 和 documents
   - 查看 compliance checklist

4. **做出决定**
   - Accept 最合适的 proposal
   - 或 Reject 不合适的 proposals

### 关闭项目

1. **确认选择**
   - 在关闭项目前，确保已经 accept 了一个 proposal
   - 或者确定不需要任何 proposal

2. **通知团队**
   - 系统会自动发送通知给相关团队
   - Accepted proposal 的团队会收到通知
   - Rejected proposals 的团队也会收到通知

---

## 🐛 常见问题

### Q: Compare 按钮一直是灰色的？
**A**: 你需要先勾选至少 2 个 proposal 的 checkbox。

### Q: 无法选择更多 proposals？
**A**: 最多只能选择 4 个 proposals 进行比较。先取消一些选择。

### Q: 如何取消选择？
**A**: 再次点击已选中的 checkbox 即可取消。

### Q: Accept 一个 proposal 后会怎样？
**A**: 
- 该 proposal 状态变为 `ACCEPTED`
- 其他 proposals 自动变为 `REJECTED`
- 项目状态可能变为 `AWARDED`
- 相关团队会收到通知

### Q: 可以 accept 多个 proposals 吗？
**A**: 通常一个项目只能 accept 一个 proposal。

### Q: 关闭项目后还能查看 proposals 吗？
**A**: 可以！关闭项目只是停止接受新的 proposals，现有的仍可查看。

---

## 🎨 UI 元素说明

### Proposal Card

```
┌─────────────────────────────────────┐
│ ☑ [Checkbox]  Proposal Title        │
│                                      │
│ 👤 Team Lead Name                   │
│ 💰 Budget: MYR 500                  │
│ 👥 2 members                         │
│ 📅 Submitted Feb 3, 2026            │
│                                      │
│ [View Details]  [Quick Actions]     │
└─────────────────────────────────────┘
```

### Compare Button States

- **Disabled (灰色)**: `< 2 proposals selected`
- **Enabled (黄色)**: `2-4 proposals selected`
- **Active (绿色)**: `In comparison mode`

### Selection Badge

- `1 selected` - 需要再选 1 个
- `2 selected` - 可以比较 ✅
- `3 selected` - 可以比较 ✅
- `4 selected` - 已达上限 ✅
- `5 selected` - 超出限制 ❌

---

## 📱 响应式设计

- **Desktop**: 并排显示多个 proposals
- **Tablet**: 2 列显示
- **Mobile**: 单列显示，可滑动查看

---

## 🔐 权限说明

只有 **Project Owner (Client)** 可以：
- Accept/Reject proposals
- Close/Reopen project
- 查看所有 proposals

**Bidding Teams** 只能：
- 查看自己的 proposal
- 编辑 draft proposals
- 提交 proposals

---

## 总结

1. ✅ 勾选 2-4 个 proposals 的 checkbox
2. ✅ 点击 "Compare" 按钮
3. ✅ 查看并排比较
4. ✅ Accept 最合适的 proposal
5. ✅ Close project（可选）

就这么简单！🎉
