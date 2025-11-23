/**
 * Document Resolver Examples
 * 
 * Examples showing how to use permission middleware and helpers
 * in GraphQL resolvers for the collaborative proposal editor.
 * 
 * These examples demonstrate the three main patterns:
 * 1. Using middleware wrappers
 * 2. Manual permission checks
 * 3. Using helper functions
 */

import { GraphQLError } from 'graphql'
import {
  requireAuth,
  withDocumentRead,
  withDocumentEdit,
  withDocumentTeamManagement,
  withDocumentVersionManagement,
  withDocumentDelete,
  withDocumentOwner,
  validateDocumentAccess,
  assertPermission,
  type GraphQLContext,
} from './document-middleware'
import {
  checkDocumentPermission,
  getUserDocumentPermissions,
  validateRoleChange,
  checkDocumentPermissionsBatch,
} from '@/lib/document-permission-helpers'
import { DocumentService } from '@/lib/document-service'
import { VersionControlService } from '@/lib/version-control-service'
import { TeamManagementService } from '@/lib/team-management-service'

/**
 * Example 1: Using middleware wrapper for read operations
 * 
 * The middleware automatically:
 * - Checks authentication
 * - Validates document access
 * - Checks 'read' permission
 */
export const getDocumentResolver = withDocumentRead(
  async (_parent: any, args: { documentId: string }, _context: GraphQLContext) => {
    const documentService = new DocumentService()
    
    // Permission already checked by middleware
    // Just fetch and return the document
    const result = await documentService.getDocument(args.documentId, _context.userId!)
    
    if (!result.success) {
      throw new GraphQLError(result.error || 'Failed to fetch document')
    }
    
    return result.data
  }
)

/**
 * Example 2: Using middleware wrapper for edit operations
 * 
 * Requires 'edit' permission (editor or owner role)
 */
export const updateDocumentResolver = withDocumentEdit(
  async (
    _parent: any,
    args: { documentId: string; content: any },
    _context: GraphQLContext
  ) => {
    const documentService = new DocumentService()
    
    // Permission already checked by middleware
    const result = await documentService.updateDocument({
      documentId: args.documentId,
      content: args.content,
      userId: _context.userId!,
    })
    
    if (!result.success) {
      throw new GraphQLError(result.error || 'Failed to update document')
    }
    
    return result.data
  }
)

/**
 * Example 3: Using middleware wrapper for team management
 * 
 * Requires 'manage_team' permission (owner only)
 */
export const inviteMemberResolver = withDocumentTeamManagement(
  async (
    _parent: any,
    args: { documentId: string; email: string; role: string },
    _context: GraphQLContext
  ) => {
    const teamService = new TeamManagementService()
    
    // Permission already checked by middleware
    const result = await teamService.inviteMember({
      documentId: args.documentId,
      email: args.email,
      role: args.role as any,
      invitedBy: _context.userId!,
    })
    
    if (!result.success) {
      throw new GraphQLError(result.error || 'Failed to invite member')
    }
    
    return result.data
  }
)

/**
 * Example 4: Using middleware wrapper for version management
 * 
 * Requires 'manage_versions' permission (editor or owner)
 */
export const rollbackVersionResolver = withDocumentVersionManagement(
  async (
    _parent: any,
    args: { documentId: string; versionId: string },
    _context: GraphQLContext
  ) => {
    const versionService = new VersionControlService()
    
    // Permission already checked by middleware
    const result = await versionService.rollbackToVersion({
      documentId: args.documentId,
      versionId: args.versionId,
      userId: _context.userId!,
    })
    
    if (!result.success) {
      throw new GraphQLError(result.error || 'Failed to rollback version')
    }
    
    return result.data
  }
)

/**
 * Example 5: Using middleware wrapper for delete operations
 * 
 * Requires 'delete' permission (owner only)
 */
export const deleteDocumentResolver = withDocumentDelete(
  async (_parent: any, args: { documentId: string }, _context: GraphQLContext) => {
    const documentService = new DocumentService()
    
    // Permission already checked by middleware
    const result = await documentService.deleteDocument(
      args.documentId,
      _context.userId!
    )
    
    if (!result.success) {
      throw new GraphQLError(result.error || 'Failed to delete document')
    }
    
    return { success: true }
  }
)

/**
 * Example 6: Manual permission check with validateDocumentAccess
 * 
 * Use when you need the role for additional logic
 */
export const getDocumentWithPermissionsResolver = async (
  _parent: any,
  args: { documentId: string },
  context: GraphQLContext
) => {
  const userId = await requireAuth(context)
  
  // Validate access and get role
  const role = await validateDocumentAccess(args.documentId, userId)
  
  // Fetch document
  const documentService = new DocumentService()
  const result = await documentService.getDocument(args.documentId, userId)
  
  if (!result.success) {
    throw new GraphQLError(result.error || 'Failed to fetch document')
  }
  
  // Get all permissions for this user
  const permissions = await getUserDocumentPermissions(args.documentId, userId)
  
  // Return document with permission metadata
  return {
    ...result.data,
    userRole: role,
    userPermissions: permissions,
  }
}

/**
 * Example 7: Manual permission check with assertPermission
 * 
 * Use when you need custom permission logic
 */
