/**
 * Document Permission Helper Functions
 * 
 * Provides convenient helper functions for common permission patterns
 * used throughout the collaborative proposal editor.
 * 
 * Requirements: 8.4, 8.5, 8.6
 */

import { createClient } from '@/lib/supabase/server'
import {
  getUserDocumentRole,
  hasPermission,
  type DocumentRole,
  type DocumentPermission,
} from '@/lib/document-permissions'

/**
 * Permission check result
 */
export interface PermissionCheckResult {
  allowed: boolean
  role: DocumentRole | null
  reason?: string
}

/**
 * Batch permission check for multiple documents
 * Useful for listing documents with permission indicators
 * 
 * @param documentIds - Array of document IDs
 * @param userId - User ID
 * @param permission - Permission to check
 * @returns Map of document ID to permission check result
 */
export async function checkDocumentPermissionsBatch(
  documentIds: string[],
  userId: string,
  permission: DocumentPermission
): Promise<Map<string, PermissionCheckResult>> {
  const results = new Map<string, PermissionCheckResult>()

  try {
    const supabase = await createClient()

    // Fetch all collaborator records in one query
    const { data: collaborators, error } = await supabase
      .from('document_collaborators')
      .select('document_id, role')
      .in('document_id', documentIds)
      .eq('user_id', userId)

    if (error) {
      console.error('Error fetching collaborator permissions:', error)
      // Return all as not allowed
      documentIds.forEach(id => {
        results.set(id, {
          allowed: false,
          role: null,
          reason: 'Error fetching permissions',
        })
      })
      return results
    }

    // Create map of document ID to role
    const roleMap = new Map<string, DocumentRole>()
    collaborators?.forEach(collab => {
      roleMap.set(collab.document_id, collab.role as DocumentRole)
    })

    // Check permission for each document
    documentIds.forEach(documentId => {
      const role = roleMap.get(documentId)
      
      if (!role) {
        results.set(documentId, {
          allowed: false,
          role: null,
          reason: 'Not a collaborator',
        })
      } else {
        const allowed = hasPermission(role, permission)
        results.set(documentId, {
          allowed,
          role,
          reason: allowed ? undefined : `Role ${role} lacks ${permission} permission`,
        })
      }
    })

    return results
  } catch (error) {
    console.error('Error in checkDocumentPermissionsBatch:', error)
    // Return all as not allowed
    documentIds.forEach(id => {
      results.set(id, {
        allowed: false,
        role: null,
        reason: 'Unexpected error',
      })
    })
    return results
  }
}

/**
 * Get all documents where user has specific permission
 * Useful for filtering document lists
 * 
 * @param workspaceId - Workspace ID
 * @param userId - User ID
 * @param permission - Required permission
 * @returns Array of document IDs where user has permission
 */
export async function getDocumentsWithPermission(
  workspaceId: string,
  userId: string,
  permission: DocumentPermission
): Promise<string[]> {
  try {
    const supabase = await createClient()

    // Get all documents in workspace where user is a collaborator
    const { data: collaborators, error } = await supabase
      .from('document_collaborators')
      .select('document_id, role, documents!inner(workspace_id)')
      .eq('user_id', userId)
      .eq('documents.workspace_id', workspaceId)

    if (error || !collaborators) {
      console.error('Error fetching documents with permission:', error)
      return []
    }

    // Filter by permission
    const documentIds = collaborators
      .filter(collab => hasPermission(collab.role as DocumentRole, permission))
      .map(collab => collab.document_id)

    return documentIds
  } catch (error) {
    console.error('Error in getDocumentsWithPermission:', error)
    return []
  }
}

/**
 * Get user's highest permission level across all documents
 * Useful for UI customization
 * 
 * @param userId - User ID
 * @returns Highest role user has across all documents
 */
export async function getUserHighestDocumentRole(
  userId: string
): Promise<DocumentRole | null> {
  try {
    const supabase = await createClient()

    const { data: collaborators, error } = await supabase
      .from('document_collaborators')
      .select('role')
      .eq('user_id', userId)

    if (error || !collaborators || collaborators.length === 0) {
      return null
    }

    // Role hierarchy: owner > editor > commenter > viewer
    const roleHierarchy: DocumentRole[] = ['owner', 'editor', 'commenter', 'viewer']
    
    for (const role of roleHierarchy) {
      if (collaborators.some(c => c.role === role)) {
        return role
      }
    }

    return null
  } catch (error) {
    console.error('Error in getUserHighestDocumentRole:', error)
    return null
  }
}

/**
 * Check if user can perform operation on document
 * Returns detailed result with role and reason
 * 
 * @param documentId - Document ID
 * @param userId - User ID
 * @param permission - Required permission
 * @returns Permission check result
 */
