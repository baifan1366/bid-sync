/**
 * Document Permission System
 * 
 * Handles role-based permission checks for collaborative proposal documents.
 * Supports four roles: owner, editor, commenter, viewer
 * 
 * Requirements: 8.4, 8.5, 8.6
 */

import { createClient } from '@/lib/supabase/server'

/**
 * Document collaborator roles
 */
export type DocumentRole = 'owner' | 'editor' | 'commenter' | 'viewer'

/**
 * Document permissions
 */
export type DocumentPermission =
  | 'read'           // View document content
  | 'edit'           // Edit document content
  | 'comment'        // Add comments
  | 'manage_team'    // Invite/remove collaborators, change roles
  | 'manage_versions' // Create versions, rollback
  | 'delete'         // Delete document

/**
 * Permission map for each role
 * Defines what each role can do
 */
const ROLE_PERMISSIONS: Record<DocumentRole, DocumentPermission[]> = {
  owner: [
    'read',
    'edit',
    'comment',
    'manage_team',
    'manage_versions',
    'delete',
  ],
  editor: [
    'read',
    'edit',
    'comment',
    'manage_versions',
  ],
  commenter: [
    'read',
    'comment',
  ],
  viewer: [
    'read',
  ],
}

/**
 * Get all permissions for a given role
 * 
 * @param role - Document role
 * @returns Array of permissions
 */
export function getRolePermissions(role: DocumentRole): DocumentPermission[] {
  return ROLE_PERMISSIONS[role] || []
}

/**
 * Check if a role has a specific permission
 * 
 * @param role - Document role
 * @param permission - Permission to check
 * @returns True if role has permission
 */
export function hasPermission(
  role: DocumentRole,
  permission: DocumentPermission
): boolean {
  const permissions = getRolePermissions(role)
  return permissions.includes(permission)
}

/**
 * Check if a role has all of the specified permissions
 * 
 * @param role - Document role
 * @param permissions - Array of permissions to check
 * @returns True if role has all permissions
 */
export function hasAllPermissions(
  role: DocumentRole,
  permissions: DocumentPermission[]
): boolean {
  const rolePermissions = getRolePermissions(role)
  return permissions.every(p => rolePermissions.includes(p))
}

/**
 * Check if a role has any of the specified permissions
 * 
 * @param role - Document role
 * @param permissions - Array of permissions to check
 * @returns True if role has at least one permission
 */
export function hasAnyPermission(
  role: DocumentRole,
  permissions: DocumentPermission[]
): boolean {
  const rolePermissions = getRolePermissions(role)
  return permissions.some(p => rolePermissions.includes(p))
}

/**
 * Get user's role for a specific document
 * 
 * @param documentId - Document ID
 * @param userId - User ID
 * @returns User's role or null if not a collaborator
 */
export async function getUserDocumentRole(
  documentId: string,
  userId: string
): Promise<DocumentRole | null> {
  try {
    const supabase = await createClient()

    const { data: collaborator, error } = await supabase
      .from('document_collaborators')
      .select('role')
      .eq('document_id', documentId)
      .eq('user_id', userId)
      .single()

    if (error || !collaborator) {
      return null
    }

    return collaborator.role as DocumentRole
  } catch (error) {
    console.error('Error getting user document role:', error)
    return null
  }
}

/**
 * Check if user has permission for a document
 * 
 * @param documentId - Document ID
 * @param userId - User ID
 * @param permission - Permission to check
 * @returns True if user has permission
 */
export async function userHasDocumentPermission(
  documentId: string,
  userId: string,
  permission: DocumentPermission
): Promise<boolean> {
  const role = await getUserDocumentRole(documentId, userId)
  
  if (!role) {
    return false
  }

  return hasPermission(role, permission)
}

/**
 * Check if user has all specified permissions for a document
 * 
 * @param documentId - Document ID
 * @param userId - User ID
 * @param permissions - Array of permissions to check
 * @returns True if user has all permissions
 */
export async function userHasAllDocumentPermissions(
  documentId: string,
  userId: string,
  permissions: DocumentPermission[]
): Promise<boolean> {
  const role = await getUserDocumentRole(documentId, userId)
  
  if (!role) {
    return false
  }

  return hasAllPermissions(role, permissions)
}

/**
 * Check if user has any of the specified permissions for a document
 * 
 * @param documentId - Document ID
 * @param userId - User ID
 * @param permissions - Array of permissions to check
 * @returns True if user has at least one permission
 */
