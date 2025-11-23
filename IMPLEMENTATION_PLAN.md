# Implementation Plan for Remaining Features

## Overview
This document outlines the implementation plan for the remaining critical features requested.

---

## 1. Admin Project Approval ✅ (IN PROGRESS)

### Files Created:
- ✅ `app/(app)/(admin)/admin-dashboard/projects/page.tsx`
- ✅ `components/admin/project-approval-queue.tsx`

### Still Needed:
- [ ] GraphQL schema updates (add `pendingProjects`, `approveProject`, `rejectProject`)
- [ ] GraphQL resolvers
- [ ] Email notifications to clients
- [ ] Activity logging

### Schema Changes:
```graphql
type Query {
  pendingProjects: [Project!]!
}

type Mutation {
  approveProject(projectId: ID!, notes: String): Project!
  rejectProject(projectId: ID!, reason: String!): Project!
  requestChanges(projectId: ID!, changes: String!): Project!
}
```

---

## 2. Q&A / Clarification System

### Database Schema:
```sql
CREATE TABLE project_questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  asked_by UUID NOT NULL REFERENCES auth.users(id),
  question TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE question_answers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  question_id UUID NOT NULL REFERENCES project_questions(id) ON DELETE CASCADE,
  answered_by UUID NOT NULL REFERENCES auth.users(id),
  answer TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_project_questions_project ON project_questions(project_id);
CREATE INDEX idx_question_answers_question ON question_answers(question_id);
```

### GraphQL Schema:
```graphql
type ProjectQuestion {
  id: ID!
  projectId: ID!
  askedBy: User!
  question: String!
  answers: [QuestionAnswer!]!
  createdAt: String!
  updatedAt: String!
}

type QuestionAnswer {
  id: ID!
  questionId: ID!
  answeredBy: User!
  answer: String!
  createdAt: String!
}

type Query {
  projectQuestions(projectId: ID!): [ProjectQuestion!]!
}

type Mutation {
  askQuestion(projectId: ID!, question: String!): ProjectQuestion!
  answerQuestion(questionId: ID!, answer: String!): QuestionAnswer!
  deleteQuestion(questionId: ID!): Boolean!
}
```

### Components Needed:
- `components/client/project-qa-section.tsx` - Q&A display for project page
- `components/client/ask-question-dialog.tsx` - Dialog for asking questions
- `components/lead/answer-question-dialog.tsx` - Dialog for answering
- `components/client/qa-list.tsx` - List of Q&A threads

---

## 3. Member Dashboard

### Route:
- `app/(app)/(member)/member-dashboard/page.tsx`

### Components:
- `components/member/member-dashboard-content.tsx`
- `components/member/assigned-sections.tsx`
- `components/member/my-tasks.tsx`
- `components/member/team-activity.tsx`

### Features:
- View assigned sections across all proposals
- See deadlines and progress
- Quick access to documents
- Team activity feed
- Notifications for assignments

---

## 4. Lead Dashboard Enhancements

### Additional Features Needed:
- Matched projects view (when auto-matching is implemented)
- Bid success rate analytics
- Team performance metrics
- Earnings tracking
- Active bids overview with status

### Components to Create:
- `components/lead/bid-analytics.tsx`
- `components/lead/team-performance.tsx`
- `components/lead/matched-projects.tsx`
- `components/lead/earnings-tracker.tsx`

---

## 5. Admin Analytics

### Route:
- `app/(app)/(admin)/admin-dashboard/analytics/page.tsx`

### Metrics to Track:
- User growth over time
- Project statistics (created, approved, rejected, completed)
- Proposal statistics (submitted, accepted, rejected)
- Revenue tracking
- Platform usage metrics
- Conversion rates

### Components:
- `components/admin/analytics-dashboard.tsx`
- `components/admin/user-growth-chart.tsx`
- `components/admin/project-stats-chart.tsx`
- `components/admin/revenue-chart.tsx`
- `components/admin/platform-metrics.tsx`

### Libraries:
- Use `recharts` for charts
- Date range picker for filtering

---

## 6. Internal Comments (Complete Implementation)

### Database Schema:
```sql
CREATE TABLE document_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  content TEXT NOT NULL,
  is_internal BOOLEAN DEFAULT true,
  parent_id UUID REFERENCES document_comments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_document_comments_document ON document_comments(document_id);
CREATE INDEX idx_document_comments_parent ON document_comments(parent_id);
```

