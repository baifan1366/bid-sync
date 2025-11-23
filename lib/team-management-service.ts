/**
 * Team Management Service
 * 
 * Handles team member invitations and role management including:
 * - Inviting members to collaborate on documents
 * - Updating member roles
 * - Removing members from documents
 * - Retrieving collaborator lists
 * - Accepting invitations
 */

import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { 
  sendDocumentInvitationEmail,
  sendRoleChangeNotificationEmail,
  sendAccessRevocationEmail,
} from '@/lib/email'
import type { DocumentCollaborator, DocumentInvitation, CollaboratorRole } from '@/types/document'

/**
 * Validation Schemas
 */

const InviteMemberInputSchema = z.object({
  documentId: z.string().uuid('Invalid document ID'),
  email: z.string().email('Invalid email address'),
  role: z.enum(['editor', 'commenter', 'viewer'], {
    message: 'Role must be editor, commenter, or viewer',
  }),
  invitedBy: z.string().uuid('Invalid user ID'),
  expirationDays: z.number().int().positive().default(7),
})

const UpdateMemberRoleInputSchema = z.object({
  documentId: z.string().uuid('Invalid document ID'),
  userId: z.string().uuid('Invalid user ID'),
  role: z.enum(['owner', 'editor', 'commenter', 'viewer'], {
    message: 'Role must be owner, editor, commenter, or viewer',
  }),
  updatedBy: z.string().uuid('Invalid user ID'),
})

const RemoveMemberInputSchema = z.object({
  documentId: z.string().uuid('Invalid document ID'),
  userId: z.string().uuid('Invalid user ID'),
  removedBy: z.string().uuid('Invalid user ID'),
})

const AcceptInvitationInputSchema = z.object({
  invitationToken: z.string().uuid('Invalid invitation token'),
  userId: z.string().uuid('Invalid user ID'),
})

/**
 * Input and Output Types
 */

export interface InviteMemberInput {
  documentId: string
  email: string
  role: 'editor' | 'commenter' | 'viewer'
  invitedBy: string
  expirationDays?: number
}

export interface UpdateMemberRoleInput {
  documentId: string
  userId: string
  role: CollaboratorRole
  updatedBy: string
}

export interface RemoveMemberInput {
  documentId: string
  userId: string
  removedBy: string
}

export interface AcceptInvitationInput {
  invitationToken: string
  userId: string
}

export interface TeamManagementServiceResult<T> {
  success: boolean
  data?: T
  error?: string
}

/**
 * Team Management Service Class
 * Manages all team collaboration operations
 */