export async function userHasAnyDocumentPermission(
  documentId: string,
  userId: string,
  permissions: DocumentPermission[]
): Promise<boolean> {
  const role = await getUserDocumentRole(documentId, userId)
  
  if (!role) {
    return false
  }

  return hasAnyPermission(role, permissions)
}

/**
 * Require user to have specific permission for a document
 * Throws error if user doesn't have permission
 * 
 * @param documentId - Document ID
 * @param userId - User ID
 * @param permission - Required permission
 * @throws Error if user doesn't have permission
 */
export async function requireDocumentPermission(
  documentId: string,
  userId: string,
  permission: DocumentPermission
): Promise<void> {
  const hasAccess = await userHasDocumentPermission(documentId, userId, permission)
  
  if (!hasAccess) {
    throw new Error(`Insufficient permissions: ${permission} required`)
  }
}

/**
 * Require user to have all specified permissions for a document
 * Throws error if user doesn't have all permissions
 * 
 * @param documentId - Document ID
 * @param userId - User ID
 * @param permissions - Required permissions
 * @throws Error if user doesn't have all permissions
 */
export async function requireAllDocumentPermissions(
  documentId: string,
  userId: string,
  permissions: DocumentPermission[]
): Promise<void> {
  const hasAccess = await userHasAllDocumentPermissions(documentId, userId, permissions)
  
  if (!hasAccess) {
    throw new Error(`Insufficient permissions: ${permissions.join(', ')} required`)
  }
}

/**
 * Require user to have any of the specified permissions for a document
 * Throws error if user doesn't have any permission
 * 
 * @param documentId - Document ID
 * @param userId - User ID
 * @param permissions - Required permissions (at least one)
 * @throws Error if user doesn't have any permission
 */
export async function requireAnyDocumentPermission(
  documentId: string,
  userId: string,
  permissions: DocumentPermission[]
): Promise<void> {
  const hasAccess = await userHasAnyDocumentPermission(documentId, userId, permissions)
  
  if (!hasAccess) {
    throw new Error(`Insufficient permissions: one of ${permissions.join(', ')} required`)
  }
}

/**
 * Check if user is document owner
 * 
 * @param documentId - Document ID
 * @param userId - User ID
 * @returns True if user is owner
 */
export async function isDocumentOwner(
  documentId: string,
  userId: string
): Promise<boolean> {
  const role = await getUserDocumentRole(documentId, userId)
  return role === 'owner'
}

/**
 * Check if user can edit document
 * Editors and owners can edit
 * 
 * @param documentId - Document ID
 * @param userId - User ID
 * @returns True if user can edit
 */
export async function canEditDocument(
  documentId: string,
  userId: string
): Promise<boolean> {
  return await userHasDocumentPermission(documentId, userId, 'edit')
}

/**
 * Check if user can only view document
 * Viewers can only read
 * 
 * @param documentId - Document ID
 * @param userId - User ID
 * @returns True if user is viewer
 */
export async function isDocumentViewer(
  documentId: string,
  userId: string
): Promise<boolean> {
  const role = await getUserDocumentRole(documentId, userId)
  return role === 'viewer'
}

/**
 * Check if user can comment on document
 * Commenters, editors, and owners can comment
 * 
 * @param documentId - Document ID
 * @param userId - User ID
 * @returns True if user can comment
 */
export async function canCommentOnDocument(
  documentId: string,
  userId: string
): Promise<boolean> {
  return await userHasDocumentPermission(documentId, userId, 'comment')
}

/**
 * Check if user can manage team members
 * Only owners can manage team
 * 
 * @param documentId - Document ID
 * @param userId - User ID
 * @returns True if user can manage team
 */
export async function canManageDocumentTeam(
  documentId: string,
  userId: string
): Promise<boolean> {
  return await userHasDocumentPermission(documentId, userId, 'manage_team')
}

/**
 * Check if user can manage versions
 * Editors and owners can manage versions
 * 
 * @param documentId - Document ID
 * @param userId - User ID
 * @returns True if user can manage versions
 */
export async function canManageDocumentVersions(
  documentId: string,
  userId: string
): Promise<boolean> {
  return await userHasDocumentPermission(documentId, userId, 'manage_versions')
}

/**
 * Check if user can delete document
 * Only owners can delete
 * 
 * @param documentId - Document ID
 * @param userId - User ID
 * @returns True if user can delete
 */
export async function canDeleteDocument(
  documentId: string,
  userId: string
): Promise<boolean> {
  return await userHasDocumentPermission(documentId, userId, 'delete')
}
