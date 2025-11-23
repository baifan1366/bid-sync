# Design Document

## Overview

Bidsync is a full-stack web application for collaborative proposal management built on Next.js with TypeScript, Supabase for backend services, and a GraphQL API layer. The system supports four distinct user roles with role-based access control, real-time collaboration features, proposal versioning with diff capabilities, and AI-assisted content generation.

### Key Design Principles

- **Role-based security**: All data access enforced through Supabase Row Level Security (RLS) and GraphQL resolvers
- **Optimistic UI updates**: TanStack Query for client-side state management with optimistic mutations
- **Incremental versioning**: Explicit version snapshots with autosave drafts stored separately
- **Section-level locking**: Soft locks prevent concurrent editing conflicts
- **Modular architecture**: Clear separation between authentication, business logic, and presentation layers

## Architecture

### High-Level System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Client Layer (Browser)                   │
│  Next.js App Router + React + TailwindCSS + TanStack Query  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    API Layer (Next.js)                       │
│              GraphQL API + REST Endpoints                    │
└─────────────────────────────────────────────────────────────┘
                              │
                ┌─────────────┴─────────────┐
                ▼                           ▼
┌──────────────────────────┐   ┌──────────────────────────┐
│   Supabase Services      │   │   External Services      │
│  - PostgreSQL Database   │   │  - OpenAI API            │
│  - Auth                  │   │  - Redis (Cache/Jobs)    │
│  - Storage               │   │  - QStash (Job Queue)    │
│  - Row Level Security    │   │  - Sentry (Monitoring)   │
└──────────────────────────┘   └──────────────────────────┘
```

### Technology Stack


**Frontend:**
- Next.js 14+ (App Router with TypeScript)
- React 18+ with Server Components
- TailwindCSS for styling
- TanStack Query for server state management
- TipTap for rich text editing
- Mermaid for diagrams

**Backend:**
- Next.js API Routes
- GraphQL (with graphql-yoga or Apollo Server)
- Supabase Client SDK

**Database & Storage:**
- PostgreSQL (via Supabase)
- Supabase Storage for file uploads
- Redis for caching and session management

**Authentication:**
- Supabase Auth with JWT tokens
- Row Level Security (RLS) policies

**Background Jobs:**
- QStash for async job processing
- Redis for job queues

**AI Integration:**
- OpenAI API for content generation
- Custom prompt templates

**Monitoring:**
- Sentry for error tracking
- Supabase built-in analytics

## Components and Interfaces

### Frontend Component Architecture

#### Page Structure

```
app/
├── (auth)/
│   ├── login/
│   ├── register/
│   └── verify/
├── (dashboard)/
│   ├── client/
│   │   ├── projects/
│   │   │   ├── [projectId]/
│   │   │   │   ├── proposals/
│   │   │   │   └── compare/
│   │   │   └── new/
│   │   └── dashboard/
│   ├── bidding/
│   │   ├── marketplace/
│   │   ├── proposals/
│   │   │   └── [proposalId]/
│   │   │       ├── workspace/
│   │   │       ├── versions/
│   │   │       └── team/
│   │   └── dashboard/
│   └── admin/
│       ├── users/
│       ├── projects/
│       ├── templates/
│       └── analytics/
└── api/
    ├── graphql/
    ├── auth/
    └── webhooks/
```

#### Core UI Components

**ProposalEditor Component**
- Rich text editor using TipTap
- Section-based structure with collapsible panels
- Real-time soft-locking indicators
- Autosave with debouncing (30s interval)
- Inline AI assistance panel

**VersionTimeline Component**
- Vertical timeline showing all versions
- Version metadata (number, timestamp, author)
- Quick restore and compare actions
- Visual indicators for auto vs manual versions

**CompareModal Component**
- Side-by-side diff view
- Section-level comparison
- Highlighted additions/deletions
- Document metadata comparison
- Export comparison report

**TeamManagement Component**
- Invite link/code generator
- Member list with role badges
- Section assignment interface
- Remove member confirmation

**ComplianceChecklist Component**
- Categorized checklist (Technical/Financial/Legal)
- Toggle completion status
- Progress indicator
- Warning on incomplete submission

**AIAssistPanel Component**
- Prompt templates dropdown
- Custom prompt input
- Loading states
- Apply/Reject generated content
- History of AI suggestions


### GraphQL Schema Design

#### Core Types

```graphql
type User {
  id: ID!
  email: String!
  role: UserRole!
  verificationStatus: VerificationStatus!
  createdAt: DateTime!
  updatedAt: DateTime!
}

enum UserRole {
  CLIENT
  BIDDING_LEAD
  BIDDING_MEMBER
  CONTENT_COORDINATOR
}

enum VerificationStatus {
  PENDING_VERIFICATION
  VERIFIED
  REJECTED
}

type Project {
  id: ID!
  clientId: ID!
  client: User!
  title: String!
  concept: String!
  scope: String!
  budgetRange: String!
  timeline: String!
  requiredDocuments: [String!]!
  status: ProjectStatus!
  proposals: [Proposal!]!
  createdAt: DateTime!
  updatedAt: DateTime!
}