export const updateDocumentMetadataResolver = async (
  _parent: any,
  args: { documentId: string; title?: string; description?: string },
  context: GraphQLContext
) => {
  const userId = await requireAuth(context)
  
  // Get role and validate access
  const role = await validateDocumentAccess(args.documentId, userId)
  
  // Check if user can edit
  assertPermission(role, 'edit')
  
  // Perform update
  const documentService = new DocumentService()
  const result = await documentService.updateDocumentMetadata({
    documentId: args.documentId,
    title: args.title,
    description: args.description,
    userId,
  })
  
  if (!result.success) {
    throw new GraphQLError(result.error || 'Failed to update metadata')
  }
  
  return result.data
}

/**
 * Example 8: Using helper for detailed permission check
 * 
 * Returns permission check result with reason
 */
export const checkDocumentAccessResolver = async (
  _parent: any,
  args: { documentId: string; permission: string },
  context: GraphQLContext
) => {
  const userId = await requireAuth(context)
  
  // Check specific permission with detailed result
  const result = await checkDocumentPermission(
    args.documentId,
    userId,
    args.permission as any
  )
  
  return {
    allowed: result.allowed,
    role: result.role,
    reason: result.reason,
  }
}

/**
 * Example 9: Batch permission check for list operations
 * 
 * Efficiently check permissions for multiple documents
 */
export const listDocumentsWithPermissionsResolver = async (
  _parent: any,
  args: { workspaceId: string },
  context: GraphQLContext
) => {
  const userId = await requireAuth(context)
  
  // Fetch all documents in workspace
  const documentService = new DocumentService()
  const result = await documentService.listDocuments(args.workspaceId, userId)
  
  if (!result.success || !result.data) {
    throw new GraphQLError(result.error || 'Failed to list documents')
  }
  
  // Batch check edit permission for all documents
  const documentIds = result.data.map(doc => doc.id)
  const permissionResults = await checkDocumentPermissionsBatch(
    documentIds,
    userId,
    'edit'
  )
  
  // Attach permission info to each document
  return result.data.map(doc => ({
    ...doc,
    canEdit: permissionResults.get(doc.id)?.allowed || false,
    userRole: permissionResults.get(doc.id)?.role,
  }))
}

/**
 * Example 10: Role change with validation
 * 
 * Validates role change before performing operation
 */
export const changeCollaboratorRoleResolver = withDocumentOwner(
  async (
    _parent: any,
    args: { documentId: string; userId: string; newRole: string },
    context: GraphQLContext
  ) => {
    const actorUserId = context.userId!
    
    // Validate role change
    const validation = await validateRoleChange(
      args.documentId,
      actorUserId,
      args.userId,
      args.newRole as any
    )
    
    if (!validation.valid) {
      throw new GraphQLError(validation.reason || 'Invalid role change')
    }
    
    // Perform role change
    const teamService = new TeamManagementService()
    const result = await teamService.updateMemberRole({
      documentId: args.documentId,
      userId: args.userId,
      role: args.newRole as any,
      updatedBy: actorUserId,
    })
    
    if (!result.success) {
      throw new GraphQLError(result.error || 'Failed to change role')
    }
    
    return result.data
  }
)

/**
 * Example 11: Complex operation with multiple permission checks
 * 
 * Demonstrates checking different permissions for different operations
 */
export const duplicateDocumentResolver = async (
  _parent: any,
  args: { documentId: string; newTitle: string },
  context: GraphQLContext
) => {
  const userId = await requireAuth(context)
  
  // Validate access to source document
  const role = await validateDocumentAccess(args.documentId, userId)
  
  // Need read permission to duplicate
  assertPermission(role, 'read')
  
  // Fetch source document
  const documentService = new DocumentService()
  const sourceResult = await documentService.getDocument(args.documentId, userId)
  
  if (!sourceResult.success || !sourceResult.data) {
    throw new GraphQLError('Failed to fetch source document')
  }
  
  // Create new document (user becomes owner automatically)
  const createResult = await documentService.createDocument({
    workspaceId: sourceResult.data.workspaceId,
    title: args.newTitle,
    description: `Copy of ${sourceResult.data.title}`,
    createdBy: userId,
  })
  
  if (!createResult.success || !createResult.data) {
    throw new GraphQLError('Failed to create duplicate document')
  }
  
  // Copy content to new document
  const updateResult = await documentService.updateDocument({
    documentId: createResult.data.id,
    content: sourceResult.data.content,
    userId,
  })
  
  if (!updateResult.success) {
    throw new GraphQLError('Failed to copy document content')
  }
  
  return updateResult.data
}

/**
 * Example 12: Subscription with permission check
 * 
 * Validates permission before allowing subscription
 */
export const subscribeToDocumentChanges = {
  subscribe: async (
    _parent: any,
    args: { documentId: string },
    context: GraphQLContext
  ) => {
    const userId = await requireAuth(context)
    
    // Validate user has read access
    const role = await validateDocumentAccess(args.documentId, userId)
    assertPermission(role, 'read')
    
    // Return subscription (implementation depends on your pubsub setup)
    // This is just a placeholder
    return {
      // Your subscription logic here
    }
  },
}
