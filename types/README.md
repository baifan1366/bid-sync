# Type Definitions

This directory contains all TypeScript type definitions for the BidSync application, with a focus on the collaborative proposal editor feature.

## Structure

- **`document.ts`** - Core types for collaborative document editing
- **`user.ts`** - User profile and authentication types
- **`project.ts`** - Project management types
- **`proposal.ts`** - Proposal submission types
- **`registration.ts`** - User registration and invitation types
- **`index.ts`** - Central export file for all types

## Usage

### Importing Types

You can import types from individual files:

```typescript
import type { Document, DocumentVersion } from '@/types/document'
import type { UserProfile } from '@/types/user'
```

Or from the central index file:

```typescript
import type { 
  Document, 
  DocumentVersion, 
  UserProfile 
} from '@/types'
```

## Document Types

### Core Entities

- **`Workspace`** - A proposal workspace for project leads
- **`Document`** - A proposal document within a workspace
- **`DocumentVersion`** - A historical version of a document
- **`DocumentCollaborator`** - A team member with access to a document
- **`CollaborationSession`** - An active editing session
- **`DocumentInvitation`** - An invitation to collaborate on a document

### Input Types

Input types are used for creating or updating entities:

- **`CreateDocumentInput`** - Data required to create a new document
- **`UpdateDocumentInput`** - Data for updating an existing document
- **`CreateVersionInput`** - Data for creating a version snapshot
- **`RollbackVersionInput`** - Data for rolling back to a previous version
- **`InviteMemberInput`** - Data for inviting a team member
- **`UpdateMemberRoleInput`** - Data for changing a member's role
- **`JoinSessionInput`** - Data for joining a collaboration session
- **`SearchDocumentsInput`** - Data for searching documents
- **`CreateWorkspaceInput`** - Data for creating a workspace

### Response Types

Response types wrap API responses with success/error handling:

- **`DocumentResponse`** - Single document response
- **`DocumentsResponse`** - Multiple documents response
- **`VersionResponse`** - Single version response
- **`VersionsResponse`** - Multiple versions response
- **`CollaboratorResponse`** - Single collaborator response
- **`CollaboratorsResponse`** - Multiple collaborators response
- **`InvitationResponse`** - Invitation response
- **`SessionResponse`** - Session response
- **`ActiveUsersResponse`** - Active users response
- **`WorkspaceResponse`** - Single workspace response
- **`WorkspacesResponse`** - Multiple workspaces response

### Collaboration Types

Types for real-time collaboration features:

- **`Session`** - A collaboration session
- **`ActiveUser`** - An active user in a session
- **`CursorPosition`** - Cursor position in the document
- **`UserPresence`** - User presence status (active/idle/away)

### Version Control Types

Types for version control functionality:

- **`VersionDiff`** - Differences between two versions
- **`DiffChange`** - A single change in a diff

### Sync Service Types

Types for offline support and synchronization:

- **`SyncResult`** - Result of a sync operation
- **`Conflict`** - A synchronization conflict
- **`ConnectionStatus`** - Connection status (connected/disconnected/reconnecting/syncing)
- **`YjsUpdate`** - A Yjs CRDT update

### Permission Types

Types for permission checking:

- **`PermissionCheck`** - Data for checking permissions
- **`DocumentAction`** - Actions that can be performed on a document
- **`PermissionResult`** - Result of a permission check

### Role Types

- **`CollaboratorRole`** - Role types: 'owner' | 'editor' | 'commenter' | 'viewer'

## TipTap Types

### JSONContent

The `JSONContent` interface represents the TipTap editor's document structure:

```typescript
interface JSONContent {
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

This is a recursive structure that represents the document as a tree of nodes.

## Best Practices

1. **Use `type` imports** - Always use `import type` for type-only imports to improve build performance
2. **Prefer specific imports** - Import only the types you need rather than importing everything
3. **Use discriminated unions** - When appropriate, use discriminated unions for type safety
4. **Document complex types** - Add JSDoc comments for complex or non-obvious types
5. **Keep types DRY** - Reuse types and use utility types like `Pick`, `Omit`, `Partial` when appropriate

## Examples

### Creating a Document

```typescript
import type { CreateDocumentInput, DocumentResponse } from '@/types/document'

const input: CreateDocumentInput = {
  workspaceId: 'workspace-123',
  title: 'My Proposal',
  description: 'A proposal for project X',
  createdBy: 'user-456'
}

const response: DocumentResponse = await createDocument(input)
```

### Checking Permissions

```typescript
import type { PermissionCheck, PermissionResult } from '@/types/document'

const check: PermissionCheck = {
  userId: 'user-123',
  documentId: 'doc-456',
  action: 'write'
}

const result: PermissionResult = await checkPermission(check)
if (result.allowed) {
  // User can write to the document
}
```

### Working with Collaborators

```typescript
import type { 
  InviteMemberInput, 
  DocumentCollaborator,
  CollaboratorRole 
} from '@/types/document'

const invitation: InviteMemberInput = {
  documentId: 'doc-123',
  email: 'colleague@example.com',
  role: 'editor',
  invitedBy: 'user-456'
}

const collaborator: DocumentCollaborator = await inviteMember(invitation)
```

## Type Safety

All types are designed to provide maximum type safety:

- Required fields are enforced at compile time
- Optional fields are explicitly marked with `?`
- Enums and union types prevent invalid values
- Generic response types ensure consistent error handling
- Input types validate data before it reaches the API

## Maintenance

When adding new features:

1. Add new types to the appropriate file (e.g., `document.ts` for document-related types)
2. Export the types from that file
3. Add the exports to `index.ts` for central access
4. Update this README with documentation for the new types
5. Add examples if the types are complex or non-obvious