enum ProjectStatus {
  DRAFT
  PENDING_ADMIN_REVIEW
  PUBLISHED
  AWARDED
  CLOSED
  REJECTED
}

type Proposal {
  id: ID!
  projectId: ID!
  project: Project!
  biddingLeadId: ID!
  biddingLead: User!
  status: ProposalStatus!
  inviteCode: String!
  inviteLink: String!
  team: [TeamMember!]!
  sections: [ProposalSection!]!
  documents: [ProposalDocument!]!
  versions: [ProposalVersion!]!
  currentVersion: Int!
  complianceChecklist: ComplianceChecklist!
  internalComments: [Comment!]!
  clientComments: [Comment!]!
  createdAt: DateTime!
  updatedAt: DateTime!
  submittedAt: DateTime
}

enum ProposalStatus {
  DRAFT
  SUBMITTED
  ACCEPTED
  REJECTED
  NOT_SELECTED
}

type TeamMember {
  id: ID!
  proposalId: ID!
  userId: ID!
  user: User!
  assignedSections: [String!]!
  joinedAt: DateTime!
}

type ProposalSection {
  id: ID!
  proposalId: ID!
  sectionType: SectionType!
  content: JSON!
  assignedTo: ID
  assignedUser: User
  lockedBy: ID
  lockedByUser: User
  lockedAt: DateTime
  updatedAt: DateTime!
}

enum SectionType {
  EXECUTIVE_SUMMARY
  TECHNICAL_APPROACH
  TEAM_QUALIFICATIONS
  TIMELINE
  BUDGET
  LEGAL_COMPLIANCE
  ADDITIONAL_INFO
}

type ProposalDocument {
  id: ID!
  proposalId: ID!
  fileName: String!
  fileSize: Int!
  fileType: String!
  storageUrl: String!
  uploadedBy: ID!
  uploadedByUser: User!
  uploadedAt: DateTime!
}

type ProposalVersion {
  id: ID!
  proposalId: ID!
  versionNumber: Int!
  snapshot: JSON!
  createdBy: ID!
  createdByUser: User!
  createdAt: DateTime!
  isRestoration: Boolean!
  restoredFromVersion: Int
}

type ComplianceChecklist {
  id: ID!
  proposalId: ID!
  technicalItems: [ChecklistItem!]!
  financialItems: [ChecklistItem!]!
  legalItems: [ChecklistItem!]!
  completionPercentage: Float!
}

type ChecklistItem {
  id: ID!
  label: String!
  completed: Boolean!
  completedBy: ID
  completedAt: DateTime
}

type Comment {
  id: ID!
  proposalId: ID!
  sectionId: ID
  authorId: ID!
  author: User!
  content: String!
  isInternal: Boolean!
  createdAt: DateTime!
  updatedAt: DateTime!
}
```


#### Key Mutations

```graphql
type Mutation {
  # User & Auth
  verifyClient(userId: ID!, approved: Boolean!, reason: String): User!
  
  # Projects
  createProject(input: CreateProjectInput!): Project!
  updateProject(id: ID!, input: UpdateProjectInput!): Project!
  approveProject(id: ID!): Project!
  rejectProject(id: ID!, reason: String!): Project!
  closeProject(id: ID!): Project!
  
  # Proposals
  createProposal(projectId: ID!): Proposal!
  submitProposal(id: ID!): Proposal!
  acceptProposal(id: ID!): Proposal!
  rejectProposal(id: ID!, feedback: String!): Proposal!
  
  # Team Management
  joinTeam(inviteCode: String!): TeamMember!
  assignSection(proposalId: ID!, userId: ID!, sectionType: SectionType!): TeamMember!
  removeTeamMember(proposalId: ID!, userId: ID!): Boolean!
  
  # Content Editing
  updateSection(id: ID!, content: JSON!): ProposalSection!
  lockSection(id: ID!): ProposalSection!
  unlockSection(id: ID!): ProposalSection!
  
  # Documents
  uploadDocument(proposalId: ID!, file: Upload!): ProposalDocument!
  deleteDocument(id: ID!): Boolean!
  
  # Versioning
  createVersion(proposalId: ID!): ProposalVersion!
  restoreVersion(proposalId: ID!, versionNumber: Int!): Proposal!
  
  # Comments
  createComment(proposalId: ID!, sectionId: ID, content: String!, isInternal: Boolean!): Comment!
  updateComment(id: ID!, content: String!): Comment!
  deleteComment(id: ID!): Boolean!
  
  # Compliance
  updateChecklistItem(proposalId: ID!, itemId: ID!, completed: Boolean!): ChecklistItem!
  
  # AI Assistance
  generateContent(proposalId: ID!, sectionType: SectionType!, prompt: String!): AIGenerationResult!
  rewriteContent(content: String!, tone: String!): AIGenerationResult!
}

