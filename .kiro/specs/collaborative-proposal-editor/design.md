# Design Document: Collaborative Proposal Editor

## Overview

The Collaborative Proposal Editor is a real-time collaborative document editing system that enables project leads and their team members to work together on proposal documents. The system leverages Supabase Realtime for synchronization, TipTap as the rich text editor, and implements a comprehensive version control system with rollback capabilities.

The architecture follows a client-server model where:
- The client uses TipTap editor with Yjs for collaborative editing
- Supabase Realtime provides WebSocket-based synchronization
- PostgreSQL stores document content, versions, and metadata
- GraphQL API handles document management operations

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Client Layer                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   TipTap     │  │     Yjs      │  │   React UI   │      │
│  │   Editor     │◄─┤  CRDT Sync   │◄─┤  Components  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│         │                  │                  │              │
└─────────┼──────────────────┼──────────────────┼──────────────┘
          │                  │                  │
          ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────┐
│                  Supabase Realtime Layer                     │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         WebSocket Broadcast Channel                   │   │
│  │  (document_updates, presence, cursor_positions)       │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
          │                  │                  │
          ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────┐
│                    GraphQL API Layer                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Document    │  │   Version    │  │    Team      │      │
│  │  Mutations   │  │  Management  │  │  Management  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
          │                  │                  │
          ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────┐
│                   PostgreSQL Database                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Documents   │  │   Versions   │  │  Collabor-   │      │
│  │              │  │              │  │  ators       │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

### Technology Stack

- **Frontend Framework**: Next.js 16 with React 19
- **Rich Text Editor**: TipTap 3.11 with StarterKit extensions
- **Collaborative Editing**: Yjs (CRDT library) with y-websocket provider
- **Real-time Sync**: Supabase Realtime (WebSocket-based)
- **API Layer**: GraphQL with graphql-yoga
- **Database**: PostgreSQL (via Supabase)
- **State Management**: React Query (@tanstack/react-query)
- **UI Components**: Radix UI with Tailwind CSS

## Components and Interfaces

### 1. Document Management Service

**Purpose**: Handles CRUD operations for proposal documents

**Interface**:
```typescript
interface DocumentService {
  createDocument(input: CreateDocumentInput): Promise<Document>
  getDocument(documentId: string): Promise<Document>
  updateDocument(documentId: string, content: JSONContent): Promise<Document>
  deleteDocument(documentId: string): Promise<boolean>
  listDocuments(workspaceId: string): Promise<Document[]>
  searchDocuments(query: string, workspaceId: string): Promise<Document[]>
}

interface CreateDocumentInput {
  workspaceId: string
  title: string
  description?: string
  createdBy: string
}

interface Document {
  id: string
  workspaceId: string
  title: string
  description?: string
  content: JSONContent
  createdBy: string
  createdAt: string
  updatedAt: string
  lastEditedBy: string
}
```

### 2. Version Control Service

**Purpose**: Manages document versions and rollback functionality

**Interface**:
```typescript
interface VersionControlService {
  createVersion(documentId: string, content: JSONContent, userId: string): Promise<Version>
  getVersionHistory(documentId: string): Promise<Version[]>
  getVersion(versionId: string): Promise<Version>
  rollbackToVersion(documentId: string, versionId: string, userId: string): Promise<Document>
  compareVersions(versionId1: string, versionId2: string): Promise<VersionDiff>
}

interface Version {
  id: string
  documentId: string
  versionNumber: number
  content: JSONContent
  createdBy: string
  createdAt: string
  changesSummary: string
  isRollback: boolean
  rolledBackFrom?: string
}

interface VersionDiff {
  additions: number
  deletions: number
  changes: DiffChange[]
}
```

### 3. Collaboration Service

**Purpose**: Manages real-time collaboration features

**Interface**:
```typescript
interface CollaborationService {
  joinSession(documentId: string, userId: string): Promise<Session>
  leaveSession(sessionId: string): Promise<void>
  getActiveSessions(documentId: string): Promise<ActiveUser[]>
  broadcastCursorPosition(sessionId: string, position: CursorPosition): Promise<void>
  broadcastPresence(sessionId: string, presence: UserPresence): Promise<void>
}

interface Session {
  id: string
  documentId: string
  userId: string
  userName: string
  userColor: string
  joinedAt: string
}

interface ActiveUser {
  userId: string
  userName: string
  userColor: string
  cursorPosition?: CursorPosition
  lastActive: string
}

interface CursorPosition {
  from: number
  to: number
}

interface UserPresence {
  status: 'active' | 'idle' | 'away'
  lastActivity: string
}
```

