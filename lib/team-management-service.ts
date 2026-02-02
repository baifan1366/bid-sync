/**
 * Team Management Service
 * 
 * Handles bidding team member operations including:
 * - Joining teams via validated invitations
 * - Removing team members with cascading updates
 * - Retrieving team member lists and statistics
 * - Managing team composition and roles
 * 
 * Requirements: 4.3, 5.1, 5.2, 5.3, 5.4, 5.5
 */

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { NotificationService } from '@/lib/notification-service'

/**
 * Validation Schemas
 */

const JoinTeamInputSchema = z.object({
  invitationId: z.string().uuid('Invalid invitation ID'),
  userId: z.string().uuid('Invalid user ID'),
})

const RemoveTeamMemberInputSchema = z.object({
  proposalId: z.string().uuid('Invalid proposal ID'),
  userId: z.string().uuid('Invalid user ID'),
  removedBy: z.string().uuid('Invalid remover ID'),
})

const GetTeamMembersInputSchema = z.object({
  proposalId: z.string().uuid('Invalid proposal ID'),
})

const GetTeamStatisticsInputSchema = z.object({
  proposalId: z.string().uuid('Invalid proposal ID'),
})

/**
 * Input and Output Types
 */

export interface JoinTeamInput {
  invitationId: string
  userId: string
}

export interface RemoveTeamMemberInput {
  proposalId: string
  userId: string
  removedBy: string
}

export interface GetTeamMembersInput {
  proposalId: string
}

export interface GetTeamStatisticsInput {
  proposalId: string
}

export interface TeamMember {
  id: string
  projectId: string
  userId: string
  role: 'lead' | 'member'
  joinedAt: string
  user?: {
    email: string
    name?: string
  }
  assignedSections?: AssignedSection[]
  contributionStats?: ContributionStats
}

export interface AssignedSection {
  id: string
  title: string
  status: string
  deadline?: string
}

export interface ContributionStats {
  sectionsAssigned: number
  sectionsCompleted: number
  lastActivity?: string
}

export interface TeamStatistics {
  totalMembers: number
  activeMembers: number
  leads: number
  members: number
  totalSectionsAssigned: number
  totalSectionsCompleted: number
  averageContribution: number
}

export interface TeamManagementServiceResult<T> {
  success: boolean
  data?: T
  error?: string
}

export interface Collaborator {
  id: string
  documentId: string
  userId: string
  userName: string
  email: string
  role: 'owner' | 'editor' | 'commenter' | 'viewer'
  addedBy: string
  addedAt: string
}

export interface UpdateMemberRoleInput {
  documentId: string
  userId: string
  role: 'owner' | 'editor' | 'commenter' | 'viewer'
  updatedBy: string
}

export interface RemoveMemberInput {
  documentId: string
  userId: string
  removedBy: string
}

/**
 * Team Management Service Class
 * Manages all bidding team member operations
 */