type AIGenerationResult {
  content: String!
  metadata: JSON
}
```

#### Key Queries

```graphql
type Query {
  # Users
  me: User!
  pendingClientVerifications: [User!]!
  
  # Projects
  projects(status: ProjectStatus, clientId: ID): [Project!]!
  project(id: ID!): Project
  publishedProjects: [Project!]!
  
  # Proposals
  proposal(id: ID!): Proposal
  myProposals: [Proposal!]!
  projectProposals(projectId: ID!): [Proposal!]!
  
  # Versions
  proposalVersions(proposalId: ID!): [ProposalVersion!]!
  compareVersions(proposalId: ID!, version1: Int!, version2: Int!): VersionComparison!
  
  # Analytics
  dashboardStats(role: UserRole!): DashboardStats!
  platformAnalytics: PlatformAnalytics!
}

type VersionComparison {
  version1: ProposalVersion!
  version2: ProposalVersion!
  sectionDiffs: [SectionDiff!]!
  documentChanges: DocumentChanges!
}

type SectionDiff {
  sectionType: SectionType!
  changes: [TextChange!]!
}

type TextChange {
  type: ChangeType!
  content: String!
  position: Int!
}

enum ChangeType {
  ADDED
  REMOVED
  MODIFIED
}

type DocumentChanges {
  added: [ProposalDocument!]!
  removed: [ProposalDocument!]!
}

type DashboardStats {
  activeProjects: Int!
  pendingActions: Int!
  recentActivity: [Activity!]!
}

type Activity {
  id: ID!
  type: String!
  description: String!
  timestamp: DateTime!
  relatedEntityId: ID
}

type PlatformAnalytics {
  totalUsers: Int!
  totalProjects: Int!
  totalProposals: Int!
  averageProposalsPerProject: Float!
  usersByRole: JSON!
  projectsByStatus: JSON!
}
```


## Data Models

### Database Schema (PostgreSQL via Supabase)

#### Users Table

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('CLIENT', 'BIDDING_LEAD', 'BIDDING_MEMBER', 'CONTENT_COORDINATOR')),
  verification_status TEXT NOT NULL DEFAULT 'PENDING_VERIFICATION' 
    CHECK (verification_status IN ('PENDING_VERIFICATION', 'VERIFIED', 'REJECTED')),
  verification_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_verification_status ON users(verification_status);
```

#### Projects Table

```sql
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  concept TEXT NOT NULL,
  scope TEXT NOT NULL,
  budget_range TEXT NOT NULL,
  timeline TEXT NOT NULL,
  required_documents JSONB NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'DRAFT' 
    CHECK (status IN ('DRAFT', 'PENDING_ADMIN_REVIEW', 'PUBLISHED', 'AWARDED', 'CLOSED', 'REJECTED')),
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_projects_client_id ON projects(client_id);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_created_at ON projects(created_at DESC);
```

#### Proposals Table

```sql
CREATE TABLE proposals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  bidding_lead_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'DRAFT' 
    CHECK (status IN ('DRAFT', 'SUBMITTED', 'ACCEPTED', 'REJECTED', 'NOT_SELECTED')),
  invite_code TEXT UNIQUE NOT NULL,
  invite_link TEXT NOT NULL,
  current_version INT NOT NULL DEFAULT 0,
  rejection_feedback TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_at TIMESTAMPTZ,
  UNIQUE(project_id, bidding_lead_id)
);

CREATE INDEX idx_proposals_project_id ON proposals(project_id);
CREATE INDEX idx_proposals_bidding_lead_id ON proposals(bidding_lead_id);
CREATE INDEX idx_proposals_status ON proposals(status);
CREATE INDEX idx_proposals_invite_code ON proposals(invite_code);
```

#### Team Members Table

```sql
CREATE TABLE team_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  proposal_id UUID NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_sections JSONB NOT NULL DEFAULT '[]',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(proposal_id, user_id)
);

CREATE INDEX idx_team_members_proposal_id ON team_members(proposal_id);
CREATE INDEX idx_team_members_user_id ON team_members(user_id);
```

#### Proposal Sections Table

```sql
CREATE TABLE proposal_sections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  proposal_id UUID NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  section_type TEXT NOT NULL 
    CHECK (section_type IN ('EXECUTIVE_SUMMARY', 'TECHNICAL_APPROACH', 'TEAM_QUALIFICATIONS', 
                            'TIMELINE', 'BUDGET', 'LEGAL_COMPLIANCE', 'ADDITIONAL_INFO')),
  content JSONB NOT NULL DEFAULT '{}',
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  locked_by UUID REFERENCES users(id) ON DELETE SET NULL,
  locked_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(proposal_id, section_type)
);

CREATE INDEX idx_proposal_sections_proposal_id ON proposal_sections(proposal_id);
CREATE INDEX idx_proposal_sections_assigned_to ON proposal_sections(assigned_to);
CREATE INDEX idx_proposal_sections_locked_by ON proposal_sections(locked_by);
```

#### Proposal Documents Table

```sql
CREATE TABLE proposal_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  proposal_id UUID NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_size INT NOT NULL,
  file_type TEXT NOT NULL,
  storage_url TEXT NOT NULL,
  uploaded_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_proposal_documents_proposal_id ON proposal_documents(proposal_id);
CREATE INDEX idx_proposal_documents_uploaded_by ON proposal_documents(uploaded_by);
```

#### Proposal Versions Table

