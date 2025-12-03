# Design Document

## Overview

The Project Delivery and Archival system provides a comprehensive solution for managing project completion workflows, deliverable submissions, client reviews, and long-term data archival. This feature extends the existing BidSync platform to handle the final stages of the project lifecycle, ensuring proper documentation, storage, and retrieval of completed work.

The system integrates with existing project management, proposal tracking, and storage infrastructure while introducing new components for deliverable management, archival processes, and data retention policies.

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Client Layer                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Deliverable │  │   Review     │  │   Archive    │      │
│  │  Upload UI   │  │   Interface  │  │   Viewer     │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   GraphQL API Layer                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Deliverable │  │   Archive    │  │   Export     │      │
│  │  Resolvers   │  │   Resolvers  │  │   Resolvers  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   Service Layer                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Deliverable │  │   Archive    │  │   Retention  │      │
│  │  Service     │  │   Service    │  │   Service    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   Data Layer                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  PostgreSQL  │  │   Supabase   │  │   Queue      │      │
│  │  (Supabase)  │  │   Storage    │  │   (Redis)    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

### Component Interaction Flow

1. **Deliverable Upload Flow**:
   - Bidding Lead uploads files → Storage Service → Database record created → Notification sent to Client

2. **Completion Flow**:
   - Bidding Lead marks ready → Status change → Client notification → Review interface enabled

3. **Archival Flow**:
   - Client accepts completion → Status change to completed → Archive Service triggered → Data compressed and stored → Notifications sent

4. **Retrieval Flow**:
   - User requests archive → Permission check → Archive Service retrieves data → Decompression → Read-only view rendered

## Components and Interfaces

### 1. Database Schema

#### Deliverables Table
```sql
CREATE TABLE public.project_deliverables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    proposal_id UUID NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
    uploaded_by UUID NOT NULL REFERENCES auth.users(id),
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size BIGINT NOT NULL,
    description TEXT,
    version INT NOT NULL DEFAULT 1,
    is_final BOOLEAN DEFAULT false,
    uploaded_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT deliverables_file_size_check CHECK (file_size > 0 AND file_size <= 104857600)
);

CREATE INDEX idx_deliverables_project ON public.project_deliverables(project_id);
CREATE INDEX idx_deliverables_proposal ON public.project_deliverables(proposal_id);
CREATE INDEX idx_deliverables_uploaded_by ON public.project_deliverables(uploaded_by);
CREATE INDEX idx_deliverables_uploaded_at ON public.project_deliverables(uploaded_at DESC);
```

#### Project Completion Table
```sql
CREATE TABLE public.project_completions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE UNIQUE,
    proposal_id UUID NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
    submitted_by UUID NOT NULL REFERENCES auth.users(id),
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    reviewed_by UUID REFERENCES auth.users(id),
    reviewed_at TIMESTAMPTZ,
    review_status TEXT NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending', 'accepted', 'revision_requested')),
    review_comments TEXT,
    revision_count INT DEFAULT 0,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_completions_project ON public.project_completions(project_id);
CREATE INDEX idx_completions_status ON public.project_completions(review_status);
CREATE INDEX idx_completions_submitted_at ON public.project_completions(submitted_at DESC);
```

#### Project Archives Table
```sql
CREATE TABLE public.project_archives (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE UNIQUE,
    archive_identifier TEXT NOT NULL UNIQUE,
    archive_data JSONB NOT NULL,
    compressed_size BIGINT NOT NULL,
    original_size BIGINT NOT NULL,
    compression_ratio NUMERIC(5,2),
    archived_by UUID NOT NULL REFERENCES auth.users(id),
    archived_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    retention_until TIMESTAMPTZ,
    legal_hold BOOLEAN DEFAULT false,
    legal_hold_reason TEXT,
    access_count INT DEFAULT 0,
    last_accessed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_archives_project ON public.project_archives(project_id);
CREATE INDEX idx_archives_identifier ON public.project_archives(archive_identifier);
CREATE INDEX idx_archives_archived_at ON public.project_archives(archived_at DESC);
CREATE INDEX idx_archives_retention ON public.project_archives(retention_until) WHERE retention_until IS NOT NULL;
CREATE INDEX idx_archives_legal_hold ON public.project_archives(legal_hold) WHERE legal_hold = true;
```