export class TeamManagementService {
  /**
   * Join a bidding team using a valid invitation
   * Validates invitation, adds user to team, and marks invitation as used
   * 
   * Requirements: 4.3
   * 
   * @param input - Join team parameters
   * @returns Created team member or error
   */
  async joinTeam(
    input: JoinTeamInput
  ): Promise<TeamManagementServiceResult<TeamMember>> {
    try {
      // Validate input
      const validated = JoinTeamInputSchema.parse(input)

      const supabase = await createClient()

      // Get invitation details
      const { data: invitation, error: invitationError } = await supabase
        .from('team_invitations')
        .select('*')
        .eq('id', validated.invitationId)
        .single()

      if (invitationError || !invitation) {
        return {
          success: false,
          error: 'Invitation not found',
        }
      }

      // Validate invitation is still valid
      const now = new Date()
      const expiresAt = new Date(invitation.expires_at)

      if (expiresAt < now) {
        return {
          success: false,
          error: 'Invitation has expired',
        }
      }

      // Check if single-use invitation has already been used
      if (!invitation.is_multi_use && invitation.used_at) {
        return {
          success: false,
          error: 'This invitation has already been used',
        }
      }

      // Ensure invitation has proposal_id (new correct approach)
      if (!invitation.proposal_id) {
        return {
          success: false,
          error: 'Invalid invitation: missing proposal information',
        }
      }

      // Check if user is already a team member of this proposal
      const { data: existingMember, error: memberCheckError } = await supabase
        .from('proposal_team_members')
        .select('id')
        .eq('proposal_id', invitation.proposal_id)
        .eq('user_id', validated.userId)
        .maybeSingle()

      if (memberCheckError) {
        console.error('Failed to check existing membership:', memberCheckError)
        return {
          success: false,
          error: `Failed to check membership: ${memberCheckError.message}`,
        }
      }

      if (existingMember) {
        return {
          success: false,
          error: 'User is already a member of this team',
        }
      }

      // Add user to proposal team with 'member' role
      // Use admin client to bypass RLS for team member insertion
      const adminClient = createAdminClient()
      const { data: teamMember, error: createError } = await adminClient
        .from('proposal_team_members')
        .insert({
          proposal_id: invitation.proposal_id,
          user_id: validated.userId,
          role: 'member',
        })
        .select()
        .single()

      if (createError || !teamMember) {
        console.error('Failed to add team member:', createError)
        return {
          success: false,
          error: `Failed to join team: ${createError?.message || 'Unknown error'}`,
        }
      }

      // Mark invitation as used (for single-use invitations)
      if (!invitation.is_multi_use) {
        await adminClient
          .from('team_invitations')
          .update({
            used_by: validated.userId,
            used_at: new Date().toISOString(),
          })
          .eq('id', validated.invitationId)
      }

      // Get proposal details to get project_id
      const { data: proposal } = await supabase
        .from('proposals')
        .select('project_id')
        .eq('id', invitation.proposal_id)
        .single()

      // Transform database response to TeamMember type
      const result: TeamMember = {
        id: teamMember.id,
        projectId: proposal?.project_id || '',
        userId: teamMember.user_id,
        role: teamMember.role as 'lead' | 'member',
        joinedAt: teamMember.joined_at,
      }

      // Get project details for notifications
      const { data: project } = await supabase
        .from('projects')
        .select('title, client_id')
        .eq('id', proposal?.project_id)
        .single()

      // Get bidding lead(s) for this proposal
      const { data: leads } = await supabase
        .from('proposal_team_members')
        .select('user_id')
        .eq('proposal_id', invitation.proposal_id)
        .eq('role', 'lead')

      // Get new member's user details
      const { data: newMemberUser } = await supabase
        .from('users')
        .select('name, email')
        .eq('id', validated.userId)
        .single()

      // Requirement 7.1: Notify bidding leader when team member joins
      if (leads && leads.length > 0) {
        for (const lead of leads) {
          NotificationService.createNotification({
            userId: lead.user_id,
            type: 'team_member_joined',
            title: 'New Team Member Joined',
            body: `${newMemberUser?.name || newMemberUser?.email || 'A new member'} has joined your team for ${project?.title || 'the project'}`,
            data: {
              projectId: proposal?.project_id,
              proposalId: invitation.proposal_id,
              teamMemberId: teamMember.id,
              newMemberUserId: validated.userId,
              newMemberName: newMemberUser?.name,
              newMemberEmail: newMemberUser?.email,
              projectTitle: project?.title,
            },
            sendEmail: true,
          }).catch(error => {
            console.error('Failed to send team member joined notification to lead:', error)
          })
        }
      }

      // Requirement 7.2: Send welcome notification to new team member
      NotificationService.createNotification({
        userId: validated.userId,
        type: 'team_member_joined',
        title: 'Welcome to the Team!',
        body: `You have successfully joined the team for ${project?.title || 'the project'}`,
        data: {
          projectId: proposal?.project_id,
          proposalId: invitation.proposal_id,
          teamMemberId: teamMember.id,
          projectTitle: project?.title,
          role: 'member',
        },
        sendEmail: true,
      }).catch(error => {
        console.error('Failed to send welcome notification to new member:', error)
      })

      return {
        success: true,
        data: result,
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          success: false,
          error: error.issues.map((e) => e.message).join(', '),
        }
      }

      console.error('Error in joinTeam:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      }
    }
  }

