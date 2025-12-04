# BidSync 业务逻辑通知触发点清单

## 📋 概述

本文档详细标记了 BidSync 平台中所有需要添加通知功能的业务逻辑点。每个触发点都包含：
- 📍 **位置**: 代码文件和函数
- 🔔 **通知类型**: 需要发送的通知
- 👥 **接收者**: 谁应该收到通知
- 📧 **邮件**: 是否需要发送邮件
- ⚡ **优先级**: 通知的紧急程度
- 💡 **实现建议**: 如何集成通知

---

## 1️⃣ 项目管理模块

### 1.1 项目创建
**📍 位置**: `lib/project-service.ts` (需要创建)
**当前状态**: ❌ 未实现通知

```typescript
// 触发点：项目创建成功后
async function createProject(input: CreateProjectInput, clientId: string) {
  // ... 创建项目逻辑
  
  // 🔔 添加通知
  await NotificationService.createNotification({
    userId: clientId,
    type: 'project_created',
    title: '项目创建成功',
    body: `您的项目"${project.title}"已创建，等待管理员审核`,
    data: { projectId: project.id },
    sendEmail: true
  });
  
  // 通知所有管理员
  const admins = await getAdminUsers();
  for (const admin of admins) {
    await NotificationService.createNotification({
      userId: admin.id,
      type: 'project_pending_review',
      title: '新项目待审核',
      body: `客户 ${clientName} 创建了新项目"${project.title}"`,
      data: { projectId: project.id, clientId },
      sendEmail: true
    });
  }
}
```

**接收者**: 
- ✅ 项目客户（确认创建）
- ✅ 所有管理员（待审核）

**优先级**: MEDIUM

---

### 1.2 项目审批
**📍 位置**: `lib/admin-service.ts` (需要创建) 或 `app/api/admin/projects/[id]/approve/route.ts`
**当前状态**: ❌ 未实现通知

```typescript
// 触发点：管理员批准项目
async function approveProject(projectId: string, adminId: string, notes?: string) {
  // ... 更新项目状态为 'open'
  
  // 🔔 通知项目客户
  await NotificationService.createNotification({
    userId: project.client_id,
    type: 'project_approved',
    title: '🎉 项目已批准',
    body: `您的项目"${project.title}"已通过审核，现在可以接收提案了`,
    data: { projectId, notes },
    sendEmail: true
  });
}
```

**接收者**: 项目客户
**优先级**: HIGH

---

### 1.3 项目拒绝
**📍 位置**: `lib/admin-service.ts` 或 `app/api/admin/projects/[id]/reject/route.ts`
**当前状态**: ❌ 未实现通知

```typescript
// 触发点：管理员拒绝项目
async function rejectProject(projectId: string, adminId: string, reason: string) {
  // ... 更新项目状态
  
  // 🔔 通知项目客户
  await NotificationService.createNotification({
    userId: project.client_id,
    type: 'project_rejected',
    title: '项目未通过审核',
    body: `您的项目"${project.title}"未通过审核`,
    data: { projectId, reason },
    sendEmail: true
  });
}
```

**接收者**: 项目客户
**优先级**: HIGH

---

### 1.4 项目授予
**📍 位置**: `lib/proposal-service.ts` → `acceptProposal()`
**当前状态**: ❌ 未实现通知

```typescript
// 触发点：客户接受提案，项目状态变为 'awarded'
async function acceptProposal(proposalId: string, clientId: string) {
  // ... 更新项目和提案状态
  
  // 🔔 通知中标团队负责人
  await NotificationService.createNotification({
    userId: proposal.lead_id,
    type: 'project_awarded',
    title: '🎉 恭喜！您的提案被接受了',
    body: `客户接受了您对"${project.title}"的提案`,
    data: { projectId: project.id, proposalId },
    sendEmail: true
  });
  
  // 通知所有团队成员
  const teamMembers = await getTeamMembers(proposalId);
  for (const member of teamMembers) {
    await NotificationService.createNotification({
      userId: member.user_id,
      type: 'project_awarded',
      title: '项目已授予',
      body: `您的团队赢得了项目"${project.title}"`,
      data: { projectId: project.id, proposalId },
      sendEmail: true
    });
  }
  
  // 通知未中标的团队
  const rejectedProposals = await getRejectedProposals(project.id);
  for (const rejected of rejectedProposals) {
    await NotificationService.createNotification({
      userId: rejected.lead_id,
      type: 'proposal_rejected',
      title: '提案未被选中',
      body: `很遗憾，您对"${project.title}"的提案未被选中`,
      data: { projectId: project.id, proposalId: rejected.id },
      sendEmail: true
    });
  }
}
```