#### Revision History Table
```sql
CREATE TABLE public.completion_revisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    completion_id UUID NOT NULL REFERENCES public.project_completions(id) ON DELETE CASCADE,
    revision_number INT NOT NULL,
    requested_by UUID NOT NULL REFERENCES auth.users(id),
    requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    revision_notes TEXT NOT NULL,
    resolved_by UUID REFERENCES auth.users(id),
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(completion_id, revision_number)
);

CREATE INDEX idx_revisions_completion ON public.completion_revisions(completion_id);
CREATE INDEX idx_revisions_requested_at ON public.completion_revisions(requested_at DESC);
```

#### Export Requests Table
```sql
CREATE TABLE public.project_exports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    requested_by UUID NOT NULL REFERENCES auth.users(id),
    requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    export_path TEXT,
    export_size BIGINT,
    expires_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_exports_project ON public.project_exports(project_id);
CREATE INDEX idx_exports_requested_by ON public.project_exports(requested_by);
CREATE INDEX idx_exports_status ON public.project_exports(status);
CREATE INDEX idx_exports_expires ON public.project_exports(expires_at) WHERE expires_at IS NOT NULL;
```

### 2. GraphQL Schema

```graphql
# Enums
enum ReviewStatus {
  PENDING
  ACCEPTED
  REVISION_REQUESTED
}

enum ExportStatus {
  PENDING
  PROCESSING
  COMPLETED
  FAILED
}

# Types
type Deliverable {
  id: ID!
  projectId: ID!
  proposalId: ID!
  uploadedBy: User!
  fileName: String!
  filePath: String!
  fileType: String!
  fileSize: Int!
  description: String
  version: Int!
  isFinal: Boolean!
  uploadedAt: String!
  downloadUrl: String!
}

type ProjectCompletion {
  id: ID!
  projectId: ID!
  proposalId: ID!
  submittedBy: User!
  submittedAt: String!
  reviewedBy: User
  reviewedAt: String
  reviewStatus: ReviewStatus!
  reviewComments: String
  revisionCount: Int!
  completedAt: String
  deliverables: [Deliverable!]!
  revisions: [CompletionRevision!]!
}

type CompletionRevision {
  id: ID!
  revisionNumber: Int!
  requestedBy: User!
  requestedAt: String!
  revisionNotes: String!
  resolvedBy: User
  resolvedAt: String
}

type ProjectArchive {
  id: ID!
  projectId: ID!
  archiveIdentifier: String!
  compressedSize: Int!
  originalSize: Int!
  compressionRatio: Float!
  archivedBy: User!
  archivedAt: String!
  retentionUntil: String
  legalHold: Boolean!
  legalHoldReason: String
  accessCount: Int!
  lastAccessedAt: String
  project: ArchivedProject!
}

type ArchivedProject {
  id: ID!
  title: String!
  description: String!
  budget: Float
  deadline: String
  clientId: ID!
  status: String!
  proposals: [ArchivedProposal!]!
  deliverables: [Deliverable!]!
  documents: [ArchivedDocument!]!
  comments: [ArchivedComment!]!
}

type ArchivedProposal {
  id: ID!
  leadId: ID!
  status: String!
  submittedAt: String
  versions: [ArchivedVersion!]!
}

type ArchivedVersion {
  versionNumber: Int!
  content: String!
  createdBy: ID!
  createdAt: String!
}

type ArchivedDocument {
  id: ID!
  title: String!
  content: String!
  createdBy: ID!
  createdAt: String!
}

type ArchivedComment {
  id: ID!
  authorId: ID!
  message: String!
  visibility: String!
  createdAt: String!
}

type ProjectExport {
  id: ID!
  projectId: ID!
  requestedBy: User!
  requestedAt: String!
  status: ExportStatus!
  exportPath: String
  exportSize: Int
  expiresAt: String
  downloadUrl: String
  errorMessage: String
}

type CompletionStatistics {
  totalCompleted: Int!
  averageTimeToCompletion: Float!
  projectsRequiringRevisions: Int!
  totalDeliverablesReceived: Int!
  completionsByMonth: [MonthlyCompletion!]!
}

type MonthlyCompletion {
  month: String!
  count: Int!
}

# Inputs
input UploadDeliverableInput {
  projectId: ID!
  proposalId: ID!
  fileName: String!
  filePath: String!
  fileType: String!
  fileSize: Int!
  description: String
}

input MarkReadyForDeliveryInput {
  projectId: ID!
  proposalId: ID!
}

input ReviewCompletionInput {
  completionId: ID!
  reviewStatus: ReviewStatus!
  reviewComments: String
}

input RequestRevisionInput {
  completionId: ID!
  revisionNotes: String!
}

input RequestExportInput {
  projectId: ID!
}

# Queries
type Query {
  deliverables(projectId: ID!): [Deliverable!]!
  projectCompletion(projectId: ID!): ProjectCompletion
  projectArchive(projectId: ID): ProjectArchive
  projectArchiveByIdentifier(archiveIdentifier: String!): ProjectArchive
  searchArchives(query: String!, limit: Int, offset: Int): [ProjectArchive!]!
  projectExport(exportId: ID!): ProjectExport
  projectExports(projectId: ID!): [ProjectExport!]!
  completionStatistics(dateFrom: String, dateTo: String): CompletionStatistics!
}

# Mutations
type Mutation {
  uploadDeliverable(input: UploadDeliverableInput!): Deliverable!
  deleteDeliverable(deliverableId: ID!): Boolean!
  markReadyForDelivery(input: MarkReadyForDeliveryInput!): ProjectCompletion!
  reviewCompletion(input: ReviewCompletionInput!): ProjectCompletion!
  acceptCompletion(completionId: ID!): ProjectCompletion!
  requestRevision(input: RequestRevisionInput!): CompletionRevision!
  requestExport(input: RequestExportInput!): ProjectExport!
  applyLegalHold(archiveId: ID!, reason: String!): ProjectArchive!
  removeLegalHold(archiveId: ID!): ProjectArchive!
}
```

