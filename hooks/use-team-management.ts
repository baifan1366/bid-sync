/**
 * Custom hooks for team management
 * 
 * Provides hooks for managing collaborators and invitations.
 * 
 * Requirements: 2.5, 8.1
 */

'use client'

import { useCallback } from 'react'
import { useGraphQLQuery, useGraphQLMutation } from './use-graphql'
import {
  GET_DOCUMENT_COLLABORATORS,
  GET_DOCUMENT_INVITATIONS,
  GET_PENDING_INVITATIONS,
} from '@/lib/graphql/queries'
import {
  INVITE_MEMBER,
  ACCEPT_INVITATION,
  UPDATE_MEMBER_ROLE,
  REMOVE_MEMBER,
} from '@/lib/graphql/mutations'
import type {
  DocumentCollaborator,
  DocumentInvitation,
  CollaboratorRole,
  InvitationResult,
  CollaboratorResult,
  InviteMemberInput,
  UpdateMemberRoleInput,
} from '@/types/document'

// ============================================================================
// Collaborator Hooks
// ============================================================================

/**
 * Hook for fetching document collaborators
 * Requirement 2.5: Display all members with their assigned roles
 */
export function useCollaborators(
  documentId: string | null,
  options?: { enabled?: boolean }
) {
  return useGraphQLQuery<{ documentCollaborators: DocumentCollaborator[] }>(
    ['collaborators', documentId || ''],
    GET_DOCUMENT_COLLABORATORS,
    { documentId },
    {
      enabled: options?.enabled !== false && !!documentId,
      staleTime: 30000, // 30 seconds
    }
  )
}

/**
 * Hook for inviting a member
 * Requirement 8.1: Invite team members with role assignment
 */
export function useInviteMember() {
  return useGraphQLMutation<
    { inviteMember: InvitationResult },
    { input: InviteMemberInput }
  >(
    INVITE_MEMBER,
    [['collaborators'], ['invitations']] // Invalidate collaborators and invitations
  )
}

/**
 * Hook for updating a member's role
 * Requirement 8.1: Modify member roles
 */
export function useUpdateMemberRole() {
  return useGraphQLMutation<
    { updateMemberRole: CollaboratorResult },
    { input: UpdateMemberRoleInput }
  >(
    UPDATE_MEMBER_ROLE,
    [['collaborators']] // Invalidate collaborators
  )
}

/**
 * Hook for removing a member
 * Requirement 8.1: Remove team members
 */
export function useRemoveMember() {
  return useGraphQLMutation<
    { removeMember: boolean },
    { documentId: string; userId: string }
  >(
    REMOVE_MEMBER,
    [['collaborators']] // Invalidate collaborators
  )
}

// ============================================================================
// Invitation Hooks
// ============================================================================

/**
 * Hook for fetching document invitations
 */
export function useInvitations(
  documentId: string | null,
  options?: { enabled?: boolean }
) {
  return useGraphQLQuery<{ documentInvitations: DocumentInvitation[] }>(
    ['invitations', documentId || ''],
    GET_DOCUMENT_INVITATIONS,
    { documentId },
    {
      enabled: options?.enabled !== false && !!documentId,
      staleTime: 30000, // 30 seconds
    }
  )
}

/**
 * Hook for fetching pending invitations for a user
 */
export function usePendingInvitations(
  email: string | null,
  options?: { enabled?: boolean }
) {
  return useGraphQLQuery<{ pendingInvitations: DocumentInvitation[] }>(
    ['pendingInvitations', email || ''],
    GET_PENDING_INVITATIONS,
    { email },
    {
      enabled: options?.enabled !== false && !!email,
      staleTime: 30000, // 30 seconds
    }
  )
}

/**
 * Hook for accepting an invitation
 */
export function useAcceptInvitation() {
  return useGraphQLMutation<
    { acceptInvitation: CollaboratorResult },
    { token: string }
  >(
    ACCEPT_INVITATION,
    [['collaborators'], ['invitations'], ['pendingInvitations']] // Invalidate all related queries
  )
}

// ============================================================================
// Composite Hooks
// ============================================================================

/**
 * Hook for managing team members
 * Provides a complete interface for team management
 */