  /**
   * Remove a team member from a bidding team
   * Revokes access and reassigns their incomplete sections to unassigned status
   * 
   * Requirements: 5.3, 5.4
   * 
   * @param input - Remove team member parameters
   * @returns Success status or error
   */
  async removeTeamMember(
    input: RemoveTeamMemberInput
  ): Promise<TeamManagementServiceResult<void>> {
    try {
      // Validate input
      const validated = RemoveTeamMemberInputSchema.parse(input)

      const supabase = await createClient()

      // Get proposal details to get project_id
      const { data: proposal, error: proposalError } = await supabase
        .from('proposals')
        .select('project_id, lead_id')
        .eq('id', validated.proposalId)
        .single()

      if (proposalError || !proposal) {
        return {
          success: false,
          error: 'Proposal not found',
        }
      }

      // Check if remover is a bidding lead for this proposal
      const { data: removerMember, error: removerError } = await supabase
        .from('proposal_team_members')
        .select('role')
        .eq('proposal_id', validated.proposalId)
        .eq('user_id', validated.removedBy)
        .eq('role', 'lead')
        .maybeSingle()

      if (removerError || !removerMember) {
        return {
          success: false,
          error: 'Only proposal leads can remove team members',
        }
      }

      // Check if user to remove exists in the team
      const { data: memberToRemove, error: memberError } = await supabase
        .from('proposal_team_members')
        .select('id, role')
        .eq('proposal_id', validated.proposalId)
        .eq('user_id', validated.userId)
        .maybeSingle()

      if (memberError || !memberToRemove) {
        return {
          success: false,
          error: 'User is not a member of this team',
        }
      }

      // Prevent removing the last lead
      if (memberToRemove.role === 'lead') {
        const { data: leadCount, error: countError } = await supabase
          .from('proposal_team_members')
          .select('id', { count: 'exact', head: true })
          .eq('proposal_id', validated.proposalId)
          .eq('role', 'lead')

        if (countError) {
          console.error('Failed to count leads:', countError)
          return {
            success: false,
            error: 'Failed to verify team composition',
          }
        }

        if ((leadCount as any) <= 1) {
          return {
            success: false,
            error: 'Cannot remove the last lead from the team',
          }
        }
      }

      // Reassign all sections assigned to this user to unassigned status
      // Get workspace documents for this proposal
      const { data: workspaces, error: workspacesError } = await supabase
        .from('workspaces')
        .select('id')
        .eq('project_id', proposal.project_id)

      if (!workspacesError && workspaces && workspaces.length > 0) {
        const workspaceIds = workspaces.map((w) => w.id)

        // Get workspace documents
        const { data: documents, error: documentsError } = await supabase
          .from('workspace_documents')
          .select('id')
          .in('workspace_id', workspaceIds)

        if (!documentsError && documents && documents.length > 0) {
          const documentIds = documents.map((d) => d.id)

          // Update sections assigned to this user
          const { error: updateError } = await supabase
            .from('document_sections')
            .update({
              assigned_to: null,
              status: 'not_started',
            })
            .in('document_id', documentIds)
            .eq('assigned_to', validated.userId)

          if (updateError) {
            console.error('Failed to reassign sections:', updateError)
            // Continue with removal even if reassignment fails
          }
        }
      }

      // Get project details for notifications
      const { data: project } = await supabase
        .from('projects')
        .select('title')
        .eq('id', proposal.project_id)
        .single()

      // Remove the team member
      const { error: deleteError } = await supabase
        .from('proposal_team_members')
        .delete()
        .eq('id', memberToRemove.id)

      if (deleteError) {
        console.error('Failed to remove team member:', deleteError)
        return {
          success: false,
          error: `Failed to remove team member: ${deleteError.message}`,
        }
      }

      // Requirement 7.3, 7.4: Notify removed member with project title
      NotificationService.createNotification({
        userId: validated.userId,
        type: 'team_member_removed',
        title: 'Removed from Team',
        body: `You have been removed from the team for ${project?.title || 'the project'}`,
        data: {
          proposalId: validated.proposalId,
          projectId: proposal.project_id,
          projectTitle: project?.title,
          removedBy: validated.removedBy,
        },
        sendEmail: true,
      }).catch(error => {
        console.error('Failed to send team member removed notification:', error)
      })

      return {
        success: true,
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          success: false,
          error: error.issues.map((e) => e.message).join(', '),
        }
      }

      console.error('Error in removeTeamMember:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      }
    }
  }