### 3. Service Layer

#### DeliverableService
```typescript
class DeliverableService {
  async uploadDeliverable(input: UploadDeliverableInput, userId: string): Promise<Deliverable>
  async getDeliverables(projectId: string): Promise<Deliverable[]>
  async deleteDeliverable(deliverableId: string, userId: string): Promise<boolean>
  async generateDownloadUrl(deliverableId: string): Promise<string>
  async validateFileSize(fileSize: number): boolean
  async getDeliverablesByProposal(proposalId: string): Promise<Deliverable[]>
}
```

#### CompletionService
```typescript
class CompletionService {
  async markReadyForDelivery(projectId: string, proposalId: string, userId: string): Promise<ProjectCompletion>
  async reviewCompletion(completionId: string, status: ReviewStatus, comments: string, userId: string): Promise<ProjectCompletion>
  async acceptCompletion(completionId: string, userId: string): Promise<ProjectCompletion>
  async requestRevision(completionId: string, notes: string, userId: string): Promise<CompletionRevision>
  async getCompletion(projectId: string): Promise<ProjectCompletion | null>
  async validateReadyForDelivery(projectId: string): Promise<boolean>
}
```

#### ArchiveService
```typescript
class ArchiveService {
  async createArchive(projectId: string, userId: string): Promise<ProjectArchive>
  async getArchive(projectId: string): Promise<ProjectArchive | null>
  async getArchiveByIdentifier(identifier: string): Promise<ProjectArchive | null>
  async searchArchives(query: string, limit: number, offset: number): Promise<ProjectArchive[]>
  async incrementAccessCount(archiveId: string): Promise<void>
  async compressArchiveData(data: any): Promise<{ compressed: any, size: number, ratio: number }>
  async decompressArchiveData(compressed: any): Promise<any>
  async collectProjectData(projectId: string): Promise<any>
}
```