### 4. Team Management Service

**Purpose**: Handles team member invitations and role management

**Interface**:
```typescript
interface TeamManagementService {
  inviteMember(documentId: string, email: string, role: CollaboratorRole): Promise<Invitation>
  updateMemberRole(documentId: string, userId: string, role: CollaboratorRole): Promise<Collaborator>
  removeMember(documentId: string, userId: string): Promise<boolean>
  getCollaborators(documentId: string): Promise<Collaborator[]>
  acceptInvitation(invitationToken: string): Promise<Collaborator>
}

interface Invitation {
  id: string
  documentId: string
  email: string
  role: CollaboratorRole
  token: string
  invitedBy: string
  expiresAt: string
  createdAt: string
}

interface Collaborator {
  id: string
  documentId: string
  userId: string
  userName: string
  email: string
  role: CollaboratorRole
  addedBy: string
  addedAt: string
}

type CollaboratorRole = 'owner' | 'editor' | 'commenter' | 'viewer'
```

### 5. Sync Service

**Purpose**: Handles offline support and conflict resolution

**Interface**:
```typescript
interface SyncService {
  cacheChanges(documentId: string, changes: YjsUpdate): Promise<void>
  syncCachedChanges(documentId: string): Promise<SyncResult>
  resolveConflict(documentId: string, localVersion: JSONContent, serverVersion: JSONContent): Promise<JSONContent>
  getConnectionStatus(): ConnectionStatus
}

interface SyncResult {
  success: boolean
  conflicts: Conflict[]
  syncedAt: string
}

interface Conflict {
  path: string
  localValue: any
  serverValue: any
  resolvedValue?: any
}

type ConnectionStatus = 'connected' | 'disconnected' | 'reconnecting' | 'syncing'
```

## Data Models

### Database Schema

```sql
-- Workspaces (proposal workspaces for leads)
CREATE TABLE workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    lead_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Documents (proposal documents within workspaces)
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    content JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by UUID NOT NULL REFERENCES auth.users(id),
    last_edited_by UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Document Versions
CREATE TABLE document_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    version_number INT NOT NULL,
    content JSONB NOT NULL,
    created_by UUID NOT NULL REFERENCES auth.users(id),
    changes_summary TEXT,
    is_rollback BOOLEAN DEFAULT false,
    rolled_back_from UUID REFERENCES document_versions(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(document_id, version_number)
);

-- Document Collaborators
CREATE TABLE document_collaborators (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('owner', 'editor', 'commenter', 'viewer')),
    added_by UUID NOT NULL REFERENCES auth.users(id),
    added_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(document_id, user_id)
);

-- Collaboration Sessions (active editing sessions)
CREATE TABLE collaboration_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    user_color TEXT NOT NULL,
    cursor_position JSONB,
    presence_status TEXT DEFAULT 'active',
    last_activity TIMESTAMPTZ DEFAULT now(),
    joined_at TIMESTAMPTZ DEFAULT now()
);

-- Document Invitations
CREATE TABLE document_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('editor', 'commenter', 'viewer')),
    token UUID DEFAULT gen_random_uuid() UNIQUE,
    invited_by UUID NOT NULL REFERENCES auth.users(id),
    expires_at TIMESTAMPTZ NOT NULL,
    accepted_at TIMESTAMPTZ,
    accepted_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_workspaces_project ON workspaces(project_id);
CREATE INDEX idx_workspaces_lead ON workspaces(lead_id);
CREATE INDEX idx_documents_workspace ON documents(workspace_id);
CREATE INDEX idx_documents_updated ON documents(updated_at DESC);
CREATE INDEX idx_document_versions_document ON document_versions(document_id, version_number DESC);
CREATE INDEX idx_document_collaborators_document ON document_collaborators(document_id);
CREATE INDEX idx_document_collaborators_user ON document_collaborators(user_id);
CREATE INDEX idx_collaboration_sessions_document ON collaboration_sessions(document_id);
CREATE INDEX idx_collaboration_sessions_active ON collaboration_sessions(document_id, last_activity DESC);
CREATE INDEX idx_document_invitations_token ON document_invitations(token);
CREATE INDEX idx_document_invitations_email ON document_invitations(email);
```