  /**
   * Get all team members for a proposal
   * Includes user details, assigned sections, and contribution statistics
   * 
   * Requirements: 5.1, 5.2
   * 
   * @param input - Get team members parameters
   * @returns Array of team members or error
   */
  async getTeamMembers(
    input: GetTeamMembersInput
  ): Promise<TeamManagementServiceResult<TeamMember[]>> {
    try {
      // Validate input
      const validated = GetTeamMembersInputSchema.parse(input)

      const supabase = await createClient()

      // Get proposal to get project_id
      const { data: proposal, error: proposalError } = await supabase
        .from('proposals')
        .select('project_id')
        .eq('id', validated.proposalId)
        .single()

      if (proposalError || !proposal) {
        return {
          success: false,
          error: 'Proposal not found',
        }
      }

      // Get all team members with user details
      const { data: members, error: membersError } = await supabase
        .from('proposal_team_members')
        .select(`
          id,
          proposal_id,
          user_id,
          role,
          joined_at
        `)
        .eq('proposal_id', validated.proposalId)
        .order('joined_at', { ascending: true })

      if (membersError) {
        console.error('Failed to get team members:', membersError)
        return {
          success: false,
          error: `Failed to retrieve team members: ${membersError.message}`,
        }
      }

      if (!members || members.length === 0) {
        return {
          success: true,
          data: [],
        }
      }

      // Get user details for all members
      const userIds = members.map((m) => m.user_id)
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, email, name')
        .in('id', userIds)

      // Get workspaces for this project
      const { data: workspaces, error: workspacesError } = await supabase
        .from('workspaces')
        .select('id')
        .eq('project_id', proposal.project_id)

      let sectionsData: any[] = []
      if (!workspacesError && workspaces && workspaces.length > 0) {
        const workspaceIds = workspaces.map((w) => w.id)

        // Get workspace documents
        const { data: documents, error: documentsError } = await supabase
          .from('workspace_documents')
          .select('id')
          .in('workspace_id', workspaceIds)

        if (!documentsError && documents && documents.length > 0) {
          const documentIds = documents.map((d) => d.id)

          // Get sections assigned to team members
          const { data: sections, error: sectionsError } = await supabase
            .from('document_sections')
            .select('id, title, status, deadline, assigned_to, updated_at')
            .in('document_id', documentIds)
            .in('assigned_to', userIds)

          if (!sectionsError && sections) {
            sectionsData = sections
          }
        }
      }

      // Transform to TeamMember array
      const results: TeamMember[] = members.map((member) => {
        const user = users?.find((u) => u.id === member.user_id)
        const assignedSections = sectionsData
          .filter((s) => s.assigned_to === member.user_id)
          .map((s) => ({
            id: s.id,
            title: s.title,
            status: s.status,
            deadline: s.deadline,
          }))

        const sectionsCompleted = assignedSections.filter(
          (s) => s.status === 'completed'
        ).length

        const lastActivity = sectionsData
          .filter((s) => s.assigned_to === member.user_id)
          .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())[0]?.updated_at

        return {
          id: member.id,
          projectId: proposal.project_id,
          userId: member.user_id,
          role: member.role as 'lead' | 'member',
          joinedAt: member.joined_at,
          user: user
            ? {
                email: user.email,
                name: user.name,
              }
            : undefined,
          assignedSections,
          contributionStats: {
            sectionsAssigned: assignedSections.length,
            sectionsCompleted,
            lastActivity,
          },
        }
      })

      return {
        success: true,
        data: results,
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          success: false,
          error: error.issues.map((e) => e.message).join(', '),
        }
      }