#### RetentionService
```typescript
class RetentionService {
  async applyRetentionPolicy(archiveId: string): Promise<void>
  async getArchivesForDeletion(): Promise<ProjectArchive[]>
  async markForDeletion(archiveId: string): Promise<void>
  async deleteArchive(archiveId: string): Promise<void>
  async applyLegalHold(archiveId: string, reason: string, userId: string): Promise<ProjectArchive>
  async removeLegalHold(archiveId: string, userId: string): Promise<ProjectArchive>
  async sendDeletionNotifications(archiveId: string): Promise<void>
}
```

#### ExportService
```typescript
class ExportService {
  async requestExport(projectId: string, userId: string): Promise<ProjectExport>
  async processExport(exportId: string): Promise<void>
  async generateExportPackage(projectId: string): Promise<{ path: string, size: number }>
  async getExport(exportId: string): Promise<ProjectExport | null>
  async getExportsByProject(projectId: string): Promise<ProjectExport[]>
  async generateDownloadUrl(exportId: string): Promise<string>
  async cleanupExpiredExports(): Promise<void>
}
```

#### StatisticsService
```typescript
class StatisticsService {
  async getCompletionStatistics(dateFrom?: Date, dateTo?: Date): Promise<CompletionStatistics>
  async calculateAverageTimeToCompletion(dateFrom?: Date, dateTo?: Date): Promise<number>
  async getCompletionsByMonth(dateFrom?: Date, dateTo?: Date): Promise<MonthlyCompletion[]>
  async getRevisionStatistics(dateFrom?: Date, dateTo?: Date): Promise<number>
}
```

## Data Models

### Deliverable Model
```typescript
interface Deliverable {
  id: string;
  projectId: string;
  proposalId: string;
  uploadedBy: string;
  fileName: string;
  filePath: string;
  fileType: string;
  fileSize: number;
  description?: string;
  version: number;
  isFinal: boolean;
  uploadedAt: Date;
}
```

### ProjectCompletion Model
```typescript
interface ProjectCompletion {
  id: string;
  projectId: string;
  proposalId: string;
  submittedBy: string;
  submittedAt: Date;
  reviewedBy?: string;
  reviewedAt?: Date;
  reviewStatus: 'pending' | 'accepted' | 'revision_requested';
  reviewComments?: string;
  revisionCount: number;
  completedAt?: Date;
}
```

### ProjectArchive Model
```typescript
interface ProjectArchive {
  id: string;
  projectId: string;
  archiveIdentifier: string;
  archiveData: any; // JSONB containing all project data
  compressedSize: number;
  originalSize: number;
  compressionRatio: number;
  archivedBy: string;
  archivedAt: Date;
  retentionUntil?: Date;
  legalHold: boolean;
  legalHoldReason?: string;
  accessCount: number;
  lastAccessedAt?: Date;
}
```