### TypeScript Type Definitions

```typescript
// Core types
export interface Workspace {
  id: string
  projectId: string
  leadId: string
  name: string
  description?: string
  createdAt: string
  updatedAt: string
}

export interface Document {
  id: string
  workspaceId: string
  title: string
  description?: string
  content: JSONContent
  createdBy: string
  lastEditedBy: string
  createdAt: string
  updatedAt: string
}

export interface DocumentVersion {
  id: string
  documentId: string
  versionNumber: number
  content: JSONContent
  createdBy: string
  changesSummary: string
  isRollback: boolean
  rolledBackFrom?: string
  createdAt: string
}

export interface DocumentCollaborator {
  id: string
  documentId: string
  userId: string
  userName: string
  email: string
  role: 'owner' | 'editor' | 'commenter' | 'viewer'
  addedBy: string
  addedAt: string
}

export interface CollaborationSession {
  id: string
  documentId: string
  userId: string
  userName: string
  userColor: string
  cursorPosition?: { from: number; to: number }
  presenceStatus: 'active' | 'idle' | 'away'
  lastActivity: string
  joinedAt: string
}

export interface DocumentInvitation {
  id: string
  documentId: string
  email: string
  role: 'editor' | 'commenter' | 'viewer'
  token: string
  invitedBy: string
  expiresAt: string
  acceptedAt?: string
  acceptedBy?: string
  createdAt: string
}

// TipTap JSONContent type (from @tiptap/core)
export interface JSONContent {
  type?: string
  attrs?: Record<string, any>
  content?: JSONContent[]
  marks?: {
    type: string
    attrs?: Record<string, any>
    [key: string]: any
  }[]
  text?: string
  [key: string]: any
}
```


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Document creation assigns creator as owner

*For any* document created by a user, that user should be assigned as the owner with the 'owner' role in the collaborators table.

**Validates: Requirements 1.3**

### Property 2: Document IDs are unique

*For any* set of created documents, all document IDs should be unique with no collisions.

**Validates: Requirements 1.4**

### Property 3: Document persistence round-trip

*For any* document content, saving the content then retrieving the document should return equivalent content.

**Validates: Requirements 1.5**

### Property 4: Invitation tokens are unique

*For any* set of document invitations, all invitation tokens should be unique.

**Validates: Requirements 2.2**

### Property 5: Invitation role assignment

*For any* invitation with an assigned role, accepting that invitation should create a collaborator with the same role.

**Validates: Requirements 2.4**

### Property 6: Collaborator list completeness

*For any* set of collaborators added to a document, retrieving the collaborator list should return all added collaborators.

**Validates: Requirements 2.5**

### Property 7: CRDT convergence

*For any* set of concurrent document edits by multiple users, all clients should converge to the same final document state.

**Validates: Requirements 3.1**

### Property 8: Non-overlapping edits preserve both changes

*For any* two edits to different sections of a document made simultaneously, the final document should contain both changes without data loss.

**Validates: Requirements 3.3**

### Property 9: Cursor position broadcast

*For any* cursor position update by a user, all other active collaborators should receive that cursor position.

**Validates: Requirements 3.4**

### Property 10: New session receives current state

*For any* document state, when a new user joins the editing session, they should receive the exact current state.

**Validates: Requirements 3.5**

### Property 11: Undo-redo round-trip

*For any* sequence of document operations, applying undo then redo should return the document to the same state.

**Validates: Requirements 4.7**

### Property 12: Version creation on save

*For any* document save operation, a new version entry should be created in the version history.

**Validates: Requirements 5.1**

### Property 13: Version metadata completeness

*For any* created version, it should contain timestamp, author information, and changes summary.

**Validates: Requirements 5.2, 5.3**

### Property 14: Version content accuracy

*For any* historical version, retrieving that version should return the exact content that was saved at that point in time.

**Validates: Requirements 5.4**