```sql
CREATE TABLE proposal_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  proposal_id UUID NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  version_number INT NOT NULL,
  snapshot JSONB NOT NULL,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_restoration BOOLEAN NOT NULL DEFAULT FALSE,
  restored_from_version INT,
  UNIQUE(proposal_id, version_number)
);

CREATE INDEX idx_proposal_versions_proposal_id ON proposal_versions(proposal_id);
CREATE INDEX idx_proposal_versions_version_number ON proposal_versions(proposal_id, version_number DESC);
```

#### Compliance Checklists Table

```sql
CREATE TABLE compliance_checklists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  proposal_id UUID NOT NULL REFERENCES proposals(id) ON DELETE CASCADE UNIQUE,
  technical_items JSONB NOT NULL DEFAULT '[]',
  financial_items JSONB NOT NULL DEFAULT '[]',
  legal_items JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_compliance_checklists_proposal_id ON compliance_checklists(proposal_id);
```

#### Comments Table

```sql
CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  proposal_id UUID NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  section_id UUID REFERENCES proposal_sections(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_internal BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_comments_proposal_id ON comments(proposal_id);
CREATE INDEX idx_comments_section_id ON comments(section_id);
CREATE INDEX idx_comments_author_id ON comments(author_id);
CREATE INDEX idx_comments_is_internal ON comments(is_internal);
```


### Row Level Security (RLS) Policies

#### Users Table Policies

```sql
-- Users can read their own profile
CREATE POLICY "Users can read own profile" ON users
  FOR SELECT USING (auth.uid() = id);

-- Content Coordinators can read all users
CREATE POLICY "Coordinators can read all users" ON users
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'CONTENT_COORDINATOR'
    )
  );

-- Content Coordinators can update user verification
CREATE POLICY "Coordinators can update verification" ON users
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'CONTENT_COORDINATOR'
    )
  );
```

#### Projects Table Policies

```sql
-- Clients can read their own projects
CREATE POLICY "Clients can read own projects" ON projects
  FOR SELECT USING (client_id = auth.uid());

-- Clients can create projects
CREATE POLICY "Clients can create projects" ON projects
  FOR INSERT WITH CHECK (
    client_id = auth.uid() AND
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND verification_status = 'VERIFIED')
  );

-- Clients can update their own projects
CREATE POLICY "Clients can update own projects" ON projects
  FOR UPDATE USING (client_id = auth.uid());

-- Bidding Leads can read published projects
CREATE POLICY "Leads can read published projects" ON projects
  FOR SELECT USING (
    status = 'PUBLISHED' AND
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('BIDDING_LEAD', 'BIDDING_MEMBER'))
  );

-- Content Coordinators can read and update all projects
CREATE POLICY "Coordinators can manage all projects" ON projects
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'CONTENT_COORDINATOR')
  );
```

#### Proposals Table Policies

```sql
-- Bidding Leads can read their own proposals
CREATE POLICY "Leads can read own proposals" ON proposals
  FOR SELECT USING (bidding_lead_id = auth.uid());

-- Team members can read proposals they're part of
CREATE POLICY "Members can read team proposals" ON proposals
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM team_members 
      WHERE proposal_id = proposals.id AND user_id = auth.uid()
    )
  );

-- Clients can read submitted proposals for their projects
CREATE POLICY "Clients can read submitted proposals" ON proposals
  FOR SELECT USING (
    status IN ('SUBMITTED', 'ACCEPTED', 'REJECTED', 'NOT_SELECTED') AND
    EXISTS (
      SELECT 1 FROM projects 
      WHERE projects.id = proposals.project_id AND projects.client_id = auth.uid()
    )
  );

-- Bidding Leads can create proposals
CREATE POLICY "Leads can create proposals" ON proposals
  FOR INSERT WITH CHECK (bidding_lead_id = auth.uid());

-- Bidding Leads can update their own proposals
CREATE POLICY "Leads can update own proposals" ON proposals
  FOR UPDATE USING (bidding_lead_id = auth.uid());

-- Content Coordinators can read all proposals
CREATE POLICY "Coordinators can read all proposals" ON proposals
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'CONTENT_COORDINATOR')
  );
```

#### Comments Table Policies

```sql
-- Team members can read internal comments for their proposals
CREATE POLICY "Team can read internal comments" ON comments
  FOR SELECT USING (
    is_internal = TRUE AND
    EXISTS (
      SELECT 1 FROM team_members 
      WHERE proposal_id = comments.proposal_id AND user_id = auth.uid()
    )
  );

-- Clients can read non-internal comments for their projects
CREATE POLICY "Clients can read public comments" ON comments
  FOR SELECT USING (
    is_internal = FALSE AND
    EXISTS (
      SELECT 1 FROM proposals p
      JOIN projects pr ON p.project_id = pr.id
      WHERE p.id = comments.proposal_id AND pr.client_id = auth.uid()
    )
  );

-- Team members can create comments
CREATE POLICY "Team can create comments" ON comments
  FOR INSERT WITH CHECK (
    author_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM team_members 
      WHERE proposal_id = comments.proposal_id AND user_id = auth.uid()
    )
  );

-- Content Coordinators can read all comments
CREATE POLICY "Coordinators can read all comments" ON comments
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'CONTENT_COORDINATOR')
  );
```

### Redis Data Structures

#### Autosave Drafts