### Archive Data Structure
```typescript
interface ArchiveData {
  project: {
    id: string;
    title: string;
    description: string;
    budget?: number;
    deadline?: Date;
    clientId: string;
    status: string;
    createdAt: Date;
    completedAt: Date;
  };
  proposals: Array<{
    id: string;
    leadId: string;
    status: string;
    submittedAt?: Date;
    versions: Array<{
      versionNumber: number;
      content: any;
      createdBy: string;
      createdAt: Date;
    }>;
  }>;
  deliverables: Deliverable[];
  workspaces: Array<{
    id: string;
    name: string;
    documents: Array<{
      id: string;
      title: string;
      content: any;
      createdBy: string;
      createdAt: Date;
    }>;
  }>;
  comments: Array<{
    id: string;
    authorId: string;
    message: string;
    visibility: string;
    createdAt: Date;
  }>;
  metadata: {
    archivedAt: Date;
    archivedBy: string;
    version: string;
  };
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*


### Property 1: Deliverable metadata completeness
*For any* uploaded deliverable, the stored record should contain all required metadata fields: filename, file type, size, upload timestamp, and uploader identity.
**Validates: Requirements 1.2**

### Property 2: File size validation
*For any* file upload attempt, files exceeding 100MB should be rejected, and files under 100MB should be accepted.
**Validates: Requirements 1.3**

### Property 3: Description persistence
*For any* deliverable with a description, querying the deliverable should return the same description text that was provided during upload.
**Validates: Requirements 1.4**

### Property 4: Deliverable chronological ordering
*For any* set of deliverables for a project, when retrieved, they should be ordered by upload timestamp in ascending order.
**Validates: Requirements 1.5**

### Property 5: Ready for delivery status transition
*For any* project in "awarded" status with at least one deliverable, marking it ready for delivery should result in "pending_completion" status.
**Validates: Requirements 2.1**

### Property 6: Completion notification creation
*For any* project status change to "pending_completion", a notification record should be created for the project's client.
**Validates: Requirements 2.2**

### Property 7: Ready for delivery validation
*For any* project with zero deliverables, attempting to mark it ready for delivery should fail with an error.
**Validates: Requirements 2.3**

### Property 8: Submission audit trail
*For any* project marked ready for delivery, the completion record should contain a non-null submission timestamp and the submitter's user ID.
**Validates: Requirements 2.4**

### Property 9: Pending completion upload restriction
*For any* project in "pending_completion" status, attempting to upload additional deliverables should fail.
**Validates: Requirements 2.5**

### Property 10: Deliverable download integrity
*For any* deliverable, downloading it should return file content that matches the originally uploaded file.
**Validates: Requirements 3.2**

### Property 11: Review comment persistence
*For any* review comment added to a project, querying the project's completion record should return the comment associated with the correct project.
**Validates: Requirements 3.5**

### Property 12: Acceptance status transition
*For any* project in "pending_completion" status, accepting completion should result in "completed" status.
**Validates: Requirements 4.1**

### Property 13: Completion audit trail
*For any* completed project, the completion record should contain a non-null completion timestamp and the client's user ID.
**Validates: Requirements 4.2**

### Property 14: Team completion notifications
*For any* project marked completed, notification records should exist for all bidding team members associated with the project.
**Validates: Requirements 4.3**

### Property 15: Completed project immutability
*For any* project in "completed" status, attempting to modify or delete deliverables should fail.
**Validates: Requirements 4.4**

### Property 16: Archival trigger
*For any* project marked completed, an archive record should be created containing the project data.
**Validates: Requirements 4.5**

### Property 17: Revision status transition
*For any* project in "pending_completion" status, requesting revisions should result in "awarded" status.
**Validates: Requirements 5.1**

### Property 18: Revision notes requirement
*For any* revision request, attempting to submit without revision notes should fail with a validation error.
**Validates: Requirements 5.2**

### Property 19: Revision notification with notes
*For any* revision request, a notification record should exist for the bidding lead containing the revision notes.
**Validates: Requirements 5.3**

### Property 20: Post-revision upload enablement
*For any* project returned to "awarded" status after revision request, uploading deliverables should succeed.
**Validates: Requirements 5.4**

### Property 21: Revision history preservation
*For any* project with revision requests, all revision records should be queryable with their timestamps in chronological order.
**Validates: Requirements 5.5**

### Property 22: Archive creation on completion
*For any* project with "completed" status, an archive record should exist in the database.
**Validates: Requirements 6.1**

### Property 23: Archive data completeness
*For any* archive, the archive data should contain project details, all proposals, all deliverables, all workspace documents, all comments, and all version history.
**Validates: Requirements 6.2**

### Property 24: Archive identifier uniqueness
*For any* two different archives, their archive identifiers should be distinct.
**Validates: Requirements 6.3**

### Property 25: Archive timestamp presence
*For any* archive, the archived_at timestamp field should be non-null and represent a valid timestamp.
**Validates: Requirements 6.4**

### Property 26: Archive compression effectiveness
*For any* archive, the compressed size should be less than or equal to the original size, and the compression ratio should be calculated correctly.
**Validates: Requirements 6.5**

### Property 27: Archive search accuracy
*For any* search query, returned archives should only include those where the query matches the project title, description, or archive identifier.
**Validates: Requirements 7.3**

### Property 28: Archive access authorization
*For any* user with appropriate permissions (client or team member), access to the archive should be granted; for users without permissions, access should be denied.
**Validates: Requirements 7.4**

### Property 29: Retention period marking
*For any* archive older than the configured retention period, the archive should be marked for deletion (unless legal hold is applied).
**Validates: Requirements 8.1**

### Property 30: Deletion notification creation
*For any* archive marked for deletion, notification records should exist for all relevant stakeholders (client and team members).
**Validates: Requirements 8.2**

### Property 31: Grace period deletion
*For any* archive past its deletion grace period (and not under legal hold), the archive should no longer exist in the database.
**Validates: Requirements 8.3**

### Property 32: Deletion audit logging
*For any* deleted archive, an audit log entry should exist containing the deletion timestamp and the administrator's user ID.
**Validates: Requirements 8.4**

### Property 33: Legal hold deletion prevention
*For any* archive with legal hold applied, deletion attempts should fail regardless of retention period expiration.
**Validates: Requirements 8.5**

### Property 34: Export package completeness
*For any* export request, the generated package should contain all project data including deliverables, workspace documents, proposal versions, and comments.
**Validates: Requirements 9.1, 9.2**

### Property 35: Export metadata format
*For any* export, the metadata should be valid JSON and contain all required fields (project info, export timestamp, version).
**Validates: Requirements 9.3**

### Property 36: Export completion notification
*For any* export request, when processing completes (successfully or with error), a notification should be sent to the requesting user.
**Validates: Requirements 9.4**

### Property 37: Export link expiration
*For any* export, the download link should be accessible before 7 days from creation and should fail after 7 days.
**Validates: Requirements 9.5**

### Property 38: Average completion time calculation
*For any* set of completed projects within a date range, the calculated average time from award to completion should equal the sum of individual completion times divided by the count.
**Validates: Requirements 10.2**

### Property 39: Statistics date range filtering
*For any* date range filter applied to statistics, only projects with completion dates within that range should be included in the calculations.
**Validates: Requirements 10.5**

## Error Handling

### Error Categories

1. **Validation Errors**
   - File size exceeds limit (100MB)
   - Missing required fields (revision notes, descriptions)
   - Invalid status transitions
   - Empty deliverables list when marking ready

2. **Authorization Errors**
   - User not authorized to upload deliverables
   - User not authorized to review completion
   - User not authorized to access archives
   - User not authorized to apply legal hold

3. **State Errors**
   - Cannot upload deliverables in wrong project status
   - Cannot modify completed projects
   - Cannot delete archives under legal hold
   - Cannot mark ready without deliverables

4. **Storage Errors**
   - File upload to storage service failed
   - File download from storage service failed
   - Archive compression failed
   - Export generation failed

5. **Data Integrity Errors**
   - Project not found
   - Deliverable not found
   - Archive not found
   - Completion record not found

### Error Response Format

```typescript
interface ErrorResponse {
  code: string;
  message: string;
  details?: any;
  timestamp: Date;
}
```

### Error Handling Strategy

1. **Validation Errors**: Return 400 Bad Request with descriptive message
2. **Authorization Errors**: Return 403 Forbidden with minimal information
3. **Not Found Errors**: Return 404 Not Found
4. **State Errors**: Return 409 Conflict with current state information
5. **Storage Errors**: Return 500 Internal Server Error, log details, retry if transient
6. **Database Errors**: Return 500 Internal Server Error, log details, rollback transaction

### Retry Logic

- Storage operations: 3 retries with exponential backoff
- Archive compression: 2 retries
- Export generation: 2 retries
- Notification sending: 3 retries with exponential backoff

### Logging

All errors should be logged with:
- Error type and code
- User ID (if authenticated)
- Request context (project ID, deliverable ID, etc.)
- Stack trace (for server errors)
- Timestamp

## Testing Strategy

### Unit Testing

The testing strategy employs both unit tests and property-based tests to ensure comprehensive coverage:

**Unit tests** verify specific examples, edge cases, and error conditions:
- File upload with valid metadata
- File upload exceeding size limit
- Status transitions (awarded → pending_completion → completed)
- Status transitions with revisions (pending_completion → awarded)
- Archive creation with empty project data
- Archive creation with complete project data
- Export generation for small projects
- Export generation for large projects
- Legal hold application and removal
- Retention policy enforcement
- Search with exact matches
- Search with partial matches
- Permission checks for different user roles

**Unit tests should focus on**:
- Specific examples that demonstrate correct behavior
- Edge cases (empty data, maximum sizes, boundary conditions)
- Error conditions (invalid inputs, unauthorized access)
- Integration points between services

### Property-Based Testing

**Property-based tests** verify universal properties that should hold across all inputs using **fast-check** (JavaScript/TypeScript property-based testing library).

Each property-based test should:
- Run a minimum of 100 iterations
- Be tagged with a comment explicitly referencing the correctness property from this design document
- Use the format: `**Feature: project-delivery-archival, Property {number}: {property_text}**`
- Generate random but valid test data
- Verify the property holds for all generated inputs

**Property test examples**:

```typescript
// **Feature: project-delivery-archival, Property 1: Deliverable metadata completeness**
test('uploaded deliverables contain all required metadata', async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.record({
        fileName: fc.string({ minLength: 1 }),
        fileType: fc.constantFrom('pdf', 'docx', 'zip', 'png'),
        fileSize: fc.integer({ min: 1, max: 100 * 1024 * 1024 }),
        description: fc.option(fc.string()),
      }),
      async (fileData) => {
        const deliverable = await uploadDeliverable(fileData);
        expect(deliverable.fileName).toBeDefined();
        expect(deliverable.fileType).toBeDefined();
        expect(deliverable.fileSize).toBeDefined();
        expect(deliverable.uploadedAt).toBeDefined();
        expect(deliverable.uploadedBy).toBeDefined();
      }
    ),
    { numRuns: 100 }
  );
});