### Property 15: Version persistence

*For any* created version, it should remain accessible in the version history unless explicitly deleted by the owner.

**Validates: Requirements 5.5**

### Property 16: Rollback creates new version

*For any* historical version selected for rollback, the rollback operation should create a new version with content matching the selected version.

**Validates: Requirements 6.2**

### Property 17: Rollback preserves history

*For any* rollback operation, all previous versions should remain in the version history without deletion.

**Validates: Requirements 6.3**

### Property 18: Rollback notification broadcast

*For any* rollback operation, all active collaboration sessions should receive a notification about the restoration.

**Validates: Requirements 6.4**

### Property 19: Rollback marking

*For any* rollback operation, the newly created version should be marked with isRollback=true and reference the source version.

**Validates: Requirements 6.5**

### Property 20: Workspace document listing

*For any* workspace containing documents, retrieving the workspace view should return all documents in that workspace.

**Validates: Requirements 7.1**

### Property 21: Document metadata persistence

*For any* document created with a title and description, retrieving that document should return the same title and description.

**Validates: Requirements 7.2**

### Property 22: Document search accuracy

*For any* search query, all returned documents should match the query in either title, content, or collaborator names.

**Validates: Requirements 7.5**

### Property 23: Role change propagation

*For any* collaborator role change, all active editing sessions should reflect the new role permissions immediately.

**Validates: Requirements 8.2**

### Property 24: Member removal revokes access

*For any* collaborator removed from a document, that user should no longer appear in the collaborators list and should lose access.

**Validates: Requirements 8.3**

### Property 25: Editor role permissions

*For any* user with the 'editor' role on a document, they should be able to perform edit operations successfully.

**Validates: Requirements 8.4**

### Property 26: Viewer role restrictions

*For any* user with the 'viewer' role on a document, edit operations should be rejected.

**Validates: Requirements 8.5**

### Property 27: Commenter role restrictions

*For any* user with the 'commenter' role on a document, they should be able to add comments but edit operations should be rejected.

**Validates: Requirements 8.6**

### Property 28: Active collaborator presence

*For any* set of users with active sessions on a document, retrieving the active collaborators list should return all of them.

**Validates: Requirements 9.1**

### Property 29: Presence metadata completeness

*For any* active collaborator, their presence information should include name and assigned color.

**Validates: Requirements 9.3**

### Property 30: Unique collaborator colors

*For any* set of active collaborators on a document, each should be assigned a unique color.

**Validates: Requirements 9.5**

### Property 31: Offline changes cached

*For any* document changes made while offline, those changes should be stored in local cache.

**Validates: Requirements 10.1**

### Property 32: Cached changes sync on reconnect

*For any* cached changes from offline editing, when connection is restored, those changes should be synchronized with the server.

**Validates: Requirements 10.2**

### Property 33: Conflict resolution presents both versions

*For any* synchronization conflict, both the local version and server version should be presented to the user.

**Validates: Requirements 10.3**

### Property 34: Offline editing allowed with warning

*For any* edit attempt while offline, the edit should be allowed and a warning about synchronization should be displayed.

**Validates: Requirements 10.5**

## Error Handling

### Client-Side Error Handling

**Connection Errors**:
- Detect WebSocket disconnections immediately
- Display connection status indicator to users
- Queue operations locally when offline
- Retry connection with exponential backoff (1s, 2s, 4s, 8s, max 30s)
- Show user-friendly error messages for persistent connection failures

**Sync Errors**:
- Detect merge conflicts during synchronization
- Present conflict resolution UI with both versions
- Allow users to choose which version to keep or manually merge
- Log sync errors for debugging
- Provide "force sync" option for stuck states

**Editor Errors**:
- Catch and log TipTap editor exceptions
- Prevent editor crashes from breaking the entire UI
- Show error boundary with recovery options
- Auto-save content before crashes when possible

**Permission Errors**:
- Check permissions before allowing operations
- Show clear error messages for unauthorized actions
- Redirect to appropriate page if access is revoked
- Handle role changes gracefully during active sessions

### Server-Side Error Handling

**Database Errors**:
- Wrap all database operations in try-catch blocks
- Return structured error responses with error codes
- Log errors with context for debugging
- Implement transaction rollback for failed operations
- Use database constraints to prevent invalid data