### GraphQL Schema:
```graphql
type DocumentComment {
  id: ID!
  documentId: ID!
  user: User!
  content: String!
  isInternal: Boolean!
  parentId: ID
  replies: [DocumentComment!]!
  createdAt: String!
  updatedAt: String!
}

type Query {
  documentComments(documentId: ID!, includeInternal: Boolean): [DocumentComment!]!
}

type Mutation {
  addComment(documentId: ID!, content: String!, isInternal: Boolean, parentId: ID): DocumentComment!
  updateComment(commentId: ID!, content: String!): DocumentComment!
  deleteComment(commentId: ID!): Boolean!
}
```

### Components:
- `components/editor/comments-panel.tsx`
- `components/editor/comment-thread.tsx`
- `components/editor/add-comment-form.tsx`

---

## 7. Contract Generation

### Database Schema:
```sql
CREATE TABLE contracts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id),
  proposal_id UUID NOT NULL REFERENCES proposals(id),
  template_id UUID REFERENCES contract_templates(id),
  content TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'draft',
  version INT DEFAULT 1,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE contract_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  content TEXT NOT NULL,
  variables JSONB,
  category VARCHAR(100),
  is_active BOOLEAN DEFAULT true,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE contract_signatures (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  signer_id UUID NOT NULL REFERENCES auth.users(id),
  signed_at TIMESTAMPTZ,
  signature_data TEXT,
  ip_address VARCHAR(45),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### GraphQL Schema:
```graphql
type Contract {
  id: ID!
  projectId: ID!
  proposalId: ID!
  template: ContractTemplate
  content: String!
  status: ContractStatus!
  version: Int!
  createdBy: User!
  signatures: [ContractSignature!]!
  createdAt: String!
  updatedAt: String!
}

type ContractTemplate {
  id: ID!
  name: String!
  description: String
  content: String!
  variables: JSON
  category: String
  isActive: Boolean!
}

type ContractSignature {
  id: ID!
  contractId: ID!
  signer: User!
  signedAt: String
  ipAddress: String
}

enum ContractStatus {
  DRAFT
  PENDING_SIGNATURES
  SIGNED
  ACTIVE
  COMPLETED
  CANCELLED
}

type Query {
  contract(id: ID!): Contract
  projectContract(projectId: ID!): Contract
  contractTemplates: [ContractTemplate!]!
}

type Mutation {
  generateContract(projectId: ID!, proposalId: ID!, templateId: ID!): Contract!
  updateContract(contractId: ID!, content: String!): Contract!
  requestSignature(contractId: ID!, signerIds: [ID!]!): Contract!
  signContract(contractId: ID!, signatureData: String!): ContractSignature!
}
```

### Components:
- `components/client/generate-contract-dialog.tsx`
- `components/client/contract-preview.tsx`
- `components/client/contract-editor.tsx`
- `components/admin/contract-templates.tsx`
- `components/shared/signature-pad.tsx`

---

## Implementation Priority

### Week 1:
1. ✅ Admin Project Approval (Complete backend + frontend)
2. Q&A System (Database + GraphQL + Basic UI)

### Week 2:
3. Member Dashboard (Full implementation)
4. Lead Dashboard Enhancements (Analytics + Metrics)

### Week 3:
5. Admin Analytics (Charts + Metrics)
6. Internal Comments (Complete implementation)

### Week 4:
7. Contract Generation (Templates + Generation + Preview)

---

## Dependencies

### NPM Packages to Install:
```bash
npm install recharts date-fns react-signature-canvas
npm install @react-pdf/renderer  # For PDF generation
```

### Environment Variables:
```env
# For e-signature (future)
DOCUSIGN_API_KEY=
DOCUSIGN_SECRET=
```

---

## Testing Checklist

### Admin Project Approval:
- [ ] Admin can view pending projects
- [ ] Admin can approve projects
- [ ] Admin can reject projects with reason
- [ ] Client receives email notification
- [ ] Approved projects appear in marketplace
- [ ] Activity is logged

### Q&A System:
- [ ] Leads can ask questions on projects
- [ ] Clients receive notifications
- [ ] Clients can answer questions
- [ ] All bidders can see Q&A
- [ ] Q&A is searchable

### Member Dashboard:
- [ ] Members see assigned sections
- [ ] Deadlines are displayed
- [ ] Quick navigation to documents
- [ ] Activity feed updates in real-time

### Contract Generation:
- [ ] Templates can be created
- [ ] Contracts auto-populate from proposals
- [ ] Contracts can be edited
- [ ] PDF export works
- [ ] Signature workflow functions

---

*Created: November 23, 2025*