export class TeamManagementService {
  /**
   * Invite a member to collaborate on a document
   * Generates a secure invitation token and sends an email notification
   * 
   * @param input - Invitation parameters
   * @returns Created invitation or error
   */
  async inviteMember(
    input: InviteMemberInput
  ): Promise<TeamManagementServiceResult<DocumentInvitation>> {
    try {
      // Validate input
      const validated = InviteMemberInputSchema.parse(input)

      const supabase = await createClient()

      // Check if inviter has owner permissions
      const { data: hasPermission } = await supabase
        .rpc('has_document_permission', {
          p_document_id: validated.documentId,
          p_user_id: validated.invitedBy,
          p_required_role: 'owner'
        })

      if (!hasPermission) {
        return {
          success: false,
          error: 'Only document owners can invite members',
        }
      }

      // Get document details for email
      const { data: document, error: docError } = await supabase
        .from('documents')
        .select('id, title, workspace_id')
        .eq('id', validated.documentId)
        .single()

      if (docError || !document) {
        return {
          success: false,
          error: 'Document not found',
        }
      }

      // Check if user is already a collaborator
      const { data: existingCollaborator } = await supabase
        .from('document_collaborators')
        .select('id, role')
        .eq('document_id', validated.documentId)
        .eq('user_id', validated.invitedBy)
        .maybeSingle()

      if (existingCollaborator) {
        return {
          success: false,
          error: 'User is already a collaborator on this document',
        }
      }

      // Check if there's already a pending invitation for this email
      const { data: existingInvitation } = await supabase
        .from('document_invitations')
        .select('id, token, expires_at')
        .eq('document_id', validated.documentId)
        .eq('email', validated.email)
        .is('accepted_at', null)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle()

      if (existingInvitation) {
        return {
          success: false,
          error: 'An active invitation already exists for this email',
        }
      }

      // Calculate expiration date
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + validated.expirationDays)

      // Create invitation
      const { data: invitation, error: createError } = await supabase
        .from('document_invitations')
        .insert({
          document_id: validated.documentId,
          email: validated.email,
          role: validated.role,
          invited_by: validated.invitedBy,
          expires_at: expiresAt.toISOString(),
        })
        .select()
        .single()

      if (createError || !invitation) {
        console.error('Failed to create invitation:', createError)
        return {
          success: false,
          error: `Failed to create invitation: ${createError?.message || 'Unknown error'}`,
        }
      }

      // Get inviter details for email
      const { data: { user: inviter } } = await supabase.auth.admin.getUserById(validated.invitedBy)

      const inviterName = inviter?.user_metadata?.full_name || inviter?.email || 'A team member'

      // Send invitation email using the new email template
      const invitationUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/invitations/${invitation.token}`
      
      await sendDocumentInvitationEmail({
        inviteeEmail: validated.email,
        inviterName,
        documentTitle: document.title,
        role: validated.role,
        invitationUrl,
        expiresAt: expiresAt.toISOString(),
      })

      // Transform database response to DocumentInvitation type
      const result: DocumentInvitation = {
        id: invitation.id,
        documentId: invitation.document_id,
        email: invitation.email,
        role: invitation.role as 'editor' | 'commenter' | 'viewer',
        token: invitation.token,
        invitedBy: invitation.invited_by,
        expiresAt: invitation.expires_at,
        acceptedAt: invitation.accepted_at,
        acceptedBy: invitation.accepted_by,
        createdAt: invitation.created_at,
      }

      return {
        success: true,
        data: result,
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          success: false,
          error: error.issues.map((e: z.ZodIssue) => e.message).join(', '),
        }
      }

      console.error('Error in inviteMember:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      }
    }
  }

  /**
   * Update a member's role on a document
   * Requires owner permissions
   * 
   * @param input - Role update parameters
   * @returns Updated collaborator or error
   */
  async updateMemberRole(
    input: UpdateMemberRoleInput
  ): Promise<TeamManagementServiceResult<DocumentCollaborator>> {
    try {
      // Validate input
      const validated = UpdateMemberRoleInputSchema.parse(input)

      const supabase = await createClient()

      // Check if updater has owner permissions
      const { data: hasPermission } = await supabase
        .rpc('has_document_permission', {
          p_document_id: validated.documentId,
          p_user_id: validated.updatedBy,
          p_required_role: 'owner'
        })

      if (!hasPermission) {
        return {
          success: false,
          error: 'Only document owners can update member roles',
        }
      }

      // Prevent owner from changing their own role
      if (validated.userId === validated.updatedBy && validated.role !== 'owner') {
        return {
          success: false,
          error: 'Document owners cannot change their own role',
        }
      }

      // Check if collaborator exists
      const { data: existingCollaborator, error: checkError } = await supabase
        .from('document_collaborators')
        .select('*')
        .eq('document_id', validated.documentId)
        .eq('user_id', validated.userId)
        .single()

      if (checkError || !existingCollaborator) {
        return {
          success: false,
          error: 'Collaborator not found on this document',
        }
      }

      // Update collaborator role
      const { data: collaborator, error: updateError } = await supabase
        .from('document_collaborators')
        .update({ role: validated.role })
        .eq('document_id', validated.documentId)
        .eq('user_id', validated.userId)
        .select('*')
        .single()

      if (updateError || !collaborator) {
        console.error('Failed to update member role:', updateError)
        return {
          success: false,
          error: updateError?.message || 'Failed to update member role',
        }
      }

      // Get user details
      const { data: { user } } = await supabase.auth.admin.getUserById(validated.userId)
      const userEmail = user?.email || ''
      const userName = user?.user_metadata?.full_name || userEmail

      // Broadcast role change via Realtime
      await supabase
        .channel(`document:${validated.documentId}`)
        .send({
          type: 'broadcast',
          event: 'role_changed',
          payload: {
            documentId: validated.documentId,
            userId: validated.userId,
            newRole: validated.role,
            updatedBy: validated.updatedBy,
          },
        })

      // Send email notification to the user using the new email template
      const { data: document } = await supabase
        .from('documents')
        .select('title')
        .eq('id', validated.documentId)
        .single()

      if (document && userEmail) {
        const documentUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/editor/${validated.documentId}`
        
        await sendRoleChangeNotificationEmail({
          userName,
          userEmail,
          documentTitle: document.title,
          newRole: validated.role,
          documentUrl,
        })
      }