**Validation Errors**:
- Validate all inputs before processing
- Return detailed validation error messages
- Use Zod schemas for type-safe validation
- Sanitize user inputs to prevent injection attacks

**Realtime Errors**:
- Handle Supabase Realtime connection failures
- Implement fallback polling mechanism if WebSocket fails
- Log broadcast failures for monitoring
- Retry failed broadcasts with exponential backoff

**Version Control Errors**:
- Prevent version number conflicts with database constraints
- Handle concurrent version creation gracefully
- Validate version content before saving
- Ensure rollback operations are atomic

## Testing Strategy

### Unit Testing

The system will use **Vitest** as the testing framework for unit tests. Unit tests will focus on:

**Service Layer Tests**:
- Document CRUD operations
- Version creation and retrieval
- Collaborator management
- Invitation generation and acceptance
- Permission checking logic

**Utility Function Tests**:
- Content diff calculation
- Change summary generation
- Color assignment algorithm
- Search query parsing

**Component Tests**:
- React component rendering
- User interaction handlers
- State management logic
- Error boundary behavior

**Example Unit Tests**:
```typescript
describe('DocumentService', () => {
  it('should create document with owner role', async () => {
    const doc = await documentService.createDocument({
      workspaceId: 'workspace-1',
      title: 'Test Doc',
      createdBy: 'user-1'
    })
    
    const collaborators = await teamService.getCollaborators(doc.id)
    expect(collaborators).toContainEqual(
      expect.objectContaining({
        userId: 'user-1',
        role: 'owner'
      })
    )
  })
  
  it('should reject edit for viewer role', async () => {
    await expect(
      documentService.updateDocument('doc-1', content, 'viewer-user')
    ).rejects.toThrow('Insufficient permissions')
  })
})
```

### Property-Based Testing

The system will use **fast-check** as the property-based testing library for JavaScript/TypeScript. Property-based tests will verify universal properties across many randomly generated inputs.

**Configuration**:
- Each property test should run a minimum of 100 iterations
- Use seed values for reproducible test failures
- Configure appropriate shrinking for minimal failing examples

**Property Test Coverage**:

Each correctness property from the design document will be implemented as a property-based test. Tests will be tagged with comments referencing the specific property:

```typescript
// Feature: collaborative-proposal-editor, Property 3: Document persistence round-trip
test('document content round-trip preserves data', () => {
  fc.assert(
    fc.property(
      fc.record({
        type: fc.constant('doc'),
        content: fc.array(fc.jsonValue())
      }),
      async (content) => {
        const doc = await documentService.createDocument({
          workspaceId: 'test-workspace',
          title: 'Test',
          createdBy: 'user-1'
        })
        
        await documentService.updateDocument(doc.id, content)
        const retrieved = await documentService.getDocument(doc.id)
        
        expect(retrieved.content).toEqual(content)
      }
    ),
    { numRuns: 100 }
  )
})

// Feature: collaborative-proposal-editor, Property 7: CRDT convergence
test('concurrent edits converge to same state', () => {
  fc.assert(
    fc.property(
      fc.array(fc.record({
        position: fc.nat(1000),
        text: fc.string()
      }), { minLength: 2, maxLength: 10 }),
      async (edits) => {
        const doc1 = createYDoc()
        const doc2 = createYDoc()
        
        // Apply edits in different orders
        applyEdits(doc1, edits)
        applyEdits(doc2, edits.reverse())
        
        // Sync documents
        syncDocs(doc1, doc2)
        
        // Both should converge to same state
        expect(doc1.getText()).toEqual(doc2.getText())
      }
    ),
    { numRuns: 100 }
  )
})
```

**Custom Generators**:

Create domain-specific generators for:
- Valid TipTap JSONContent structures
- Document edit operations
- User role combinations
- Cursor positions
- Version histories

**Property Test Categories**:

1. **Round-trip properties**: Serialization, persistence, undo/redo
2. **Invariant properties**: Role permissions, unique IDs, version ordering
3. **CRDT properties**: Convergence, commutativity, associativity
4. **Metamorphic properties**: Search results subset of all documents, filtered lists smaller than unfiltered

### Integration Testing