// **Feature: project-delivery-archival, Property 26: Archive compression effectiveness**
test('archive compression reduces or maintains size', async () => {
  await fc.assert(
    fc.asyncProperty(
      generateRandomProjectData(),
      async (projectData) => {
        const archive = await createArchive(projectData);
        expect(archive.compressedSize).toBeLessThanOrEqual(archive.originalSize);
        const expectedRatio = archive.compressedSize / archive.originalSize;
        expect(archive.compressionRatio).toBeCloseTo(expectedRatio, 2);
      }
    ),
    { numRuns: 100 }
  );
});
```

### Integration Testing

Integration tests verify the interaction between components:
- End-to-end deliverable upload flow
- Complete project completion workflow
- Archive creation and retrieval flow
- Export generation and download flow
- Retention policy execution flow

### Performance Testing

Performance benchmarks for:
- File upload (various sizes up to 100MB)
- Archive creation (various project sizes)
- Archive compression (various data sizes)
- Export generation (various project sizes)
- Search queries (various result set sizes)

Target performance metrics:
- File upload: < 5 seconds for 100MB file
- Archive creation: < 30 seconds for typical project
- Archive compression: < 10 seconds for typical project
- Export generation: < 60 seconds for typical project
- Search queries: < 2 seconds for any result set

### Security Testing

Security tests verify:
- Authorization checks for all operations
- File upload validation (size, type)
- SQL injection prevention in search queries
- Access control for archived data
- Legal hold enforcement

## Implementation Notes

### Storage Service Integration

The system uses Supabase Storage for file persistence:

```typescript
// Upload deliverable file
const { data, error } = await supabase.storage
  .from('deliverables')
  .upload(`${projectId}/${deliverableId}/${fileName}`, file);

