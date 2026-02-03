# Workspace Section Editor Implementation

## 概述

在workspace页面添加了section切换和编辑功能，使用户无需跳转到collaborative editor页面即可切换和编辑不同的sections。

## 实现的功能

### 1. Section切换
- 在workspace编辑模式下显示section tabs
- 每个tab显示section标题和状态badge
- 点击tab可以切换到对应的section
- 使用黄色主题色高亮active tab

### 2. Section编辑
- 每个section有独立的TipTap富文本编辑器
- 显示section的分配信息（assigned to）和截止日期
- 显示锁定状态（如果被其他用户锁定）
- 支持保存section内容到数据库

### 3. 状态显示
- Section状态badge（not_started, in_progress, in_review, completed）
- 使用不同颜色区分状态：
  - Completed: 绿色
  - In Review: 蓝色
  - In Progress: 黄色
  - Not Started: 灰色

### 4. 锁定机制
- 显示section是否被其他用户锁定
- 被锁定的section不可编辑
- 显示锁定者的信息

## 文件更改

### 新增文件

#### `components/client/workspace-section-editor.tsx`
新建的section编辑器组件，包含：
- Section信息显示（标题、分配者、截止日期）
- TipTap富文本编辑器
- 保存按钮和状态指示
- 锁定状态显示
- 未保存更改提示

### 修改文件

#### `components/client/workspace-content.tsx`
添加的功能：
1. **导入新的依赖**
   - `GET_DOCUMENT_SECTIONS` query
   - `UPDATE_SECTION` mutation
   - `WorkspaceSectionEditor` 组件

2. **新增状态**
   - `activeSection`: 当前选中的section ID
   - `sections`: 从GraphQL获取的sections列表
   - `currentSection`: 当前选中的section对象

3. **新增GraphQL查询**
   - 获取document的所有sections
   - 包含section的完整信息（内容、状态、分配、锁定等）

4. **新增Mutation**
   - `updateSectionMutation`: 更新section内容

5. **新增处理函数**
   - `handleSectionUpdate`: 保存section内容
   - `getSectionStatusColor`: 获取状态对应的颜色

6. **UI更新**
   - 在编辑模式下添加section tabs
   - 每个tab显示section标题和状态
   - Tab内容使用`WorkspaceSectionEditor`组件
   - 如果没有sections，回退到原来的ProposalEditor

#### `hooks/use-tiptap-editor.ts`
添加CharacterCount扩展：
- 安装`@tiptap/extension-character-count`包
- 配置为无字符限制（`limit: null`）

#### `lib/validation-utils.ts`
更新文本验证配置：
- 将`TEXT_VALIDATION_CONFIG.maxLength`从5000提升到1,000,000
- 添加注释说明这主要用于简单文本输入，富文本编辑器无限制

## 用户体验改进

### 之前
- 用户只能在workspace页面看到整个proposal的内容
- 无法按section组织和编辑内容
- 需要跳转到collaborative editor页面才能使用section功能

### 现在
- 用户可以在workspace页面直接切换sections
- 每个section独立编辑，更有组织性
- 清晰显示每个section的状态和分配信息
- 保留"Full Editor"按钮，可以跳转到完整功能的collaborative editor

## 技术细节

### GraphQL查询
```graphql
query GetDocumentSections($documentId: ID!) {
  getDocumentSections(documentId: $documentId) {
    id
    documentId
    title
    order
    status
    assignedTo
    assignedToUser {
      id
      email
      fullName
    }
    deadline
    content
    lockedBy
    lockedByUser {
      id
      email
      fullName
    }
    lockedAt
    lockExpiresAt
  }
}
```

### GraphQL Mutation
```graphql
mutation UpdateSection($sectionId: ID!, $input: UpdateSectionInput!) {
  updateSection(sectionId: $sectionId, input: $input) {
    success
    section {
      id
      content
      updatedAt
    }
    error
  }
}
```

### 状态管理
- 使用React Query进行数据获取和缓存
- 自动刷新sections数据
- Optimistic updates for better UX

## 设计系统遵循

所有UI组件遵循BidSync设计系统：
- 黄色主题色（`yellow-400`）用于高亮和主要操作
- 边框使用`border-yellow-400/20`
- Hover状态使用`hover:bg-yellow-400/10`
- 按钮使用`bg-yellow-400 hover:bg-yellow-500 text-black`
- 保持light/dark模式一致性

## 未来改进建议

1. **自动保存**
   - 实现debounced自动保存
   - 减少用户手动保存的需要

2. **Attachments和Comments**
   - 在workspace页面添加attachments面板
   - 添加section-level comments功能

3. **Version History**
   - 在workspace页面显示section的版本历史
   - 允许查看和恢复历史版本

4. **实时协作**
   - 添加实时presence indicators
   - 显示其他用户正在编辑的section

5. **拖拽排序**
   - 允许用户拖拽重新排序sections
   - 仅限lead用户

## 测试建议

1. 测试section切换功能
2. 测试section内容保存
3. 测试锁定状态显示
4. 测试无sections时的回退行为
5. 测试不同用户角色的权限
6. 测试响应式布局

## 部署注意事项

1. 确保数据库有`document_sections`表
2. 确保GraphQL resolvers已实现
3. 确保RLS policies正确配置
4. 测试section查询和更新权限