      // Transform database response to DocumentCollaborator type
      const result: DocumentCollaborator = {
        id: collaborator.id,
        documentId: collaborator.document_id,
        userId: collaborator.user_id,
        userName,
        email: userEmail,
        role: collaborator.role as CollaboratorRole,
        addedBy: collaborator.added_by,
        addedAt: collaborator.added_at,
      }

      return {
        success: true,
        data: result,
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          success: false,
          error: error.issues.map((e: z.ZodIssue) => e.message).join(', '),
        }
      }

      console.error('Error in updateMemberRole:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      }
    }
  }

  /**
   * Remove a member from a document
   * Requires owner permissions
   * Revokes all access immediately
   * 
   * @param input - Removal parameters
   * @returns Success status or error
   */
  async removeMember(
    input: RemoveMemberInput
  ): Promise<TeamManagementServiceResult<boolean>> {
    try {
      // Validate input
      const validated = RemoveMemberInputSchema.parse(input)

      const supabase = await createClient()

      // Check if remover has owner permissions
      const { data: hasPermission } = await supabase
        .rpc('has_document_permission', {
          p_document_id: validated.documentId,
          p_user_id: validated.removedBy,
          p_required_role: 'owner'
        })

      if (!hasPermission) {
        return {
          success: false,
          error: 'Only document owners can remove members',
        }
      }

      // Prevent owner from removing themselves
      if (validated.userId === validated.removedBy) {
        return {
          success: false,
          error: 'Document owners cannot remove themselves',
        }
      }

      // Get collaborator details before removal for email notification
      const { data: collaborator } = await supabase
        .from('document_collaborators')
        .select('*')
        .eq('document_id', validated.documentId)
        .eq('user_id', validated.userId)
        .single()
      
      // Get user details
      const { data: { user } } = await supabase.auth.admin.getUserById(validated.userId)

      // Remove collaborator
      const { error: deleteError } = await supabase
        .from('document_collaborators')
        .delete()
        .eq('document_id', validated.documentId)
        .eq('user_id', validated.userId)

      if (deleteError) {
        console.error('Failed to remove member:', deleteError)
        return {
          success: false,
          error: deleteError.message || 'Failed to remove member',
        }
      }

      // Broadcast member removal via Realtime
      await supabase
        .channel(`document:${validated.documentId}`)
        .send({
          type: 'broadcast',
          event: 'member_removed',
          payload: {
            documentId: validated.documentId,
            userId: validated.userId,
            removedBy: validated.removedBy,
          },
        })

      // Send email notification to the removed user using the new email template
      if (collaborator && user) {
        const userEmail = user.email
        const userName = user.user_metadata?.full_name || userEmail || ''
        const { data: document } = await supabase
          .from('documents')
          .select('title')
          .eq('id', validated.documentId)
          .single()

        if (document && userEmail) {
          await sendAccessRevocationEmail({
            userName,
            userEmail,
            documentTitle: document.title,
          })
        }
      }

      return {
        success: true,
        data: true,
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          success: false,
          error: error.issues.map((e: z.ZodIssue) => e.message).join(', '),
        }
      }

      console.error('Error in removeMember:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      }
    }
  }

  /**
   * Get all collaborators for a document
   * Returns collaborators with their roles and details
   * 
   * @param documentId - Document ID
   * @param userId - User ID for permission check
   * @returns Array of collaborators or error
   */
  async getCollaborators(
    documentId: string,
    userId: string
  ): Promise<TeamManagementServiceResult<DocumentCollaborator[]>> {
    try {
      // Validate IDs
      z.string().uuid().parse(documentId)
      z.string().uuid().parse(userId)

      const supabase = await createClient()

      // Check if user has access to the document
      const { data: hasPermission } = await supabase
        .rpc('has_document_permission', {
          p_document_id: documentId,
          p_user_id: userId,
          p_required_role: 'viewer'
        })

      if (!hasPermission) {
        return {
          success: false,
          error: 'Insufficient permissions to view collaborators',
        }
      }

      // Get all collaborators
      const { data: collaborators, error } = await supabase
        .from('document_collaborators')
        .select('*')
        .eq('document_id', documentId)
        .order('added_at', { ascending: true })

      if (error) {
        console.error('Failed to get collaborators:', error)
        return {
          success: false,
          error: error.message || 'Failed to retrieve collaborators',
        }
      }

      // Transform database response to DocumentCollaborator array
      // Fetch user details for each collaborator
      const results: DocumentCollaborator[] = await Promise.all(
        (collaborators || []).map(async (c) => {
          const { data: { user } } = await supabase.auth.admin.getUserById(c.user_id)
          const userEmail = user?.email || ''
          const userName = user?.user_metadata?.full_name || userEmail

          return {
            id: c.id,
            documentId: c.document_id,
            userId: c.user_id,
            userName,
            email: userEmail,
            role: c.role as CollaboratorRole,
            addedBy: c.added_by,
            addedAt: c.added_at,
          }
        })
      )

      return {
        success: true,
        data: results,
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          success: false,
          error: 'Invalid document ID or user ID',
        }
      }

      console.error('Error in getCollaborators:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      }
    }
  }

  /**
   * Accept an invitation to collaborate on a document
   * Creates a collaborator entry with the assigned role
   * 
   * @param input - Acceptance parameters
   * @returns Created collaborator or error
   */
  async acceptInvitation(
    input: AcceptInvitationInput
  ): Promise<TeamManagementServiceResult<DocumentCollaborator>> {
    try {
      // Validate input
      const validated = AcceptInvitationInputSchema.parse(input)

      const supabase = await createClient()

      // Get invitation
      const { data: invitation, error: invitationError } = await supabase
        .from('document_invitations')
        .select('*')
        .eq('token', validated.invitationToken)
        .is('accepted_at', null)
        .single()

      if (invitationError || !invitation) {
        return {
          success: false,
          error: 'Invitation not found or already accepted',
        }
      }

      // Check if invitation has expired
      if (new Date(invitation.expires_at) < new Date()) {
        return {
          success: false,
          error: 'Invitation has expired',
        }
      }

      // Get user email to verify it matches invitation
      const { data: { user } } = await supabase.auth.admin.getUserById(validated.userId)

      if (!user || user.email !== invitation.email) {
        return {
          success: false,
          error: 'Invitation email does not match your account',
        }
      }

      // Check if user is already a collaborator
      const { data: existingCollaborator } = await supabase
        .from('document_collaborators')
        .select('id')
        .eq('document_id', invitation.document_id)
        .eq('user_id', validated.userId)
        .maybeSingle()

      if (existingCollaborator) {
        return {
          success: false,
          error: 'You are already a collaborator on this document',
        }
      }

      // Create collaborator
      const { data: collaborator, error: createError } = await supabase
        .from('document_collaborators')
        .insert({
          document_id: invitation.document_id,
          user_id: validated.userId,
          role: invitation.role,
          added_by: invitation.invited_by,
        })
        .select()
        .single()

      if (createError || !collaborator) {
        console.error('Failed to create collaborator:', createError)
        return {
          success: false,
          error: `Failed to accept invitation: ${createError?.message || 'Unknown error'}`,
        }
      }

      // Mark invitation as accepted
      await supabase
        .from('document_invitations')
        .update({
          accepted_at: new Date().toISOString(),
          accepted_by: validated.userId,
        })
        .eq('token', validated.invitationToken)

      const userName = user.user_metadata?.full_name || user.email || ''

      // Transform database response to DocumentCollaborator type
      const result: DocumentCollaborator = {
        id: collaborator.id,
        documentId: collaborator.document_id,
        userId: collaborator.user_id,
        userName,
        email: user.email || '',
        role: collaborator.role as CollaboratorRole,
        addedBy: collaborator.added_by,
        addedAt: collaborator.added_at,
      }

      return {
        success: true,
        data: result,
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          success: false,
          error: error.issues.map((e: z.ZodIssue) => e.message).join(', '),
        }
      }

      console.error('Error in acceptInvitation:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      }
    }
  }

}
