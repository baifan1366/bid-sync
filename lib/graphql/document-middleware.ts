/**
 * GraphQL Middleware for Document Permissions
 * 
 * Provides middleware functions to enforce document permissions in GraphQL resolvers.
 * Validates user authentication and document access before allowing operations.
 * 
 * Requirements: 8.4, 8.5, 8.6
 */

import { GraphQLError } from 'graphql'
import { createClient } from '@/lib/supabase/server'
import {
  getUserDocumentRole,
  hasPermission,
  type DocumentPermission,
  type DocumentRole,
} from '@/lib/document-permissions'

/**
 * GraphQL context type
 */
export interface GraphQLContext {
  userId?: string
  userRole?: string
  [key: string]: any
}

/**
 * Get authenticated user from context
 * Throws GraphQLError if not authenticated
 * 
 * @param context - GraphQL context
 * @returns User ID
 * @throws GraphQLError if not authenticated
 */
export async function requireAuth(context?: GraphQLContext): Promise<string> {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    throw new GraphQLError('Not authenticated', {
      extensions: { code: 'UNAUTHENTICATED' },
    })
  }

  return user.id
}

/**
 * Require user to have specific document permission
 * Throws GraphQLError if user doesn't have permission
 * 
 * @param documentId - Document ID
 * @param userId - User ID
 * @param permission - Required permission
 * @throws GraphQLError if user doesn't have permission
 */
export async function requireDocumentPermission(
  documentId: string,
  userId: string,
  permission: DocumentPermission
): Promise<void> {
  const role = await getUserDocumentRole(documentId, userId)

  if (!role) {
    throw new GraphQLError('Document not found or access denied', {
      extensions: { code: 'FORBIDDEN' },
    })
  }

  if (!hasPermission(role, permission)) {
    throw new GraphQLError(`Insufficient permissions: ${permission} required`, {
      extensions: { 
        code: 'FORBIDDEN',
        requiredPermission: permission,
        userRole: role,
      },
    })
  }
}

/**
 * Require user to have any of the specified document permissions
 * Throws GraphQLError if user doesn't have any permission
 * 
 * @param documentId - Document ID
 * @param userId - User ID
 * @param permissions - Required permissions (at least one)
 * @throws GraphQLError if user doesn't have any permission
 */
export async function requireAnyDocumentPermission(
  documentId: string,
  userId: string,
  permissions: DocumentPermission[]
): Promise<void> {
  const role = await getUserDocumentRole(documentId, userId)

  if (!role) {
    throw new GraphQLError('Document not found or access denied', {
      extensions: { code: 'FORBIDDEN' },
    })
  }

  const hasAnyPermission = permissions.some(p => hasPermission(role, p))

  if (!hasAnyPermission) {
    throw new GraphQLError(
      `Insufficient permissions: one of ${permissions.join(', ')} required`,
      {
        extensions: { 
          code: 'FORBIDDEN',
          requiredPermissions: permissions,
          userRole: role,
        },
      }
    )
  }
}

/**
 * Middleware wrapper for document read operations
 * Requires 'read' permission
 * 
 * @param resolver - GraphQL resolver function
 * @returns Wrapped resolver with permission check
 */
export function withDocumentRead<TArgs extends { documentId: string }>(
  resolver: (parent: any, args: TArgs, context: GraphQLContext) => Promise<any>
) {
  return async (parent: any, args: TArgs, context: GraphQLContext) => {
    const userId = await requireAuth(context)
    await requireDocumentPermission(args.documentId, userId, 'read')
    return resolver(parent, args, context)
  }
}

/**
 * Middleware wrapper for document edit operations
 * Requires 'edit' permission
 * 
 * @param resolver - GraphQL resolver function
 * @returns Wrapped resolver with permission check
 */
export function withDocumentEdit<TArgs extends { documentId: string }>(
  resolver: (parent: any, args: TArgs, context: GraphQLContext) => Promise<any>
) {
  return async (parent: any, args: TArgs, context: GraphQLContext) => {
    const userId = await requireAuth(context)
    await requireDocumentPermission(args.documentId, userId, 'edit')
    return resolver(parent, args, context)
  }
}

/**
 * Middleware wrapper for document comment operations
 * Requires 'comment' permission
 * 
 * @param resolver - GraphQL resolver function
 * @returns Wrapped resolver with permission check
 */
export function withDocumentComment<TArgs extends { documentId: string }>(
  resolver: (parent: any, args: TArgs, context: GraphQLContext) => Promise<any>
) {
  return async (parent: any, args: TArgs, context: GraphQLContext) => {
    const userId = await requireAuth(context)
    await requireDocumentPermission(args.documentId, userId, 'comment')
    return resolver(parent, args, context)
  }
}

