Client、Project Lead、Project Member、Admin（Content Coordinator）

✅ 全局页面 / Layout（全角色共用）
/login
/signup
/signup/role-selection   ← 注册后选择角色
/verify
/dashboard   ← 自动根据用户角色跳到对应 dashboard
/notifications
/settings
/profile
/search
/messages   ← 私密沟通区（Client & Lead）
/messages/[conversationId]
/ratings   ← 评价系统
/ratings/give/[projectId]
/ratings/view/[userId]

🎭 1. Client 页面架构

Client 的核心是发布项目、查看提案、选择赢家、沟通。

Main
/client
/client/dashboard

Project Management
/client/projects
/client/projects/new
/client/projects/[projectId]
/client/projects/[projectId]/edit
/client/projects/[projectId]/close

Proposals
/client/projects/[projectId]/proposals     ← 所有提交的proposal列表
/client/projects/[projectId]/proposals/[proposalId]
/client/projects/[projectId]/proposals/[proposalId]/versions
/client/projects/[projectId]/proposals/[proposalId]/compare

Decision
/client/projects/[projectId]/proposals/[proposalId]/select
/client/projects/[projectId]/proposals/[proposalId]/reject
/client/projects/[projectId]/proposals/scoring   ← 评分/排序

Communication
/client/projects/[projectId]/qna
/qna/[threadId]
/client/projects/[projectId]/chat/[leadId]   ← 与Lead私密沟通

Contract & Execution
/client/projects/[projectId]/contract   ← 生成合同
/client/projects/[projectId]/contract/sign   ← 电子签名
/client/projects/[projectId]/execution   ← 项目执行管理
/client/projects/[projectId]/execution/tasks   ← 任务列表
/client/projects/[projectId]/execution/milestones   ← 里程碑
/client/projects/[projectId]/execution/gantt   ← 甘特图
/client/projects/[projectId]/execution/payments   ← 付款托管

Completion & Review
/client/projects/[projectId]/delivery   ← 项目交付
/client/projects/[projectId]/archive   ← 文件归档
/client/projects/[projectId]/rate   ← 评价Lead

Disputes
/client/disputes
/client/disputes/[disputeId]
/client/disputes/new?project=[projectId]

🧑‍💼 2. Project Lead 页面架构（Bidding Lead）

Lead 能创建团队、分工、编辑提案、管理版本。

Main
/lead
/lead/dashboard

Available Projects
/lead/projects           ← 客户公开的招标
/lead/projects/[projectId]
/lead/projects/matched   ← 系统自动匹配的项目

Create Proposal & Workspace
/lead/proposals
/lead/proposals/new?project=[projectId]
/lead/proposals/[proposalId]

Proposal Editor Workspace
/lead/proposals/[proposalId]/sections
/lead/proposals/[proposalId]/sections/[sectionId]   ← editor

Documents
/lead/proposals/[proposalId]/documents

Version Control
/lead/proposals/[proposalId]/versions
/lead/proposals/[proposalId]/versions/[versionId]
/lead/proposals/[proposalId]/versions/compare

Team Management
/lead/proposals/[proposalId]/team
/lead/proposals/[proposalId]/team/invite
/lead/proposals/[proposalId]/team/[memberId]

AI Assistant
/lead/proposals/[proposalId]/ai
/lead/proposals/[proposalId]/ai/draft
/lead/proposals/[proposalId]/ai/rewrite
/lead/proposals/[proposalId]/ai/summary

Submit
/lead/proposals/[proposalId]/submit
/lead/proposals/[proposalId]/compliance-check   ← AI合规检查

Communication
/lead/projects/[projectId]/chat/[clientId]   ← 与Client私密沟通

Contract & Execution (After Winning)
/lead/projects/[projectId]/contract   ← 查看/签署合同
/lead/projects/[projectId]/execution   ← 项目执行
/lead/projects/[projectId]/execution/tasks
/lead/projects/[projectId]/execution/milestones
/lead/projects/[projectId]/execution/gantt
/lead/projects/[projectId]/execution/payments   ← 里程碑付款

Completion
/lead/projects/[projectId]/delivery   ← 提交最终交付物
/lead/projects/[projectId]/rate   ← 评价Client

Performance
/lead/analytics   ← 中标率、团队表现

👨‍🔧 3. Project Member 页面架构（Bidding Member）

Member 只能写 content、上传文件、查看任务、跟着 lead 的安排。

Main
/member
/member/dashboard

Assigned Projects
/member/projects
/member/projects/[projectId]

Proposal Workspace
/member/proposals/[proposalId]

Sections
/member/proposals/[proposalId]/sections
/member/proposals/[proposalId]/sections/[sectionId]   ← editor

Internal Comments
/member/proposals/[proposalId]/comments/internal

Files
/member/proposals/[proposalId]/documents

Deadlines
/member/deadlines
/member/deadlines/[proposalId]

🛠️ 4. Admin / Content Coordinator 页面架构

Admin 是最高权限：管理用户、项目、审查提案、模板、平台设置。

Main
/admin
/admin/dashboard

User & Role Management
/admin/users
/admin/users/new
/admin/users/[userId]
/admin/users/[userId]/edit

Project Oversight
/admin/projects
/admin/projects/[projectId]
/admin/projects/[projectId]/verify-client

Proposals
/admin/proposals
/admin/proposals/[proposalId]
/admin/proposals/[proposalId]/versions
/admin/proposals/[proposalId]/comments
/admin/proposals/[proposalId]/review
/admin/proposals/[proposalId]/compliance

Templates Management
/admin/templates
/admin/templates/proposal
/admin/templates/proposal/[templateId]

/admin/templates/checklists
/admin/templates/checklists/[checklistId]

System Settings
/admin/settings
/admin/settings/ai
/admin/settings/storage
/admin/settings/security

Analytics & Reporting
/admin/analytics
/admin/analytics/users
/admin/analytics/projects
/admin/analytics/proposals
/admin/analytics/compliance

Auto-Matching System
/admin/matching
/admin/matching/settings   ← 配置匹配算法
/admin/matching/rules   ← 匹配规则管理

Contract Management
/admin/contracts
/admin/contracts/templates   ← 合同模板
/admin/contracts/[contractId]

Payment & Escrow
/admin/payments
/admin/payments/escrow   ← 托管账户管理
/admin/payments/releases   ← 付款发放审核
/admin/payments/disputes   ← 付款争议

Dispute Center
/admin/disputes
/admin/disputes/[disputeId]
/admin/disputes/[disputeId]/evidence
/admin/disputes/[disputeId]/mediate
/admin/disputes/[disputeId]/resolve

Audit & Compliance
/admin/audit-log   ← 完整审计日志
/admin/audit-log/export
/admin/security-events   ← 安全事件监控

Ratings & Reviews
/admin/ratings
/admin/ratings/moderation   ← 评价审核

🟨 主题架构（黄白 / 黄黑）

你提供的设计方向：

Theme	Foreground	Background	Accent
Light	#1A1A1A	#FFFFFF	#FFD400（鲜黄色）
Dark	#F4F4F4	#0D0D0D	#FFD400（亮黄色）

所有 UI Page 都用：

Card = 边框浅黄/深灰

Hover = 透明黄渐变

Button = 黄色主按钮 + 黑文字（light），黑按钮 + 黄色文字（dark）