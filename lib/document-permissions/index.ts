/**
 * Document Permissions Module
 * 
 * Central export point for all document permission utilities.
 * 
 * This module provides:
 * - Role-based permission checks
 * - GraphQL middleware for enforcing permissions
 * - Helper functions for common permission patterns
 * 
 * Requirements: 8.4, 8.5, 8.6
 */

// Core permission functions
export {
  type DocumentRole,
  type DocumentPermission,
  getRolePermissions,
  hasPermission,
  hasAllPermissions,
  hasAnyPermission,
  getUserDocumentRole,
  userHasDocumentPermission,
  userHasAllDocumentPermissions,
  userHasAnyDocumentPermission,
  requireDocumentPermission,
  requireAllDocumentPermissions,
  requireAnyDocumentPermission,
  isDocumentOwner,
  canEditDocument,
  isDocumentViewer,
  canCommentOnDocument,
  canManageDocumentTeam,
  canManageDocumentVersions,
  canDeleteDocument,
} from '../document-permissions'

// GraphQL middleware
export {
  type GraphQLContext,
  requireAuth,
  requireDocumentPermission as requireDocumentPermissionMiddleware,
  requireAnyDocumentPermission as requireAnyDocumentPermissionMiddleware,
  withDocumentRead,
  withDocumentEdit,
  withDocumentComment,
  withDocumentTeamManagement,
  withDocumentVersionManagement,
  withDocumentDelete,
  withDocumentOwner,
  withDocumentPermissions,
  validateDocumentAccess,
  assertPermission,
} from '../graphql/document-middleware'

// Helper functions
export {
  type PermissionCheckResult,
  checkDocumentPermissionsBatch,
  getDocumentsWithPermission,
  getUserHighestDocumentRole,
  checkDocumentPermission,
  getUserDocumentPermissions,
  canChangeRole,
  validateRoleChange,
  getCollaboratorsByRole,
  documentHasOwner,
} from '../document-permission-helpers'