**接收者**: 
- ✅ 中标团队负责人和成员
- ✅ 未中标团队负责人

**优先级**: HIGH

---

### 1.5 项目截止日期提醒
**📍 位置**: Cron Job - `app/api/cron/deadline-reminders/route.ts` (需要创建)
**当前状态**: ❌ 未实现

```typescript
// 触发点：每天检查即将到期的项目
export async function GET(request: NextRequest) {
  const projects = await getProjectsWithUpcomingDeadlines(7); // 7天内到期
  
  for (const project of projects) {
    const daysRemaining = getDaysUntilDeadline(project.deadline);
    
    // 🔔 通知项目客户
    await NotificationService.createNotification({
      userId: project.client_id,
      type: 'project_deadline_approaching',
      title: '⏰ 项目截止日期临近',
      body: `项目"${project.title}"将在 ${daysRemaining} 天后截止`,
      data: { projectId: project.id, daysRemaining },
      sendEmail: true
    });
    
    // 如果项目已授予，通知团队
    if (project.status === 'awarded') {
      const proposal = await getAwardedProposal(project.id);
      const teamMembers = await getTeamMembers(proposal.id);
      
      for (const member of teamMembers) {
        await NotificationService.createNotification({
          userId: member.user_id,
          type: 'project_deadline_approaching',
          title: '⏰ 项目截止日期临近',
          body: `项目"${project.title}"将在 ${daysRemaining} 天后截止`,
          data: { projectId: project.id, daysRemaining },
          sendEmail: true
        });
      }
    }
  }
}
```

**接收者**: 
- ✅ 项目客户
- ✅ 授予项目的团队成员

**优先级**: MEDIUM

---

## 2️⃣ 提案管理模块

### 2.1 提案提交
**📍 位置**: `lib/proposal-submission-service.ts` → `submitProposal()`
**当前状态**: ⚠️ 部分实现（仅邮件，无应用内通知）

**现有代码**:
```typescript
// lib/email/templates.ts 中已有邮件模板
// - getProposalSubmissionClientEmail()
// - getProposalSubmissionLeadEmail()
// - getProposalSubmissionAdminEmail()
```

**需要添加**:
```typescript
async function submitProposal(proposalId: string, leadId: string) {
  // ... 提交逻辑
  
  // 🔔 添加应用内通知
  // 通知客户
  await NotificationService.createNotification({
    userId: project.client_id,
    type: 'proposal_submitted',
    title: '收到新提案',
    body: `团队 ${teamName} 为您的项目"${project.title}"提交了提案`,
    data: { projectId: project.id, proposalId },
    sendEmail: true // 已有邮件模板
  });
  
  // 通知提案负责人（确认）
  await NotificationService.createNotification({
    userId: leadId,
    type: 'proposal_submitted',
    title: '✅ 提案提交成功',
    body: `您的提案"${proposal.title}"已成功提交`,
    data: { projectId: project.id, proposalId },
    sendEmail: true // 已有邮件模板
  });
  
  // 通知管理员
  const admins = await getAdminUsers();
  for (const admin of admins) {
    await NotificationService.createNotification({
      userId: admin.id,
      type: 'proposal_submitted',
      title: '新提案提交',
      body: `项目"${project.title}"收到新提案`,
      data: { projectId: project.id, proposalId },
      sendEmail: false // 管理员不需要邮件
    });
  }
}
```

**接收者**: 
- ✅ 项目客户
- ✅ 提案负责人
- ✅ 管理员

**优先级**: HIGH

---

### 2.2 提案评分
**📍 位置**: `lib/scoring-service.ts` (需要创建) 或 GraphQL resolver
**当前状态**: ⚠️ 部分实现（仅邮件）

**现有代码**:
```typescript
// lib/email/scoring-notifications.ts
// - sendLeadScoredNotification()
// - sendLeadScoreUpdatedNotification()
// - sendClientAllScoredNotification()
```

