# Document Permission System

This module provides a comprehensive permission system for the collaborative proposal editor. It implements role-based access control (RBAC) with four roles: owner, editor, commenter, and viewer.

## Requirements

This implementation satisfies requirements:
- **8.4**: Editor role permissions - full editing capabilities
- **8.5**: Viewer role restrictions - read-only access
- **8.6**: Commenter role restrictions - can comment but not edit

## Roles and Permissions

### Role Hierarchy

1. **Owner** - Full control over document
   - Read document content
   - Edit document content
   - Add comments
   - Manage team (invite/remove members, change roles)
   - Manage versions (create versions, rollback)
   - Delete document

2. **Editor** - Can edit and manage versions
   - Read document content
   - Edit document content
   - Add comments
   - Manage versions (create versions, rollback)

3. **Commenter** - Can view and comment
   - Read document content
   - Add comments

4. **Viewer** - Read-only access
   - Read document content

## Usage

### 1. Basic Permission Checks

```typescript
import {
  getUserDocumentRole,
  hasPermission,
  canEditDocument,
  isDocumentOwner,
} from '@/lib/document-permissions'

// Get user's role
const role = await getUserDocumentRole(documentId, userId)

// Check specific permission
if (hasPermission(role, 'edit')) {
  // User can edit
}

// Use convenience functions
const canEdit = await canEditDocument(documentId, userId)
const isOwner = await isDocumentOwner(documentId, userId)
```

### 2. GraphQL Middleware

The easiest way to enforce permissions in GraphQL resolvers:

```typescript
import {
  withDocumentRead,
  withDocumentEdit,
  withDocumentTeamManagement,
  withDocumentOwner,
} from '@/lib/document-permissions'

// Wrap resolver with middleware
export const getDocument = withDocumentRead(
  async (_parent, args, context) => {
    // Permission already checked
    // Implement your logic here
  }
)

export const updateDocument = withDocumentEdit(
  async (_parent, args, context) => {
    // Only editors and owners can reach here
  }
)

export const inviteMember = withDocumentTeamManagement(
  async (_parent, args, context) => {
    // Only owners can reach here
  }
)
```

### 3. Manual Permission Checks

For more control, use manual checks:

```typescript
import {
  requireAuth,
  validateDocumentAccess,
  assertPermission,
} from '@/lib/document-permissions'

export const myResolver = async (_parent, args, context) => {
  // Check authentication
  const userId = await requireAuth(context)
  
  // Validate access and get role
  const role = await validateDocumentAccess(args.documentId, userId)
  
  // Assert specific permission
  assertPermission(role, 'edit')
  
  // Continue with your logic
}
```

### 4. Helper Functions

Use helpers for common patterns:

```typescript
import {
  checkDocumentPermission,
  getUserDocumentPermissions,
  checkDocumentPermissionsBatch,
  validateRoleChange,
} from '@/lib/document-permissions'

// Check permission with detailed result
const result = await checkDocumentPermission(documentId, userId, 'edit')
if (result.allowed) {
  // User can edit
} else {
  console.log(result.reason) // Why permission was denied
}

// Get all permissions for UI
const permissions = await getUserDocumentPermissions(documentId, userId)
// Returns: ['read', 'edit', 'comment', 'manage_versions']

// Batch check for multiple documents
const documentIds = ['doc1', 'doc2', 'doc3']
const results = await checkDocumentPermissionsBatch(documentIds, userId, 'edit')
results.forEach((result, docId) => {
  console.log(`${docId}: ${result.allowed}`)
})

// Validate role change before performing
const validation = await validateRoleChange(
  documentId,
  actorUserId,
  targetUserId,
  'editor'
)
if (!validation.valid) {
  throw new Error(validation.reason)
}
```

## Available Middleware

### Read Operations
- `withDocumentRead` - Requires 'read' permission

### Edit Operations
- `withDocumentEdit` - Requires 'edit' permission

### Comment Operations
- `withDocumentComment` - Requires 'comment' permission

### Team Management
- `withDocumentTeamManagement` - Requires 'manage_team' permission (owner only)

### Version Management
- `withDocumentVersionManagement` - Requires 'manage_versions' permission

### Delete Operations
- `withDocumentDelete` - Requires 'delete' permission (owner only)

### Owner-Only Operations
- `withDocumentOwner` - Requires 'owner' role

### Custom Permissions
- `withDocumentPermissions(['edit', 'comment'])` - Requires any of the specified permissions

## Permission Matrix

| Operation | Owner | Editor | Commenter | Viewer |
|-----------|-------|--------|-----------|--------|
| Read document | ✓ | ✓ | ✓ | ✓ |
| Edit document | ✓ | ✓ | ✗ | ✗ |
| Add comments | ✓ | ✓ | ✓ | ✗ |
| Create versions | ✓ | ✓ | ✗ | ✗ |
| Rollback versions | ✓ | ✓ | ✗ | ✗ |
| Invite members | ✓ | ✗ | ✗ | ✗ |
| Change roles | ✓ | ✗ | ✗ | ✗ |
| Remove members | ✓ | ✗ | ✗ | ✗ |
| Delete document | ✓ | ✗ | ✗ | ✗ |

## Error Handling

All permission checks throw `GraphQLError` with appropriate error codes:

- `UNAUTHENTICATED` - User is not authenticated
- `FORBIDDEN` - User lacks required permission

Example error:
```typescript
{
  message: "Insufficient permissions: edit required",
  extensions: {
    code: "FORBIDDEN",
    requiredPermission: "edit",
    userRole: "viewer"
  }
}
```

## Best Practices

1. **Use middleware when possible** - It's cleaner and more maintainable
2. **Check permissions early** - Fail fast if user lacks permission
3. **Use batch checks for lists** - More efficient than individual checks
4. **Validate role changes** - Use `validateRoleChange` before changing roles
5. **Handle errors gracefully** - Provide clear error messages to users

## Examples

See `lib/graphql/document-resolver-examples.ts` for comprehensive examples of all patterns.

## Testing

When testing resolvers with permission checks:

```typescript
import { getUserDocumentRole } from '@/lib/document-permissions'

// Mock the permission check
jest.mock('@/lib/document-permissions', () => ({
  getUserDocumentRole: jest.fn(),
}))

test('allows editor to update document', async () => {
  // Mock user as editor
  (getUserDocumentRole as jest.Mock).mockResolvedValue('editor')
  
  // Test your resolver
  const result = await updateDocumentResolver(null, args, context)
  expect(result).toBeDefined()
})

test('denies viewer from updating document', async () => {
  // Mock user as viewer
  (getUserDocumentRole as jest.Mock).mockResolvedValue('viewer')
  
  // Should throw error
  await expect(
    updateDocumentResolver(null, args, context)
  ).rejects.toThrow('Insufficient permissions')
})
```