export async function checkDocumentPermission(
  documentId: string,
  userId: string,
  permission: DocumentPermission
): Promise<PermissionCheckResult> {
  try {
    const role = await getUserDocumentRole(documentId, userId)

    if (!role) {
      return {
        allowed: false,
        role: null,
        reason: 'Not a collaborator on this document',
      }
    }

    const allowed = hasPermission(role, permission)

    return {
      allowed,
      role,
      reason: allowed ? undefined : `Role ${role} lacks ${permission} permission`,
    }
  } catch (error) {
    console.error('Error in checkDocumentPermission:', error)
    return {
      allowed: false,
      role: null,
      reason: 'Error checking permissions',
    }
  }
}

/**
 * Get all permissions for user on a document
 * Useful for UI to show/hide features
 * 
 * @param documentId - Document ID
 * @param userId - User ID
 * @returns Array of permissions user has
 */
export async function getUserDocumentPermissions(
  documentId: string,
  userId: string
): Promise<DocumentPermission[]> {
  try {
    const role = await getUserDocumentRole(documentId, userId)

    if (!role) {
      return []
    }

    // Get all permissions for role
    const permissions: DocumentPermission[] = []
    const allPermissions: DocumentPermission[] = [
      'read',
      'edit',
      'comment',
      'manage_team',
      'manage_versions',
      'delete',
    ]

    allPermissions.forEach(permission => {
      if (hasPermission(role, permission)) {
        permissions.push(permission)
      }
    })

    return permissions
  } catch (error) {
    console.error('Error in getUserDocumentPermissions:', error)
    return []
  }
}

/**
 * Check if user can transition from one role to another
 * Used for role change validation
 * 
 * @param currentRole - Current role of user making the change
 * @param targetRole - Role to change to
 * @returns True if transition is allowed
 */
export function canChangeRole(
  currentRole: DocumentRole,
  targetRole: DocumentRole
): boolean {
  // Only owners can change roles
  if (currentRole !== 'owner') {
    return false
  }

  // Owners can change to any role (including demoting themselves)
  return true
}

/**
 * Validate role change operation
 * Ensures role changes follow business rules
 * 
 * @param documentId - Document ID
 * @param actorUserId - User performing the change
 * @param targetUserId - User whose role is being changed
 * @param newRole - New role to assign
 * @returns Validation result
 */
export async function validateRoleChange(
  documentId: string,
  actorUserId: string,
  targetUserId: string,
  newRole: DocumentRole
): Promise<{ valid: boolean; reason?: string }> {
  try {
    // Get actor's role
    const actorRole = await getUserDocumentRole(documentId, actorUserId)

    if (!actorRole) {
      return {
        valid: false,
        reason: 'Actor is not a collaborator on this document',
      }
    }

    // Only owners can change roles
    if (actorRole !== 'owner') {
      return {
        valid: false,
        reason: 'Only document owners can change roles',
      }
    }

    // Get target user's current role
    const targetRole = await getUserDocumentRole(documentId, targetUserId)

    if (!targetRole) {
      return {
        valid: false,
        reason: 'Target user is not a collaborator on this document',
      }
    }

    // Check if there would be no owners left
    if (targetRole === 'owner' && newRole !== 'owner') {
      const supabase = await createClient()
      const { data: owners, error } = await supabase
        .from('document_collaborators')
        .select('user_id')
        .eq('document_id', documentId)
        .eq('role', 'owner')

      if (error || !owners || owners.length <= 1) {
        return {
          valid: false,
          reason: 'Cannot remove the last owner from a document',
        }
      }
    }

    return { valid: true }
  } catch (error) {
    console.error('Error in validateRoleChange:', error)
    return {
      valid: false,
      reason: 'Error validating role change',
    }
  }
}

/**
 * Get collaborators grouped by role
 * Useful for team management UI
 * 
 * @param documentId - Document ID
 * @returns Map of role to array of user IDs
 */
export async function getCollaboratorsByRole(
  documentId: string
): Promise<Map<DocumentRole, string[]>> {
  const roleMap = new Map<DocumentRole, string[]>()

  try {
    const supabase = await createClient()

    const { data: collaborators, error } = await supabase
      .from('document_collaborators')
      .select('user_id, role')
      .eq('document_id', documentId)

    if (error || !collaborators) {
      console.error('Error fetching collaborators by role:', error)
      return roleMap
    }

    // Group by role
    collaborators.forEach(collab => {
      const role = collab.role as DocumentRole
      if (!roleMap.has(role)) {
        roleMap.set(role, [])
      }
      roleMap.get(role)!.push(collab.user_id)
    })

    return roleMap
  } catch (error) {
    console.error('Error in getCollaboratorsByRole:', error)
    return roleMap
  }
}

/**
 * Check if document has at least one owner
 * Used for validation before role changes or removals
 * 
 * @param documentId - Document ID
 * @returns True if document has at least one owner
 */
export async function documentHasOwner(documentId: string): Promise<boolean> {
  try {
    const supabase = await createClient()

    const { data: owners, error } = await supabase
      .from('document_collaborators')
      .select('user_id')
      .eq('document_id', documentId)
      .eq('role', 'owner')
      .limit(1)

    if (error) {
      console.error('Error checking document owners:', error)
      return false
    }

    return owners && owners.length > 0
  } catch (error) {
    console.error('Error in documentHasOwner:', error)
    return false
  }
}