**需要添加**:
```typescript
// 在评分时添加应用内通知
async function scoreProposal(proposalId: string, scores: Score[]) {
  // ... 评分逻辑
  
  // 🔔 通知提案负责人
  await NotificationService.createNotification({
    userId: proposal.lead_id,
    type: 'proposal_scored',
    title: '您的提案已被评分',
    body: `总分: ${totalScore}, 排名: #${rank}`,
    data: { proposalId, totalScore, rank },
    sendEmail: true // 使用现有邮件模板
  });
}
```

**接收者**: 提案负责人
**优先级**: HIGH

---

### 2.3 所有提案评分完成
**📍 位置**: `lib/scoring-service.ts`
**当前状态**: ⚠️ 部分实现（仅邮件）

```typescript
async function checkAllProposalsScored(projectId: string) {
  if (await areAllProposalsScored(projectId)) {
    // 🔔 通知客户
    await NotificationService.createNotification({
      userId: project.client_id,
      type: 'all_proposals_scored',
      title: '所有提案已评分完成',
      body: `项目"${project.title}"的所有提案已完成评分`,
      data: { projectId, proposalCount },
      sendEmail: true
    });
  }
}
```

**接收者**: 项目客户
**优先级**: HIGH

---

## 3️⃣ 团队管理模块

### 3.1 团队成员加入
**📍 位置**: `lib/team-invitation-service.ts` → `joinTeam()`
**当前状态**: ❌ 未实现通知

```typescript
async joinTeam(input: JoinTeamInput) {
  // ... 加入团队逻辑
  
  // 🔔 通知团队负责人
  await NotificationService.notifyTeamMemberJoined(
    leadId,
    input.userId,
    projectId
  );
  
  // 通知新成员（欢迎）
  await NotificationService.createNotification({
    userId: input.userId,
    type: 'team_joined_success',
    title: '欢迎加入团队',
    body: `您已成功加入项目"${project.title}"的团队`,
    data: { projectId, proposalId },
    sendEmail: true
  });
}
```

**接收者**: 
- ✅ 团队负责人
- ✅ 新加入的成员

**优先级**: MEDIUM

---

### 3.2 团队成员移除
**📍 位置**: `lib/team-management-service.ts` → `removeTeamMember()`
**当前状态**: ❌ 未实现通知

```typescript
async removeTeamMember(memberId: string, leadId: string) {
  // ... 移除逻辑
  
  // 🔔 通知被移除的成员
  await NotificationService.createNotification({
    userId: memberId,
    type: 'team_member_removed',
    title: '您已被移出团队',
    body: `您已被移出项目"${project.title}"的团队`,
    data: { projectId, proposalId },
    sendEmail: true
  });
}
```

**接收者**: 被移除的成员
**优先级**: HIGH

---

### 3.3 邀请创建
**📍 位置**: `lib/team-invitation-service.ts` → `generateInvitation()`
**当前状态**: ❌ 未实现通知

```typescript
async generateInvitation(input: GenerateInvitationInput) {
  // ... 生成邀请逻辑
  
  // 🔔 通知负责人（确认）
  await NotificationService.createNotification({
    userId: input.createdBy,
    type: 'invitation_created',
    title: '邀请链接已创建',
    body: `邀请码: ${invitation.code}`,
    data: { invitationId: invitation.id, code: invitation.code },
    sendEmail: false
  });
}
```

**接收者**: 创建邀请的负责人
**优先级**: LOW

---

## 4️⃣ 项目交付模块

### 4.1 交付物上传
**📍 位置**: `lib/deliverable-service.ts` → `uploadDeliverable()`
**当前状态**: ❌ 未实现通知

```typescript
async uploadDeliverable(input: UploadDeliverableInput, userId: string) {
  // ... 上传逻辑
  
  // 🔔 通知团队负责人
  await NotificationService.createNotification({
    userId: proposal.lead_id,
    type: 'deliverable_uploaded',
    title: '新交付物已上传',
    body: `${uploaderName} 上传了文件: ${input.fileName}`,
    data: { projectId, deliverableId: deliverable.id },
    sendEmail: false
  });
}
```

**接收者**: 团队负责人
**优先级**: LOW

---

### 4.2 准备交付
**📍 位置**: `lib/completion-service.ts` → `markReadyForDelivery()`
**当前状态**: ✅ 已实现（邮件）

**现有代码**:
```typescript
// lib/email/completion-notifications.ts
// - sendClientReadyForDeliveryNotification()
```

**需要添加应用内通知**:
```typescript
async markReadyForDelivery(input: MarkReadyForDeliveryInput, userId: string) {
  // ... 现有逻辑
  
  // 🔔 添加应用内通知
  await NotificationService.createNotification({
    userId: project.client_id,
    type: 'ready_for_delivery',
    title: '🎉 项目准备交付',
    body: `团队已完成工作，提交了 ${deliverableCount} 个交付物`,
    data: { projectId, deliverableCount },
    sendEmail: true // 使用现有邮件模板
  });
}
```

**接收者**: 项目客户
**优先级**: HIGH

---

### 4.3 完成接受
**📍 位置**: `lib/completion-service.ts` → `acceptCompletion()`
**当前状态**: ✅ 已实现（邮件）

**现有代码**:
```typescript
// lib/email/completion-notifications.ts
// - sendTeamCompletionNotifications()
```

**需要添加应用内通知**:
```typescript
async acceptCompletion(completionId: string, userId: string) {
  // ... 现有逻辑
  
  // 🔔 添加应用内通知给所有团队成员
  const teamMembers = await getTeamMembers(proposalId);
  for (const member of teamMembers) {
    await NotificationService.createNotification({
      userId: member.user_id,
      type: 'completion_accepted',
      title: '✅ 项目已完成',
      body: `客户接受了项目"${project.title}"的交付`,
      data: { projectId, completionId },
      sendEmail: true // 使用现有邮件模板
    });
  }
}
```

**接收者**: 所有团队成员
**优先级**: HIGH

---

### 4.4 请求修订
**📍 位置**: `lib/completion-service.ts` → `requestRevision()`
**当前状态**: ✅ 已实现（邮件）

**现有代码**:
```typescript
// lib/email/completion-notifications.ts
// - sendLeadRevisionRequestNotification()
```

**需要添加应用内通知**:
```typescript
async requestRevision(input: RequestRevisionInput, userId: string) {
  // ... 现有逻辑
  
  // 🔔 添加应用内通知
  await NotificationService.createNotification({
    userId: completion.submitted_by,
    type: 'revision_requested',
    title: '📝 客户请求修订',
    body: `客户对项目"${project.title}"请求了修订`,
    data: { projectId, completionId, revisionNotes: input.revisionNotes },
    sendEmail: true // 使用现有邮件模板
  });
}
```

**接收者**: 团队负责人
**优先级**: HIGH

---

## 5️⃣ 文档协作模块

### 5.1 文档共享
**📍 位置**: `lib/document-service.ts` (需要创建)
**当前状态**: ❌ 未实现通知

```typescript
async shareDocument(documentId: string, userId: string, role: string) {
  // ... 共享逻辑
  
  // 🔔 通知被邀请的用户
  await NotificationService.createNotification({
    userId: userId,
    type: 'document_shared',
    title: '文档共享邀请',
    body: `${inviterName} 邀请您协作编辑"${document.title}"`,
    data: { documentId, role },
    sendEmail: true
  });
}
```

**接收者**: 被邀请的用户
**优先级**: MEDIUM

---

### 5.2 章节分配
**📍 位置**: `lib/section-management-service.ts` → `assignSection()`
**当前状态**: ⚠️ 部分实现

**现有代码**:
```typescript
// lib/notification-service.ts
// - notifySectionAssignment()
```

**已实现**: ✅ 应用内通知 + 邮件

---

### 5.3 章节重新分配
**📍 位置**: `lib/section-management-service.ts` → `reassignSection()`
**当前状态**: ⚠️ 部分实现

**现有代码**:
```typescript
// lib/notification-service.ts
// - notifySectionReassignment()
```

**已实现**: ✅ 应用内通知 + 邮件

---

### 5.4 章节完成
**📍 位置**: `lib/section-management-service.ts` → `markSectionComplete()`
**当前状态**: ⚠️ 部分实现

**现有代码**:
```typescript
// lib/notification-service.ts
// - notifySectionCompleted()
```

**已实现**: ✅ 应用内通知 + 邮件

---

### 5.5 章节截止日期提醒
**📍 位置**: Cron Job (需要创建)
**当前状态**: ❌ 未实现

```typescript
// app/api/cron/section-deadline-reminders/route.ts
export async function GET(request: NextRequest) {
  const sections = await getSectionsWithUpcomingDeadlines(3); // 3天内到期
  
  for (const section of sections) {
    await NotificationService.createNotification({
      userId: section.assigned_to,
      type: 'section_deadline_approaching',
      title: '⏰ 章节截止日期临近',
      body: `章节"${section.title}"将在 ${daysRemaining} 天后截止`,
      data: { sectionId: section.id, daysRemaining },
      sendEmail: true
    });
  }
}
```

**接收者**: 章节负责人
**优先级**: MEDIUM

---

### 5.6 文档评论
**📍 位置**: GraphQL resolver 或 API route
**当前状态**: ❌ 未实现通知

```typescript
async addDocumentComment(documentId: string, userId: string, content: string) {
  // ... 添加评论逻辑
  
  // 🔔 通知文档所有者和协作者
  const collaborators = await getDocumentCollaborators(documentId);
  for (const collaborator of collaborators) {
    if (collaborator.user_id !== userId) {
      await NotificationService.createNotification({
        userId: collaborator.user_id,
        type: 'document_comment_added',
        title: '新评论',
        body: `${commenterName} 在"${document.title}"中添加了评论`,
        data: { documentId, commentId },
        sendEmail: false
      });
    }
  }
}
```

**接收者**: 文档协作者（除评论者外）
**优先级**: LOW

---

### 5.7 文档版本回滚
**📍 位置**: `lib/version-control-service.ts` → `rollbackToVersion()`
**当前状态**: ❌ 未实现通知

```typescript
async rollbackToVersion(documentId: string, versionNumber: number, userId: string) {
  // ... 回滚逻辑
  
  // 🔔 通知所有协作者
  const collaborators = await getDocumentCollaborators(documentId);
  for (const collaborator of collaborators) {
    await NotificationService.createNotification({
      userId: collaborator.user_id,
      type: 'document_rollback',
      title: '文档已回滚',
      body: `${userName} 将"${document.title}"回滚到版本 ${versionNumber}`,
      data: { documentId, versionNumber },
      sendEmail: true
    });
  }
}
```

**接收者**: 所有文档协作者
**优先级**: HIGH

---

## 6️⃣ 消息和问答模块

### 6.1 收到新消息
**📍 位置**: GraphQL resolver 或 `lib/chat-service.ts`
**当前状态**: ⚠️ 部分实现

**现有代码**:
```typescript
// lib/notification-service.ts
// - notifyMessageReceived()
```

**需要集成到消息发送逻辑**:
```typescript
async sendMessage(projectId: string, senderId: string, content: string) {
  // ... 发送消息逻辑
  
  // 🔔 通知接收者
  const recipients = await getMessageRecipients(projectId, senderId);
  for (const recipient of recipients) {
    await NotificationService.notifyMessageReceived(
      recipient.id,
      senderId,
      content.substring(0, 100),
      projectId
    );
  }
}
```

**接收者**: 对话参与者（除发送者外）
**优先级**: HIGH

---

### 6.2 问题发布
**📍 位置**: GraphQL resolver 或 API route
**当前状态**: ❌ 未实现通知

```typescript
async postQuestion(projectId: string, userId: string, question: string) {
  // ... 发布问题逻辑
  
  // 🔔 通知项目客户和团队
  await NotificationService.createNotification({
    userId: project.client_id,
    type: 'qa_question_posted',
    title: '新问题',
    body: `${userName} 在项目"${project.title}"中提出了问题`,
    data: { projectId, questionId },
    sendEmail: true
  });
}
```

**接收者**: 项目客户
**优先级**: MEDIUM

---

### 6.3 问题回答
**📍 位置**: GraphQL resolver 或 API route
**当前状态**: ❌ 未实现通知

```typescript
async answerQuestion(questionId: string, userId: string, answer: string) {
  // ... 回答问题逻辑
  
  // 🔔 通知提问者
  await NotificationService.createNotification({
    userId: question.asked_by,
    type: 'qa_answer_posted',
    title: '您的问题有新回答',
    body: `${answererName} 回答了您的问题`,
    data: { questionId, answerId },
    sendEmail: true
  });
}
```

**接收者**: 提问者
**优先级**: HIGH

---

## 7️⃣ 管理员模块

### 7.1 管理员邀请
**📍 位置**: `lib/admin-service.ts`
**当前状态**: ⚠️ 部分实现（仅邮件）

**现有代码**:
```typescript
// lib/email/templates.ts
// - getAdminInvitationEmail()
```

**需要添加应用内通知**:
```typescript
async inviteAdmin(email: string, invitedBy: string) {
  // ... 邀请逻辑
  
  // 🔔 通知邀请者（确认）
  await NotificationService.createNotification({
    userId: invitedBy,
    type: 'admin_invitation_sent',
    title: '管理员邀请已发送',
    body: `已向 ${email} 发送管理员邀请`,
    data: { email, invitationId },
    sendEmail: false
  });
}
```

**接收者**: 
- ✅ 被邀请者（邮件）
- ✅ 邀请者（应用内确认）

**优先级**: MEDIUM

---

### 7.2 账户验证批准
**📍 位置**: `lib/admin-service.ts`
**当前状态**: ⚠️ 部分实现（仅邮件）

**现有代码**:
```typescript
// lib/email/templates.ts
// - getVerificationApprovalEmail()
```

**需要添加应用内通知**:
```typescript
async approveVerification(userId: string, adminId: string) {
  // ... 批准逻辑
  
  // 🔔 添加应用内通知
  await NotificationService.createNotification({
    userId: userId,
    type: 'verification_approved',
    title: '🎉 账户已验证',
    body: '您的账户已通过验证，现在可以创建项目了',
    data: {},
    sendEmail: true // 使用现有邮件模板
  });
}
```

**接收者**: 被验证的用户
**优先级**: HIGH

---

### 7.3 账户验证拒绝
**📍 位置**: `lib/admin-service.ts`
**当前状态**: ⚠️ 部分实现（仅邮件）

**现有代码**:
```typescript
// lib/email/templates.ts
// - getVerificationRejectionEmail()
```

**需要添加应用内通知**:
```typescript
async rejectVerification(userId: string, adminId: string, reason: string) {
  // ... 拒绝逻辑
  
  // 🔔 添加应用内通知
  await NotificationService.createNotification({
    userId: userId,
    type: 'verification_rejected',
    title: '账户验证未通过',
    body: '您的账户验证未通过审核',
    data: { reason },
    sendEmail: true // 使用现有邮件模板
  });
}
```

**接收者**: 被拒绝的用户
**优先级**: HIGH

---

### 7.4 账户暂停
**📍 位置**: `lib/admin-service.ts`
**当前状态**: ⚠️ 部分实现（仅邮件）

**现有代码**:
```typescript
// lib/email/templates.ts
// - getAccountSuspensionEmail()
```

**需要添加应用内通知**:
```typescript
async suspendAccount(userId: string, adminId: string, reason: string) {
  // ... 暂停逻辑
  
  // 🔔 添加应用内通知
  await NotificationService.createNotification({
    userId: userId,
    type: 'account_suspended',
    title: '⚠️ 账户已暂停',
    body: '您的账户已被暂停',
    data: { reason },
    sendEmail: true // 使用现有邮件模板
  });
}
```

**接收者**: 被暂停的用户
**优先级**: CRITICAL

---

## 8️⃣ 归档和保留模块

### 8.1 项目归档
**📍 位置**: `lib/archive-service.ts` → `createArchive()`
**当前状态**: ❌ 未实现通知

```typescript
async createArchive(projectId: string, userId: string) {
  // ... 归档逻辑
  
  // 🔔 通知项目参与者
  const participants = await getProjectParticipants(projectId);
  for (const participant of participants) {
    await NotificationService.createNotification({
      userId: participant.id,
      type: 'project_archived',
      title: '项目已归档',
      body: `项目"${project.title}"已归档，可在归档页面查看`,
      data: { projectId, archiveId },
      sendEmail: false
    });
  }
}
```

**接收者**: 项目参与者（客户和团队）
**优先级**: LOW

---

### 8.2 归档即将删除
**📍 位置**: Cron Job - `app/api/cron/retention-policy/route.ts`
**当前状态**: ❌ 未实现通知

```typescript
export async function GET(request: NextRequest) {
  const archivesToDelete = await getArchivesNearingDeletion(30); // 30天内删除
  
  for (const archive of archivesToDelete) {
    const participants = await getProjectParticipants(archive.project_id);
    
    for (const participant of participants) {
      await NotificationService.createNotification({
        userId: participant.id,
        type: 'archive_deletion_warning',
        title: '⚠️ 归档即将删除',
        body: `项目"${project.title}"的归档将在 ${daysRemaining} 天后删除`,
        data: { archiveId: archive.id, daysRemaining },
        sendEmail: true
      });
    }
  }
}
```

**接收者**: 项目参与者
**优先级**: HIGH

---

### 8.3 法律保留应用
**📍 位置**: `lib/archive-service.ts` → `applyLegalHold()`
**当前状态**: ❌ 未实现通知

```typescript
async applyLegalHold(archiveId: string, adminId: string, reason: string) {
  // ... 应用法律保留逻辑
  
  // 🔔 通知项目参与者
  const participants = await getProjectParticipants(archive.project_id);
  for (const participant of participants) {
    await NotificationService.createNotification({
      userId: participant.id,
      type: 'legal_hold_applied',
      title: '法律保留已应用',
      body: `项目"${project.title}"的归档已应用法律保留`,
      data: { archiveId, reason },
      sendEmail: true
    });
  }
}
```

**接收者**: 项目参与者
**优先级**: HIGH

---

## 📊 实现优先级总结

### 🔴 高优先级（立即实现）
1. ✅ 项目授予通知
2. ✅ 提案提交通知（添加应用内）
3. ✅ 提案评分通知（添加应用内）
4. ✅ 准备交付通知（添加应用内）
5. ✅ 完成接受通知（添加应用内）
6. ✅ 请求修订通知（添加应用内）
7. ✅ 收到新消息通知
8. ✅ 问题回答通知
9. ✅ 账户验证批准/拒绝通知（添加应用内）
10. ✅ 账户暂停通知（添加应用内）

### 🟡 中优先级（近期实现）
1. 项目创建通知
2. 项目审批/拒绝通知
3. 项目截止日期提醒
4. 团队成员加入通知
5. 文档共享通知
6. 章节截止日期提醒
7. 问题发布通知
8. 管理员邀请通知（添加应用内）

### 🟢 低优先级（后续实现）
1. 交付物上传通知
2. 邀请创建通知
3. 文档评论通知
4. 项目归档通知

---

## 🛠️ 实现步骤建议

### 第一阶段：核心通知基础设施
1. ✅ 完善 `NotificationService` 类
2. ✅ 创建数据库表和索引
3. ✅ 实现 RLS 策略
4. ✅ 创建前端通知组件

### 第二阶段：高优先级通知
1. 在现有服务中集成通知调用
2. 为已有邮件模板添加应用内通知
3. 实现实时通知订阅

### 第三阶段：中低优先级通知
1. 创建缺失的服务和 API
2. 实现 Cron Jobs
3. 添加通知偏好设置

### 第四阶段：优化和监控
1. 实现批量处理
2. 添加缓存策略
3. 实现监控和分析
4. 性能优化

---

## 📝 代码模板

### 标准通知集成模板

```typescript
// 在任何业务逻辑函数中添加通知
async function businessLogicFunction() {
  try {
    // 1. 执行业务逻辑
    const result = await performBusinessLogic();
    
    // 2. 检查用户偏好
    const shouldNotify = await NotificationService.shouldSendNotification(
      userId,
      'notification_type'
    );
    
    if (shouldNotify) {
      // 3. 创建通知（非阻塞）
      NotificationService.createNotification({
        userId,
        type: 'notification_type',
        title: '通知标题',
        body: '通知内容',
        data: { /* 相关数据 */ },
        sendEmail: true // 根据需要
      }).catch(error => {
        // 通知失败不应影响主业务逻辑
        console.error('Failed to send notification:', error);
      });
    }
    
    return result;
  } catch (error) {
    // 业务逻辑错误处理
    throw error;
  }
}
```

---

## ✅ 完成检查清单

- [ ] 数据库表创建完成
- [ ] RLS 策略配置完成
- [ ] NotificationService 实现完成
- [ ] EmailService 集成完成
- [ ] 前端通知组件完成
- [ ] 实时通知订阅完成
- [ ] 用户偏好设置完成
- [ ] 所有高优先级通知集成完成
- [ ] 所有中优先级通知集成完成
- [ ] Cron Jobs 创建完成
- [ ] 监控和分析实现完成
- [ ] 单元测试完成
- [ ] 集成测试完成
- [ ] 文档更新完成

---

**文档版本**: 1.0  
**创建日期**: 2024-12-03  
**最后更新**: 2024-12-03