```
Key: draft:{proposalId}:{sectionId}:{userId}
Value: JSON string of section content
TTL: 24 hours
```

#### Section Locks

```
Key: lock:section:{sectionId}
Value: {userId, username, timestamp}
TTL: 5 minutes (auto-release)
```

#### Job Queue

```
Key: job:ai:{jobId}
Value: {proposalId, sectionType, prompt, status, result}
TTL: 1 hour
```


## Error Handling

### Error Classification

**Client Errors (4xx):**
- `400 Bad Request`: Invalid input data
- `401 Unauthorized`: Missing or invalid authentication
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Resource does not exist
- `409 Conflict`: Resource conflict (e.g., duplicate proposal)
- `422 Unprocessable Entity`: Validation errors

**Server Errors (5xx):**
- `500 Internal Server Error`: Unexpected server error
- `502 Bad Gateway`: External service failure (OpenAI, Supabase)
- `503 Service Unavailable`: Temporary service outage

### Error Response Format

```typescript
interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, any>;
    timestamp: string;
    requestId: string;
  };
}
```

### GraphQL Error Handling

```typescript
// Custom error classes
class AuthenticationError extends Error {
  extensions = { code: 'UNAUTHENTICATED' };
}

class AuthorizationError extends Error {
  extensions = { code: 'FORBIDDEN' };
}

class ValidationError extends Error {
  extensions = { code: 'BAD_USER_INPUT', validationErrors: [] };
}

class NotFoundError extends Error {
  extensions = { code: 'NOT_FOUND' };
}

// Error formatter
const formatError = (error: GraphQLError) => {
  // Log to Sentry
  Sentry.captureException(error);
  
  // Return sanitized error to client
  return {
    message: error.message,
    code: error.extensions?.code || 'INTERNAL_SERVER_ERROR',
    path: error.path,
    timestamp: new Date().toISOString(),
  };
};
```

### Frontend Error Handling

```typescript
// TanStack Query error handling
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        // Don't retry on 4xx errors
        if (error.response?.status < 500) return false;
        return failureCount < 3;
      },
      onError: (error) => {
        // Show toast notification
        toast.error(error.message);
        // Log to Sentry
        Sentry.captureException(error);
      },
    },
    mutations: {
      onError: (error) => {
        toast.error(error.message);
        Sentry.captureException(error);
      },
    },
  },
});
```

### File Upload Error Handling

```typescript
// Validation before upload
const validateFile = (file: File): string | null => {
  const MAX_SIZE = 50 * 1024 * 1024; // 50MB
  const ALLOWED_TYPES = ['application/pdf', 'application/msword', 
                         'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                         'image/jpeg', 'image/png'];
  
  if (file.size > MAX_SIZE) {
    return 'File size exceeds 50MB limit';
  }
  
  if (!ALLOWED_TYPES.includes(file.type)) {
    return 'File type not supported';
  }
  
  return null;
};

// Upload with retry logic
const uploadWithRetry = async (file: File, maxRetries = 3) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await supabase.storage.from('proposals').upload(path, file);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
};
```

### AI Service Error Handling

```typescript
// Graceful degradation for AI failures
const generateContent = async (prompt: string): Promise<string> => {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [{ role: 'user', content: prompt }],
      timeout: 30000, // 30s timeout
    });
    
    return response.choices[0].message.content;
  } catch (error) {
    if (error.code === 'rate_limit_exceeded') {
      throw new Error('AI service is currently busy. Please try again in a moment.');
    }
    
    if (error.code === 'timeout') {
      throw new Error('AI generation timed out. Please try with a shorter prompt.');
    }
    
    // Log to Sentry but don't expose internal details
    Sentry.captureException(error);
    throw new Error('AI generation failed. Please try again or contact support.');
  }
};
```


## Testing Strategy

### Testing Pyramid

```
                    ╱╲
                   ╱  ╲
                  ╱ E2E╲         ~10% (Critical user flows)
                 ╱──────╲
                ╱        ╲
               ╱Integration╲     ~30% (API + DB interactions)
              ╱────────────╲
             ╱              ╲
            ╱  Unit Tests    ╲   ~60% (Business logic)
           ╱──────────────────╲
```

### Unit Testing

**Framework:** Vitest + React Testing Library

**Coverage targets:**
- Business logic functions: 80%+
- GraphQL resolvers: 80%+
- Utility functions: 90%+

**Example test structure:**

```typescript
// tests/unit/versioning.test.ts
describe('Proposal Versioning', () => {
  describe('createVersion', () => {
    it('should create a version snapshot with incremented version number', async () => {
      const proposal = await createTestProposal();
      const version = await createVersion(proposal.id);
      
      expect(version.versionNumber).toBe(1);
      expect(version.snapshot).toMatchObject({
        sections: expect.any(Array),
        documents: expect.any(Array),
      });
    });
    
    it('should throw error if proposal does not exist', async () => {
      await expect(createVersion('invalid-id')).rejects.toThrow(NotFoundError);
    });
  });
  
  describe('compareVersions', () => {
    it('should return section-level diffs between versions', async () => {
      const proposal = await createTestProposal();
      const v1 = await createVersion(proposal.id);
      
      await updateSection(proposal.sections[0].id, { content: 'Updated content' });
      const v2 = await createVersion(proposal.id);
      
      const comparison = await compareVersions(proposal.id, 1, 2);
      
      expect(comparison.sectionDiffs).toHaveLength(1);
      expect(comparison.sectionDiffs[0].changes).toContainEqual({
        type: 'MODIFIED',
        content: expect.any(String),
      });
    });
  });
});
```