      console.error('Error in getTeamMembers:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      }
    }
  }

  /**
   * Get team statistics for a proposal
   * Calculates aggregate metrics including member counts and contribution stats
   * 
   * Requirements: 5.5
   * 
   * @param input - Get team statistics parameters
   * @returns Team statistics or error
   */
  async getTeamStatistics(
    input: GetTeamStatisticsInput
  ): Promise<TeamManagementServiceResult<TeamStatistics>> {
    try {
      // Validate input
      const validated = GetTeamStatisticsInputSchema.parse(input)

      const supabase = await createClient()

      // Get proposal to get project_id
      const { data: proposal, error: proposalError } = await supabase
        .from('proposals')
        .select('project_id')
        .eq('id', validated.proposalId)
        .single()

      if (proposalError || !proposal) {
        return {
          success: false,
          error: 'Proposal not found',
        }
      }

      // Get all team members
      const { data: members, error: membersError } = await supabase
        .from('proposal_team_members')
        .select('id, user_id, role')
        .eq('proposal_id', validated.proposalId)

      if (membersError) {
        console.error('Failed to get team members:', membersError)
        return {
          success: false,
          error: `Failed to retrieve team statistics: ${membersError.message}`,
        }
      }

      if (!members || members.length === 0) {
        return {
          success: true,
          data: {
            totalMembers: 0,
            activeMembers: 0,
            leads: 0,
            members: 0,
            totalSectionsAssigned: 0,
            totalSectionsCompleted: 0,
            averageContribution: 0,
          },
        }
      }

      const totalMembers = members.length
      const leads = members.filter((m) => m.role === 'lead').length
      const regularMembers = members.filter((m) => m.role === 'member').length

      // Get workspaces for this project
      const { data: workspaces, error: workspacesError } = await supabase
        .from('workspaces')
        .select('id')
        .eq('project_id', proposal.project_id)

      let totalSectionsAssigned = 0
      let totalSectionsCompleted = 0
      let activeMembers = 0

      if (!workspacesError && workspaces && workspaces.length > 0) {
        const workspaceIds = workspaces.map((w) => w.id)

        // Get workspace documents
        const { data: documents, error: documentsError } = await supabase
          .from('workspace_documents')
          .select('id')
          .in('workspace_id', workspaceIds)

        if (!documentsError && documents && documents.length > 0) {
          const documentIds = documents.map((d) => d.id)
          const userIds = members.map((m) => m.user_id)

          // Get sections assigned to team members
          const { data: sections, error: sectionsError } = await supabase
            .from('document_sections')
            .select('id, status, assigned_to')
            .in('document_id', documentIds)
            .in('assigned_to', userIds)

          if (!sectionsError && sections) {
            totalSectionsAssigned = sections.length
            totalSectionsCompleted = sections.filter(
              (s) => s.status === 'completed'
            ).length

            // Count active members (those with at least one assigned section)
            const activeMemberIds = new Set(sections.map((s) => s.assigned_to))
            activeMembers = activeMemberIds.size
          }
        }
      }

      const averageContribution =
        totalMembers > 0 ? totalSectionsAssigned / totalMembers : 0

      const statistics: TeamStatistics = {
        totalMembers,
        activeMembers,
        leads,
        members: regularMembers,
        totalSectionsAssigned,
        totalSectionsCompleted,
        averageContribution: Math.round(averageContribution * 10) / 10,
      }

      return {
        success: true,
        data: statistics,
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          success: false,
          error: error.issues.map((e) => e.message).join(', '),
        }
      }

      console.error('Error in getTeamStatistics:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      }
    }
  }

  /**
   * Get collaborators for a document
   * Used for collaborative editing documents
   * 
   * @param documentId - Document ID
   * @param userId - User ID requesting the collaborators
   * @returns List of collaborators or error
   */
  async getCollaborators(
    documentId: string,
    userId: string
  ): Promise<TeamManagementServiceResult<Collaborator[]>> {
    try {
      const supabase = await createClient()

      // Get document collaborators
      const { data: collaborators, error } = await supabase
        .from('document_collaborators')
        .select('*')
        .eq('document_id', documentId)
        .order('added_at', { ascending: true })

      if (error) {
        console.error('Failed to get collaborators:', error)
        return {
          success: false,
          error: `Failed to retrieve collaborators: ${error.message}`,
        }
      }

      if (!collaborators || collaborators.length === 0) {
        return {
          success: true,
          data: [],
        }
      }

      // Get user details for all collaborators
      const { createAdminClient } = await import('@/lib/supabase/server')
      const adminClient = createAdminClient()

      const collaboratorsWithDetails = await Promise.all(
        collaborators.map(async (collab: any) => {
          const { data: userData } = await adminClient.auth.admin.getUserById(collab.user_id)
          
          return {
            id: collab.id,
            documentId: collab.document_id,
            userId: collab.user_id,
            userName: userData?.user?.user_metadata?.full_name || userData?.user?.email || 'Unknown',
            email: userData?.user?.email || '',
            role: collab.role as 'owner' | 'editor' | 'commenter' | 'viewer',
            addedBy: collab.added_by,
            addedAt: collab.added_at,
          }
        })
      )

      return {
        success: true,
        data: collaboratorsWithDetails,
      }
    } catch (error) {
      console.error('Error in getCollaborators:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      }
    }
  }

  /**
   * Update a member's role in a document
   * 
   * @param input - Update member role parameters
   * @returns Updated collaborator or error
   */
  async updateMemberRole(
    input: UpdateMemberRoleInput
  ): Promise<TeamManagementServiceResult<Collaborator>> {
    try {
      const supabase = await createClient()

      // Check if updater has owner permissions
      const { data: updaterCollab } = await supabase
        .from('document_collaborators')
        .select('role')
        .eq('document_id', input.documentId)
        .eq('user_id', input.updatedBy)
        .eq('role', 'owner')
        .maybeSingle()

      if (!updaterCollab) {
        return {
          success: false,
          error: 'Only document owners can update member roles',
        }
      }

      // Update the role
      const { data: updated, error } = await supabase
        .from('document_collaborators')
        .update({ role: input.role })
        .eq('document_id', input.documentId)
        .eq('user_id', input.userId)
        .select()
        .single()

      if (error || !updated) {
        console.error('Failed to update member role:', error)
        return {
          success: false,
          error: `Failed to update member role: ${error?.message || 'Unknown error'}`,
        }
      }

      // Get user details
      const { createAdminClient } = await import('@/lib/supabase/server')
      const adminClient = createAdminClient()
      const { data: userData } = await adminClient.auth.admin.getUserById(updated.user_id)

      return {
        success: true,
        data: {
          id: updated.id,
          documentId: updated.document_id,
          userId: updated.user_id,
          userName: userData?.user?.user_metadata?.full_name || userData?.user?.email || 'Unknown',
          email: userData?.user?.email || '',
          role: updated.role as 'owner' | 'editor' | 'commenter' | 'viewer',
          addedBy: updated.added_by,
          addedAt: updated.added_at,
        },
      }
    } catch (error) {
      console.error('Error in updateMemberRole:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      }
    }
  }

  /**
   * Remove a member from a document
   * 
   * @param input - Remove member parameters
   * @returns Success status or error
   */
  async removeMember(
    input: RemoveMemberInput
  ): Promise<TeamManagementServiceResult<void>> {
    try {
      const supabase = await createClient()

      // Check if remover has owner permissions
      const { data: removerCollab } = await supabase
        .from('document_collaborators')
        .select('role')
        .eq('document_id', input.documentId)
        .eq('user_id', input.removedBy)
        .eq('role', 'owner')
        .maybeSingle()

      if (!removerCollab) {
        return {
          success: false,
          error: 'Only document owners can remove members',
        }
      }

      // Check if member to remove is an owner
      const { data: memberToRemove } = await supabase
        .from('document_collaborators')
        .select('role')
        .eq('document_id', input.documentId)
        .eq('user_id', input.userId)
        .maybeSingle()

      if (!memberToRemove) {
        return {
          success: false,
          error: 'Member not found',
        }
      }

      // Prevent removing the last owner
      if (memberToRemove.role === 'owner') {
        const { data: ownerCount } = await supabase
          .from('document_collaborators')
          .select('id', { count: 'exact', head: true })
          .eq('document_id', input.documentId)
          .eq('role', 'owner')

        if ((ownerCount as any) <= 1) {
          return {
            success: false,
            error: 'Cannot remove the last owner from the document',
          }
        }
      }

      // Remove the member
      const { error } = await supabase
        .from('document_collaborators')
        .delete()
        .eq('document_id', input.documentId)
        .eq('user_id', input.userId)

      if (error) {
        console.error('Failed to remove member:', error)
        return {
          success: false,
          error: `Failed to remove member: ${error.message}`,
        }
      }

      return {
        success: true,
      }
    } catch (error) {
      console.error('Error in removeMember:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      }
    }
  }

  /**
   * Invite a member to a document
   * 
   * @param input - Invitation parameters
   * @returns Invitation details or error
   */
  async inviteMember(
    input: {
      documentId: string
      email: string
      role: 'owner' | 'editor' | 'commenter' | 'viewer'
      invitedBy: string
    }
  ): Promise<TeamManagementServiceResult<any>> {
    try {
      const supabase = await createClient()

      // Check if inviter has owner permissions
      const { data: inviterCollab } = await supabase
        .from('document_collaborators')
        .select('role')
        .eq('document_id', input.documentId)
        .eq('user_id', input.invitedBy)
        .eq('role', 'owner')
        .maybeSingle()

      if (!inviterCollab) {
        return {
          success: false,
          error: 'Only document owners can invite members',
        }
      }

      // Generate invitation token
      const crypto = await import('crypto')
      const token = crypto.randomBytes(32).toString('hex')
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 7) // 7 days expiration

      // Create invitation
      const { data: invitation, error } = await supabase
        .from('document_invitations')
        .insert({
          document_id: input.documentId,
          email: input.email,
          role: input.role,
          token,
          invited_by: input.invitedBy,
          expires_at: expiresAt.toISOString(),
        })
        .select()
        .single()

      if (error || !invitation) {
        console.error('Failed to create invitation:', error)
        return {
          success: false,
          error: `Failed to create invitation: ${error?.message || 'Unknown error'}`,
        }
      }

      return {
        success: true,
        data: {
          id: invitation.id,
          documentId: invitation.document_id,
          email: invitation.email,
          role: invitation.role,
          token: invitation.token,
          invitedBy: invitation.invited_by,
          expiresAt: invitation.expires_at,
          createdAt: invitation.created_at,
        },
      }
    } catch (error) {
      console.error('Error in inviteMember:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      }
    }
  }

  /**
   * Accept an invitation to join a document
   * 
   * @param input - Accept invitation parameters
   * @returns Collaborator details or error
   */
  async acceptInvitation(
    input: {
      invitationToken: string
      userId: string
    }
  ): Promise<TeamManagementServiceResult<Collaborator>> {
    try {
      const supabase = await createClient()

      // Get invitation
      const { data: invitation, error: inviteError } = await supabase
        .from('document_invitations')
        .select('*')
        .eq('token', input.invitationToken)
        .maybeSingle()

      if (inviteError || !invitation) {
        return {
          success: false,
          error: 'Invalid invitation token',
        }
      }

      // Check if invitation has expired
      const now = new Date()
      const expiresAt = new Date(invitation.expires_at)
      if (expiresAt < now) {
        return {
          success: false,
          error: 'Invitation has expired',
        }
      }

      // Check if already accepted
      if (invitation.accepted_at) {
        return {
          success: false,
          error: 'Invitation has already been accepted',
        }
      }

      // Check if user is already a collaborator
      const { data: existingCollab } = await supabase
        .from('document_collaborators')
        .select('id')
        .eq('document_id', invitation.document_id)
        .eq('user_id', input.userId)
        .maybeSingle()

      if (existingCollab) {
        return {
          success: false,
          error: 'User is already a collaborator on this document',
        }
      }

      // Add user as collaborator
      const { data: collaborator, error: collabError } = await supabase
        .from('document_collaborators')
        .insert({
          document_id: invitation.document_id,
          user_id: input.userId,
          role: invitation.role,
          added_by: invitation.invited_by,
        })
        .select()
        .single()

      if (collabError || !collaborator) {
        console.error('Failed to add collaborator:', collabError)
        return {
          success: false,
          error: `Failed to add collaborator: ${collabError?.message || 'Unknown error'}`,
        }
      }

      // Mark invitation as accepted
      await supabase
        .from('document_invitations')
        .update({
          accepted_at: new Date().toISOString(),
          accepted_by: input.userId,
        })
        .eq('id', invitation.id)

      // Get user details
      const { createAdminClient } = await import('@/lib/supabase/server')
      const adminClient = createAdminClient()
      const { data: userData } = await adminClient.auth.admin.getUserById(input.userId)

      return {
        success: true,
        data: {
          id: collaborator.id,
          documentId: collaborator.document_id,
          userId: collaborator.user_id,
          userName: userData?.user?.user_metadata?.full_name || userData?.user?.email || 'Unknown',
          email: userData?.user?.email || '',
          role: collaborator.role as 'owner' | 'editor' | 'commenter' | 'viewer',
          addedBy: collaborator.added_by,
          addedAt: collaborator.added_at,
        },
      }
    } catch (error) {
      console.error('Error in acceptInvitation:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      }
    }
  }
}