/**
 * Middleware wrapper for team management operations
 * Requires 'manage_team' permission
 * 
 * @param resolver - GraphQL resolver function
 * @returns Wrapped resolver with permission check
 */
export function withDocumentTeamManagement<TArgs extends { documentId: string }>(
  resolver: (parent: any, args: TArgs, context: GraphQLContext) => Promise<any>
) {
  return async (parent: any, args: TArgs, context: GraphQLContext) => {
    const userId = await requireAuth(context)
    await requireDocumentPermission(args.documentId, userId, 'manage_team')
    return resolver(parent, args, context)
  }
}

/**
 * Middleware wrapper for version management operations
 * Requires 'manage_versions' permission
 * 
 * @param resolver - GraphQL resolver function
 * @returns Wrapped resolver with permission check
 */
export function withDocumentVersionManagement<TArgs extends { documentId: string }>(
  resolver: (parent: any, args: TArgs, context: GraphQLContext) => Promise<any>
) {
  return async (parent: any, args: TArgs, context: GraphQLContext) => {
    const userId = await requireAuth(context)
    await requireDocumentPermission(args.documentId, userId, 'manage_versions')
    return resolver(parent, args, context)
  }
}

/**
 * Middleware wrapper for document deletion
 * Requires 'delete' permission (owner only)
 * 
 * @param resolver - GraphQL resolver function
 * @returns Wrapped resolver with permission check
 */
export function withDocumentDelete<TArgs extends { documentId: string }>(
  resolver: (parent: any, args: TArgs, context: GraphQLContext) => Promise<any>
) {
  return async (parent: any, args: TArgs, context: GraphQLContext) => {
    const userId = await requireAuth(context)
    await requireDocumentPermission(args.documentId, userId, 'delete')
    return resolver(parent, args, context)
  }
}

/**
 * Middleware wrapper for owner-only operations
 * Requires user to be document owner
 * 
 * @param resolver - GraphQL resolver function
 * @returns Wrapped resolver with permission check
 */
export function withDocumentOwner<TArgs extends { documentId: string }>(
  resolver: (parent: any, args: TArgs, context: GraphQLContext) => Promise<any>
) {
  return async (parent: any, args: TArgs, context: GraphQLContext) => {
    const userId = await requireAuth(context)
    const role = await getUserDocumentRole(args.documentId, userId)

    if (role !== 'owner') {
      throw new GraphQLError('Only document owner can perform this operation', {
        extensions: { 
          code: 'FORBIDDEN',
          requiredRole: 'owner',
          userRole: role,
        },
      })
    }

    return resolver(parent, args, context)
  }
}

/**
 * Generic middleware wrapper with custom permission check
 * Allows specifying required permissions
 * 
 * @param permissions - Required permissions (user must have at least one)
 * @param resolver - GraphQL resolver function
 * @returns Wrapped resolver with permission check
 */
export function withDocumentPermissions<TArgs extends { documentId: string }>(
  permissions: DocumentPermission[]
) {
  return (
    resolver: (parent: any, args: TArgs, context: GraphQLContext) => Promise<any>
  ) => {
    return async (parent: any, args: TArgs, context: GraphQLContext) => {
      const userId = await requireAuth(context)
      await requireAnyDocumentPermission(args.documentId, userId, permissions)
      return resolver(parent, args, context)
    }
  }
}

/**
 * Validate document exists and user has access
 * Returns document role for further checks
 * 
 * @param documentId - Document ID
 * @param userId - User ID
 * @returns User's document role
 * @throws GraphQLError if document not found or no access
 */
export async function validateDocumentAccess(
  documentId: string,
  userId: string
): Promise<DocumentRole> {
  const role = await getUserDocumentRole(documentId, userId)

  if (!role) {
    throw new GraphQLError('Document not found or access denied', {
      extensions: { code: 'FORBIDDEN' },
    })
  }

  return role
}

/**
 * Check if operation is allowed for role
 * Helper for custom permission logic
 * 
 * @param role - User's document role
 * @param permission - Required permission
 * @throws GraphQLError if permission denied
 */
export function assertPermission(
  role: DocumentRole,
  permission: DocumentPermission
): void {
  if (!hasPermission(role, permission)) {
    throw new GraphQLError(`Insufficient permissions: ${permission} required`, {
      extensions: { 
        code: 'FORBIDDEN',
        requiredPermission: permission,
        userRole: role,
      },
    })
  }
}