### Integration Testing

**Framework:** Vitest + Supertest (for API testing)

**Focus areas:**
- GraphQL mutations and queries
- Authentication flows
- File upload/download
- Database transactions

**Example test:**

```typescript
// tests/integration/proposals.test.ts
describe('Proposal API', () => {
  let client: TestClient;
  let biddingLead: User;
  let project: Project;
  
  beforeEach(async () => {
    client = await createTestClient();
    biddingLead = await createTestUser({ role: 'BIDDING_LEAD' });
    project = await createTestProject({ status: 'PUBLISHED' });
  });
  
  describe('createProposal mutation', () => {
    it('should create proposal and generate invite code', async () => {
      const result = await client.mutate({
        mutation: CREATE_PROPOSAL,
        variables: { projectId: project.id },
        context: { user: biddingLead },
      });
      
      expect(result.data.createProposal).toMatchObject({
        id: expect.any(String),
        projectId: project.id,
        biddingLeadId: biddingLead.id,
        status: 'DRAFT',
        inviteCode: expect.stringMatching(/^[A-Z0-9]{8}$/),
      });
      
      // Verify database state
      const dbProposal = await db.proposals.findUnique({
        where: { id: result.data.createProposal.id },
      });
      expect(dbProposal).toBeTruthy();
    });
    
    it('should prevent duplicate proposals for same lead and project', async () => {
      await client.mutate({
        mutation: CREATE_PROPOSAL,
        variables: { projectId: project.id },
        context: { user: biddingLead },
      });
      
      await expect(
        client.mutate({
          mutation: CREATE_PROPOSAL,
          variables: { projectId: project.id },
          context: { user: biddingLead },
        })
      ).rejects.toThrow('Proposal already exists');
    });
  });
});
```

### End-to-End Testing

**Framework:** Playwright

**Critical flows to test:**
1. Client creates project → Admin approves → Project published
2. Bidding Lead creates proposal → Invites team → Collaborates → Submits
3. Client reviews proposals → Compares → Accepts winner
4. Version creation → Comparison → Restoration

**Example E2E test:**

```typescript
// tests/e2e/proposal-workflow.spec.ts
test.describe('Complete Proposal Workflow', () => {
  test('should allow full proposal lifecycle', async ({ page, context }) => {
    // Setup: Create client and project
    const client = await createTestUser({ role: 'CLIENT', verified: true });
    await loginAs(page, client);
    
    await page.goto('/client/projects/new');
    await page.fill('[name="title"]', 'Test Project');
    await page.fill('[name="concept"]', 'Build a web app');
    await page.fill('[name="budgetRange"]', '$50k-$100k');
    await page.click('button:has-text("Submit for Review")');
    
    // Admin approves
    const adminPage = await context.newPage();
    const admin = await createTestUser({ role: 'CONTENT_COORDINATOR' });
    await loginAs(adminPage, admin);
    await adminPage.goto('/admin/projects');
    await adminPage.click('button:has-text("Approve")');
    
    // Bidding Lead creates proposal
    const leadPage = await context.newPage();
    const lead = await createTestUser({ role: 'BIDDING_LEAD' });
    await loginAs(leadPage, lead);
    await leadPage.goto('/bidding/marketplace');
    await leadPage.click('text=Test Project');
    await leadPage.click('button:has-text("Submit Proposal")');
    
    // Verify workspace created
    await expect(leadPage.locator('h1')).toContainText('Proposal Workspace');
    
    // Edit content
    await leadPage.click('text=Executive Summary');
    await leadPage.fill('[data-testid="editor"]', 'Our approach is...');
    await leadPage.waitForTimeout(31000); // Wait for autosave
    
    // Create version
    await leadPage.click('button:has-text("Create Version")');
    await expect(leadPage.locator('text=Version 1')).toBeVisible();
    
    // Submit proposal
    await leadPage.click('button:has-text("Submit Proposal")');
    await leadPage.click('button:has-text("Confirm")');
    
    // Client reviews and accepts
    await page.goto('/client/projects');
    await page.click('text=Test Project');
    await page.click('text=View Proposals');
    await expect(page.locator('text=1 proposal')).toBeVisible();
    await page.click('button:has-text("Accept")');
    
    // Verify final state
    await expect(page.locator('text=Awarded')).toBeVisible();
  });
});
```

### Performance Testing

**Tools:** k6 for load testing

**Scenarios:**
- Concurrent proposal editing (50 users)
- File upload stress test (100 concurrent uploads)
- Version comparison with large diffs
- Dashboard query performance

**Example k6 script:**