// Generate download URL
const { data: { signedUrl } } = await supabase.storage
  .from('deliverables')
  .createSignedUrl(filePath, 3600); // 1 hour expiry
```

### Archive Compression

Archives use gzip compression for JSONB data:

```typescript
import { gzip, gunzip } from 'zlib';
import { promisify } from 'util';

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

async function compressArchiveData(data: any) {
  const jsonString = JSON.stringify(data);
  const originalSize = Buffer.byteLength(jsonString);
  const compressed = await gzipAsync(jsonString);
  const compressedSize = compressed.length;
  const ratio = compressedSize / originalSize;
  
  return {
    compressed: compressed.toString('base64'),
    size: compressedSize,
    ratio: parseFloat(ratio.toFixed(2))
  };
}
```

### Async Export Processing

Exports are processed asynchronously using a job queue:

```typescript
// Queue export job
await queueExportJob({
  exportId,
  projectId,
  userId
});

// Worker processes export
async function processExportJob(job: ExportJob) {
  try {
    const exportPath = await generateExportPackage(job.projectId);
    await updateExportStatus(job.exportId, 'completed', exportPath);
    await sendExportReadyNotification(job.userId, job.exportId);
  } catch (error) {
    await updateExportStatus(job.exportId, 'failed', null, error.message);
    await sendExportFailedNotification(job.userId, job.exportId);
  }
}
```

### Retention Policy Execution

Retention policies are enforced via scheduled jobs:

```typescript
// Daily cron job
async function enforceRetentionPolicies() {
  const archivesForDeletion = await getArchivesForDeletion();
  
  for (const archive of archivesForDeletion) {
    if (archive.legalHold) {
      continue; // Skip archives under legal hold
    }
    
    await sendDeletionNotifications(archive.id);
    await scheduleArchiveDeletion(archive.id, GRACE_PERIOD_DAYS);
  }
}