**GraphQL API Tests**:
- Test complete mutation flows
- Verify query responses match schema
- Test authentication and authorization
- Validate error responses

**Realtime Sync Tests**:
- Test WebSocket connection lifecycle
- Verify broadcast delivery to all subscribers
- Test presence tracking accuracy
- Validate cursor position synchronization

**Database Integration Tests**:
- Test RLS policies with different user roles
- Verify foreign key constraints
- Test transaction rollback scenarios
- Validate index performance

### End-to-End Testing

**User Workflow Tests**:
- Complete document creation and editing flow
- Team invitation and collaboration flow
- Version history and rollback flow
- Offline editing and sync flow

**Multi-User Scenarios**:
- Concurrent editing by multiple users
- Role changes during active sessions
- Document access revocation
- Conflict resolution

## Performance Considerations

### Client-Side Performance

**Editor Performance**:
- Use TipTap's built-in performance optimizations
- Implement virtual scrolling for large documents
- Debounce cursor position broadcasts (100ms)
- Throttle presence updates (500ms)

**Sync Performance**:
- Use Yjs binary encoding for efficient updates
- Batch multiple operations before syncing
- Implement incremental sync for large documents
- Cache document state in IndexedDB

**UI Performance**:
- Lazy load version history
- Paginate collaborator lists for large teams
- Use React.memo for expensive components
- Implement optimistic UI updates

### Server-Side Performance

**Database Performance**:
- Use indexes on frequently queried columns
- Implement connection pooling
- Use prepared statements for repeated queries
- Archive old versions to separate table

**Realtime Performance**:
- Use Supabase Realtime channels efficiently
- Limit broadcast payload sizes
- Implement rate limiting on broadcasts
- Use presence tracking built into Supabase

**API Performance**:
- Implement GraphQL query complexity limits
- Use DataLoader for batching and caching
- Add response caching for read-heavy operations
- Monitor and optimize slow queries

## Security Considerations

### Authentication & Authorization

**User Authentication**:
- Use Supabase Auth for user management
- Implement JWT token validation
- Enforce session expiration
- Support multi-factor authentication

**Document Access Control**:
- Implement RLS policies for all tables
- Verify user permissions on every operation
- Use role-based access control (RBAC)
- Audit access attempts

**Invitation Security**:
- Generate cryptographically secure tokens
- Set expiration times on invitations
- Validate invitation tokens before acceptance
- Prevent invitation reuse after acceptance

### Data Security

**Content Security**:
- Sanitize user inputs to prevent XSS
- Validate JSONContent structure
- Implement rate limiting on document operations
- Prevent injection attacks in search queries

**Realtime Security**:
- Authenticate WebSocket connections
- Validate broadcast permissions
- Encrypt sensitive data in transit
- Implement channel-level access control

**Version Control Security**:
- Prevent unauthorized version access
- Validate rollback permissions
- Audit version operations
- Protect against version history tampering

## Deployment Considerations

### Infrastructure

**Frontend Deployment**:
- Deploy Next.js app to Vercel or similar platform
- Enable edge caching for static assets
- Configure CDN for global distribution
- Set up monitoring and error tracking

**Backend Deployment**:
- Use Supabase hosted platform
- Configure database backups
- Set up monitoring and alerting
- Implement health check endpoints

### Monitoring

**Application Monitoring**:
- Track document operation latencies
- Monitor WebSocket connection health
- Alert on high error rates
- Track user engagement metrics

**Database Monitoring**:
- Monitor query performance
- Track connection pool usage
- Alert on slow queries
- Monitor storage usage

**Realtime Monitoring**:
- Track broadcast delivery rates
- Monitor channel subscription counts
- Alert on connection failures
- Track message queue sizes

### Scalability

**Horizontal Scaling**:
- Design stateless API servers
- Use Supabase's built-in scaling
- Implement caching layer (Redis)
- Use load balancing for API servers

**Database Scaling**:
- Implement read replicas for queries
- Use connection pooling
- Archive old data periodically
- Optimize indexes for growth

**Realtime Scaling**:
- Use Supabase Realtime's built-in scaling
- Implement channel sharding for large documents
- Monitor and optimize broadcast patterns
- Consider dedicated Realtime infrastructure for high load