```javascript
// tests/performance/proposal-editing.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 50 }, // Ramp up to 50 users
    { duration: '5m', target: 50 }, // Stay at 50 users
    { duration: '2m', target: 0 },  // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests under 500ms
    http_req_failed: ['rate<0.01'],   // Less than 1% errors
  },
};

export default function () {
  const token = __ENV.TEST_TOKEN;
  const proposalId = __ENV.TEST_PROPOSAL_ID;
  
  // Update section
  const updateResponse = http.post(
    'http://localhost:3000/api/graphql',
    JSON.stringify({
      query: `
        mutation UpdateSection($id: ID!, $content: JSON!) {
          updateSection(id: $id, content: $content) {
            id
            updatedAt
          }
        }
      `,
      variables: {
        id: proposalId,
        content: { text: `Updated at ${Date.now()}` },
      },
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    }
  );
  
  check(updateResponse, {
    'status is 200': (r) => r.status === 200,
    'no errors': (r) => !JSON.parse(r.body).errors,
  });
  
  sleep(1);
}
```


## Key Design Decisions and Rationales

### 1. Versioning Strategy

**Decision:** Separate explicit versions from autosave drafts

**Rationale:**
- Explicit versions provide clear checkpoints for collaboration
- Autosave drafts in Redis reduce database writes and improve performance
- Users can work without fear of losing progress while maintaining clean version history
- Restoration creates new versions to maintain audit trail

**Trade-offs:**
- Additional complexity in managing two storage systems
- Redis dependency for autosave functionality

### 2. Section-Level Locking

**Decision:** Soft locks with automatic expiration (5 minutes)

**Rationale:**
- Prevents concurrent editing conflicts without blocking collaboration
- Visual indicators improve user awareness
- Automatic expiration prevents orphaned locks from user disconnections
- Section-level granularity allows parallel work on different parts

**Trade-offs:**
- Doesn't prevent all conflicts (users can override locks)
- Requires WebSocket or polling for real-time lock updates

### 3. GraphQL vs REST

**Decision:** GraphQL for primary API with REST for file uploads

**Rationale:**
- GraphQL provides flexible querying for complex nested data (proposals with sections, versions, comments)
- Single endpoint simplifies client-side data fetching
- Strong typing with TypeScript integration
- REST for file uploads due to better multipart/form-data support

**Trade-offs:**
- Learning curve for team members unfamiliar with GraphQL
- Additional complexity in error handling and caching

### 4. Supabase for Backend

**Decision:** Use Supabase for auth, database, and storage

**Rationale:**
- Row Level Security provides database-level authorization
- Built-in authentication with JWT tokens
- Real-time subscriptions for collaborative features
- Managed PostgreSQL reduces operational overhead
- Storage service handles file uploads with CDN

**Trade-offs:**
- Vendor lock-in to Supabase ecosystem
- Limited control over database optimizations
- Potential cost scaling with usage

### 5. TipTap for Rich Text Editing

**Decision:** TipTap over alternatives (Quill, Draft.js, Slate)

**Rationale:**
- Built on ProseMirror (battle-tested)
- Excellent TypeScript support
- Extensible architecture for custom features
- Good performance with large documents
- Active community and maintenance

**Trade-offs:**
- Larger bundle size than simpler editors
- Steeper learning curve for customization

### 6. AI Integration Architecture

**Decision:** Async job queue for AI operations

**Rationale:**
- AI API calls can be slow (5-30 seconds)
- Prevents blocking user interface
- Allows retry logic for failed requests
- Can implement rate limiting and cost controls
- Enables batch processing for efficiency

**Trade-offs:**
- Additional infrastructure (Redis + QStash)
- More complex error handling
- Delayed feedback to users

### 7. Compliance Checklist Design

**Decision:** Non-blocking submission with warnings

**Rationale:**
- Provides guidance without restricting user autonomy
- Some items may not apply to all proposals
- Allows flexibility for edge cases
- Still captures compliance status for client review

**Trade-offs:**
- Risk of incomplete submissions
- Requires clear UI warnings

### 8. Comment System Architecture

**Decision:** Separate internal and client-visible comments in same table

**Rationale:**
- Single source of truth for all comments
- Simplified querying and relationships
- RLS policies enforce visibility rules
- Easy to convert internal to public if needed

**Trade-offs:**
- Risk of accidental exposure if RLS misconfigured
- Slightly more complex queries with visibility filtering

### 9. Invite System

**Decision:** Both invite links and codes

**Rationale:**
- Links provide convenience (one-click join)
- Codes offer flexibility for verbal/written communication
- Unique codes prevent unauthorized access
- No email requirement for team members

**Trade-offs:**
- Two mechanisms to maintain
- Potential for code sharing outside intended team

### 10. Dashboard Approach

**Decision:** Role-specific dashboards with shared components

**Rationale:**
- Each role has distinct information needs
- Shared components reduce code duplication
- Easier to optimize queries per role
- Better user experience with relevant information

**Trade-offs:**
- More initial development work
- Multiple dashboard implementations to maintain

## Security Considerations

### Authentication & Authorization

1. **JWT Token Management**
   - Short-lived access tokens (1 hour)
   - Refresh tokens with rotation
   - Secure httpOnly cookies for token storage

2. **Row Level Security**
   - All database access filtered by RLS policies
   - Defense in depth: API + database level checks
   - Regular RLS policy audits