// After grace period
async function executeScheduledDeletions() {
  const archivesToDelete = await getArchivesReadyForDeletion();
  
  for (const archive of archivesToDelete) {
    await logArchiveDeletion(archive.id);
    await deleteArchive(archive.id);
  }
}
```

### RLS Policies

Row Level Security policies for new tables:

```sql
-- Deliverables: Team members and client can view
CREATE POLICY "deliverables_team_client_select" ON public.project_deliverables
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_deliverables.project_id
    AND (
      p.client_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.bid_team_members btm
        WHERE btm.project_id = p.id
        AND btm.user_id = auth.uid()
      )
    )
  )
);

-- Deliverables: Team members can insert
CREATE POLICY "deliverables_team_insert" ON public.project_deliverables
FOR INSERT WITH CHECK (
  uploaded_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.bid_team_members btm
    WHERE btm.project_id = project_deliverables.project_id
    AND btm.user_id = auth.uid()
  )
);

-- Archives: Participants can view
CREATE POLICY "archives_participants_select" ON public.project_archives
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = project_archives.project_id
    AND (
      p.client_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.bid_team_members btm
        WHERE btm.project_id = p.id
        AND btm.user_id = auth.uid()
      )
    )
  )
);

-- Archives: System can insert (via service role)
CREATE POLICY "archives_system_insert" ON public.project_archives
FOR INSERT WITH CHECK (true);
```

### Notification Integration

Notifications use the existing notification queue system:

```typescript
async function sendCompletionNotifications(projectId: string, teamMemberIds: string[]) {
  for (const userId of teamMemberIds) {
    await createNotification(
      userId,
      'proposal_status_changed',
      'Project Completed',
      'The project has been marked as completed by the client.',
      { projectId, type: 'completion' }
    );
  }
}
```

## Deployment Considerations

### Database Migration

1. Run SQL migration to create new tables
2. Add indexes for performance
3. Enable RLS policies
4. Verify policies with test queries

### Storage Bucket Setup

1. Create `deliverables` bucket in Supabase Storage
2. Configure bucket policies for authenticated uploads
3. Set file size limits (100MB)
4. Enable automatic cleanup of orphaned files

### Background Jobs

1. Set up cron job for retention policy enforcement (daily)
2. Set up cron job for export cleanup (daily)
3. Set up worker queue for async export processing
4. Configure retry policies and error handling

### Monitoring

1. Track deliverable upload success/failure rates
2. Monitor archive creation performance
3. Track export generation times
4. Monitor storage usage growth
5. Alert on failed retention policy executions
6. Track legal hold applications

### Rollback Plan

1. Keep old project status values during transition period
2. Maintain backward compatibility for existing queries
3. Provide data migration scripts for rollback
4. Document rollback procedures for each component