export function useTeamManager(documentId: string | null) {
  const {
    data: collaboratorsData,
    isLoading: isLoadingCollaborators,
    error: collaboratorsError,
    refetch: refetchCollaborators,
  } = useCollaborators(documentId)

  const {
    data: invitationsData,
    isLoading: isLoadingInvitations,
    error: invitationsError,
    refetch: refetchInvitations,
  } = useInvitations(documentId)

  const inviteMutation = useInviteMember()
  const updateRoleMutation = useUpdateMemberRole()
  const removeMutation = useRemoveMember()

  const collaborators = collaboratorsData?.documentCollaborators || []
  const invitations = invitationsData?.documentInvitations || []

  /**
   * Invite a new member
   */
  const inviteMember = useCallback(
    async (email: string, role: Exclude<CollaboratorRole, 'owner'>, invitedBy?: string) => {
      if (!documentId) {
        throw new Error('Document ID is required')
      }

      const result = await inviteMutation.mutateAsync({
        input: {
          documentId,
          email,
          role,
          invitedBy: invitedBy || '', // Will be set by server from auth context
        },
      })

      if (!result.inviteMember.success) {
        throw new Error(result.inviteMember.error || 'Failed to invite member')
      }

      return result.inviteMember.invitation
    },
    [documentId, inviteMutation]
  )

  /**
   * Update a member's role
   */
  const updateMemberRole = useCallback(
    async (userId: string, role: CollaboratorRole) => {
      if (!documentId) {
        throw new Error('Document ID is required')
      }

      const result = await updateRoleMutation.mutateAsync({
        input: {
          documentId,
          userId,
          role,
        },
      })

      if (!result.updateMemberRole.success) {
        throw new Error(
          result.updateMemberRole.error || 'Failed to update member role'
        )
      }

      return result.updateMemberRole.collaborator
    },
    [documentId, updateRoleMutation]
  )

  /**
   * Remove a member
   */
  const removeMember = useCallback(
    async (userId: string) => {
      if (!documentId) {
        throw new Error('Document ID is required')
      }

      await removeMutation.mutateAsync({
        documentId,
        userId,
      })
    },
    [documentId, removeMutation]
  )

  /**
   * Get collaborators by role
   */
  const getCollaboratorsByRole = useCallback(
    (role: CollaboratorRole) => {
      return collaborators.filter(c => c.role === role)
    },
    [collaborators]
  )

  /**
   * Get the owner
   */
  const owner = collaborators.find(c => c.role === 'owner') || null

  /**
   * Get pending invitations (not yet accepted)
   */
  const pendingInvitations = invitations.filter(i => !i.acceptedAt)

  /**
   * Get accepted invitations
   */
  const acceptedInvitations = invitations.filter(i => !!i.acceptedAt)

  /**
   * Check if a user is a collaborator
   */
  const isCollaborator = useCallback(
    (userId: string) => {
      return collaborators.some(c => c.userId === userId)
    },
    [collaborators]
  )

  /**
   * Get a collaborator's role
   */
  const getCollaboratorRole = useCallback(
    (userId: string): CollaboratorRole | null => {
      const collaborator = collaborators.find(c => c.userId === userId)
      return collaborator?.role || null
    },
    [collaborators]
  )

  return {
    // Collaborators
    collaborators,
    owner,
    isLoadingCollaborators,
    collaboratorsError,
    refetchCollaborators,

    // Invitations
    invitations,
    pendingInvitations,
    acceptedInvitations,
    isLoadingInvitations,
    invitationsError,
    refetchInvitations,

    // Operations
    inviteMember,
    updateMemberRole,
    removeMember,
    getCollaboratorsByRole,
    isCollaborator,
    getCollaboratorRole,

    // Status
    isInviting: inviteMutation.isPending,
    isUpdatingRole: updateRoleMutation.isPending,
    isRemoving: removeMutation.isPending,
  }
}

/**
 * Hook for managing user invitations
 * For users to view and accept their invitations
 */
export function useInvitationManager(userEmail: string | null) {
  const {
    data: invitationsData,
    isLoading,
    error,
    refetch,
  } = usePendingInvitations(userEmail)

  const acceptMutation = useAcceptInvitation()

  const invitations = invitationsData?.pendingInvitations || []

  /**
   * Accept an invitation
   */
  const acceptInvitation = useCallback(
    async (token: string) => {
      const result = await acceptMutation.mutateAsync({ token })

      if (!result.acceptInvitation.success) {
        throw new Error(
          result.acceptInvitation.error || 'Failed to accept invitation'
        )
      }

      return result.acceptInvitation.collaborator
    },
    [acceptMutation]
  )

  /**
   * Get invitations by document
   */
  const getInvitationsByDocument = useCallback(
    (documentId: string) => {
      return invitations.filter(i => i.documentId === documentId)
    },
    [invitations]
  )

  /**
   * Get expired invitations
   */
  const expiredInvitations = invitations.filter(i => {
    const expiresAt = new Date(i.expiresAt)
    return expiresAt < new Date()
  })

  /**
   * Get valid invitations
   */
  const validInvitations = invitations.filter(i => {
    const expiresAt = new Date(i.expiresAt)
    return expiresAt >= new Date()
  })

  return {
    // Invitations
    invitations,
    validInvitations,
    expiredInvitations,
    isLoading,
    error,
    refetch,

    // Operations
    acceptInvitation,
    getInvitationsByDocument,

    // Status
    isAccepting: acceptMutation.isPending,
  }
}

/**
 * Hook for checking permissions
 * Utility hook for checking if a user has specific permissions
 */
export function usePermissions(documentId: string | null, userId: string | null) {
  const { data } = useCollaborators(documentId)
  const collaborators = data?.documentCollaborators || []

  const collaborator = collaborators.find((c: DocumentCollaborator) => c.userId === userId)
  const role = collaborator?.role || null

  const canEdit = role === 'owner' || role === 'editor'
  const canComment = role === 'owner' || role === 'editor' || role === 'commenter'
  const canView = !!role
  const canInvite = role === 'owner' || role === 'editor'
  const canManageRoles = role === 'owner'
  const canDelete = role === 'owner'
  const canRollback = role === 'owner' || role === 'editor'

  return {
    role,
    canEdit,
    canComment,
    canView,
    canInvite,
    canManageRoles,
    canDelete,
    canRollback,
    isOwner: role === 'owner',
    isEditor: role === 'editor',
    isCommenter: role === 'commenter',
    isViewer: role === 'viewer',
  }
}