3. **API Rate Limiting**
   - Per-user rate limits (100 req/min)
   - Per-IP rate limits (1000 req/min)
   - Stricter limits for expensive operations (AI, file uploads)

### Data Protection

1. **File Upload Security**
   - Virus scanning on upload
   - File type validation (whitelist)
   - Size limits (50MB per file)
   - Signed URLs with expiration for downloads

2. **Input Validation**
   - GraphQL schema validation
   - Additional business logic validation
   - SQL injection prevention (parameterized queries)
   - XSS prevention (content sanitization)

3. **Sensitive Data**
   - No PII in logs
   - Encrypted at rest (Supabase default)
   - Encrypted in transit (HTTPS only)
   - GDPR compliance (data export/deletion)

### Audit Logging

```typescript
interface AuditLog {
  id: string;
  userId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  changes: Record<string, any>;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
}

// Log critical actions
const auditActions = [
  'proposal.submit',
  'proposal.accept',
  'proposal.reject',
  'version.restore',
  'project.approve',
  'user.verify',
  'team.remove_member',
];
```

## Deployment Architecture

### Infrastructure

```
┌─────────────────────────────────────────────────────────┐
│                     Vercel Edge Network                  │
│                  (Next.js App Hosting)                   │
└─────────────────────────────────────────────────────────┘
                            │
                ┌───────────┴───────────┐
                ▼                       ▼
┌──────────────────────────┐  ┌──────────────────────────┐
│   Supabase (Primary)     │  │   External Services      │
│  - PostgreSQL            │  │  - OpenAI API            │
│  - Auth                  │  │  - Upstash Redis         │
│  - Storage + CDN         │  │  - QStash                │
│  - Realtime              │  │  - Sentry                │
└──────────────────────────┘  └──────────────────────────┘
```

### Environment Configuration

**Development:**
- Local Supabase instance (Docker)
- Local Redis (Docker)
- Mock AI responses

**Staging:**
- Supabase staging project
- Upstash Redis (free tier)
- OpenAI API (rate limited)

**Production:**
- Supabase production project (with backups)
- Upstash Redis (production tier)
- OpenAI API (full access)
- CDN for static assets
- Monitoring and alerting

### Scaling Considerations

1. **Database:**
   - Connection pooling (PgBouncer via Supabase)
   - Read replicas for analytics queries
   - Partitioning for large tables (versions, comments)

2. **File Storage:**
   - CDN caching for frequently accessed files
   - Lifecycle policies for old versions
   - Compression for text documents

3. **API:**
   - Vercel serverless functions (auto-scaling)
   - GraphQL query complexity limits
   - Response caching with Redis

4. **Background Jobs:**
   - QStash for reliable job processing
   - Separate worker functions for AI tasks
   - Job prioritization and retry logic

## Monitoring and Observability

### Metrics to Track

**Application Metrics:**
- Request latency (p50, p95, p99)
- Error rates by endpoint
- Active users (concurrent)
- Proposal creation rate
- Version creation rate
- File upload success rate

**Business Metrics:**
- Projects created per day
- Proposals submitted per project
- Average time to submission
- Proposal acceptance rate
- User engagement (DAU/MAU)

**Infrastructure Metrics:**
- Database connection pool usage
- Redis memory usage
- Storage usage and growth
- API rate limit hits
- Background job queue depth

### Alerting Rules

```yaml
alerts:
  - name: High Error Rate
    condition: error_rate > 5%
    duration: 5m
    severity: critical
    
  - name: Slow API Response
    condition: p95_latency > 2s
    duration: 10m
    severity: warning
    
  - name: Database Connection Pool Exhausted
    condition: pool_usage > 90%
    duration: 5m
    severity: critical
    
  - name: Failed File Uploads
    condition: upload_failure_rate > 10%
    duration: 5m
    severity: warning
```

### Logging Strategy

```typescript
// Structured logging with context
logger.info('Proposal submitted', {
  proposalId: proposal.id,
  projectId: proposal.projectId,
  biddingLeadId: proposal.biddingLeadId,
  versionNumber: proposal.currentVersion,
  duration: Date.now() - startTime,
});

// Error logging with stack traces
logger.error('Version comparison failed', {
  error: error.message,
  stack: error.stack,
  proposalId,
  version1,
  version2,
});
```

## Future Enhancements (Post-MVP)

### Phase 2 Features

1. **Real-time Collaboration**
   - WebSocket connections for live editing
   - Cursor positions and selections
   - Typing indicators

2. **Advanced AI Features**
   - Proposal scoring and recommendations
   - Automated compliance checking
   - Competitive analysis

3. **Notification System**
   - Email notifications
   - In-app notifications
   - Slack/Teams integrations

4. **Template System**
   - Reusable proposal templates
   - Section libraries
   - Custom compliance checklists

5. **Analytics Dashboard**
   - Win rate analysis
   - Team performance metrics
   - Client engagement tracking

### Technical Debt to Address

1. Implement comprehensive E2E test coverage
2. Add database query performance monitoring
3. Optimize bundle size (code splitting)
4. Implement progressive web app (PWA) features
5. Add internationalization (i18n) support

