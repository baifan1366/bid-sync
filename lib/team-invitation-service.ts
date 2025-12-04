/**
 * Team Invitation Service
 * 
 * Handles bidding team invitation generation and validation including:
 * - Generating invitation links and 8-digit codes
 * - Validating invitations (expiration, usage tracking)
 * - Supporting single-use and multi-use invitations
 * - Managing team member joining via invitations
 * 
 * Requirements: 3.2, 3.3, 3.4, 4.1, 4.2
 */

import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { NotificationService } from '@/lib/notification-service'

/**
 * Validation Schemas
 */

const GenerateInvitationInputSchema = z.object({
  proposalId: z.string().uuid('Invalid proposal ID'),
  projectId: z.string().uuid('Invalid project ID').optional(), // Legacy support
  createdBy: z.string().uuid('Invalid user ID'),
  expirationDays: z.number().int().positive().default(7),
  isMultiUse: z.boolean().default(false),
})

const ValidateInvitationInputSchema = z.object({
  codeOrToken: z.string().min(1, 'Code or token is required'),
})

const JoinTeamInputSchema = z.object({
  invitationId: z.string().uuid('Invalid invitation ID'),
  userId: z.string().uuid('Invalid user ID'),
})

/**
 * Input and Output Types
 */

export interface GenerateInvitationInput {
  proposalId: string
  projectId?: string // Legacy support
  createdBy: string
  expirationDays?: number
  isMultiUse?: boolean
}

export interface ValidateInvitationInput {
  codeOrToken: string
}

export interface JoinTeamInput {
  invitationId: string
  userId: string
}

export interface TeamInvitation {
  id: string
  proposalId: string
  projectId?: string // Legacy support
  createdBy: string
  code: string
  token: string
  expiresAt: string
  usedBy?: string
  usedAt?: string
  isMultiUse: boolean
  createdAt: string
}

export interface ValidationResult {
  valid: boolean
  invitation?: TeamInvitation
  error?: string
}

export interface TeamMember {
  id: string
  projectId: string
  userId: string
  role: 'lead' | 'member'
  joinedAt: string
}

export interface TeamInvitationServiceResult<T> {
  success: boolean
  data?: T
  error?: string
}

/**
 * Generate a unique 8-digit invitation code
 * Ensures uniqueness by checking against existing codes
 */
async function generateUniqueCode(): Promise<string> {
  const supabase = await createClient()
  let code: string
  let isUnique = false
  let attempts = 0
  const maxAttempts = 10

  while (!isUnique && attempts < maxAttempts) {
    // Generate 8-digit code (10000000 to 99999999)
    code = Math.floor(10000000 + Math.random() * 90000000).toString()

    // Check if code already exists
    const { data, error } = await supabase
      .from('team_invitations')
      .select('id')
      .eq('code', code)
      .maybeSingle()

    if (error) {
      throw new Error(`Failed to check code uniqueness: ${error.message}`)
    }

    if (!data) {
      isUnique = true
      return code
    }

    attempts++
  }

  throw new Error('Failed to generate unique invitation code after maximum attempts')
}

/**
 * Team Invitation Service Class
 * Manages all bidding team invitation operations
 */
export class TeamInvitationService {
  /**
   * Generate a team invitation with both link and code
   * Creates a shareable link (UUID token) and an 8-digit code
   * 
   * Requirements: 3.2, 3.3, 3.4
   * 
   * @param input - Invitation generation parameters
   * @returns Created invitation or error
   */
  async generateInvitation(
    input: GenerateInvitationInput
  ): Promise<TeamInvitationServiceResult<TeamInvitation>> {
    try {
      // Validate input
      const validated = GenerateInvitationInputSchema.parse(input)

      const supabase = await createClient()

      // Check if creator is a bidding lead for this proposal
      const { data: teamMember, error: memberError } = await supabase
        .from('proposal_team_members')
        .select('role')
        .eq('proposal_id', validated.proposalId)
        .eq('user_id', validated.createdBy)
        .eq('role', 'lead')
        .maybeSingle()

      if (memberError || !teamMember) {
        return {
          success: false,
          error: 'Only proposal leads can generate team invitations',
        }
      }

      // Generate unique 8-digit code
      const code = await generateUniqueCode()

      // Calculate expiration date (default 7 days)
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + validated.expirationDays)

      // Create invitation with auto-generated UUID token
      const { data: invitation, error: createError } = await supabase
        .from('team_invitations')
        .insert({
          proposal_id: validated.proposalId,
          project_id: validated.projectId, // Legacy support
          created_by: validated.createdBy,
          code: code,
          expires_at: expiresAt.toISOString(),
          is_multi_use: validated.isMultiUse,
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

      // Transform database response to TeamInvitation type
      const result: TeamInvitation = {
        id: invitation.id,
        proposalId: invitation.proposal_id,
        projectId: invitation.project_id,
        createdBy: invitation.created_by,
        code: invitation.code,
        token: invitation.token,
        expiresAt: invitation.expires_at,
        usedBy: invitation.used_by,
        usedAt: invitation.used_at,
        isMultiUse: invitation.is_multi_use,
        createdAt: invitation.created_at,
      }

      // Get proposal and project details for notification
      const { data: proposal } = await supabase
        .from('proposals')
        .select('project_id, projects(title)')
        .eq('id', validated.proposalId)
        .single()

      // Requirement 7.5: Notify creator that invitation was created
      NotificationService.createNotification({
        userId: validated.createdBy,
        type: 'team_invitation_created',
        title: 'Team Invitation Created',
        body: `Team invitation created for ${proposal?.projects?.title || 'the project'}. Code: ${code}`,
        data: {
          invitationId: invitation.id,
          proposalId: validated.proposalId,
          projectId: proposal?.project_id,
          projectTitle: proposal?.projects?.title,
          code: code,
          token: invitation.token,
          expiresAt: invitation.expires_at,
          isMultiUse: validated.isMultiUse,
        },
        sendEmail: true,
      }).catch(error => {
        console.error('Failed to send invitation created notification:', error)
      })

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

      console.error('Error in generateInvitation:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      }
    }
  }

  /**
   * Validate an invitation by code or token
   * Checks expiration and usage status
   * 
   * Requirements: 4.1, 4.2
   * 
   * @param input - Code or token to validate
   * @returns Validation result with invitation details or error
   */
  async validateInvitation(
    input: ValidateInvitationInput
  ): Promise<TeamInvitationServiceResult<ValidationResult>> {
    try {
      // Validate input
      const validated = ValidateInvitationInputSchema.parse(input)

      const supabase = await createClient()

      // Determine if input is a code (8 digits) or token (UUID)
      const isCode = /^\d{8}$/.test(validated.codeOrToken)
      const isToken = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        validated.codeOrToken
      )

      if (!isCode && !isToken) {
        return {
          success: true,
          data: {
            valid: false,
            error: 'Invalid invitation format. Must be an 8-digit code or valid token.',
          },
        }
      }

      // Query invitation by code or token
      let query = supabase.from('team_invitations').select('*')

      if (isCode) {
        query = query.eq('code', validated.codeOrToken)
      } else {
        query = query.eq('token', validated.codeOrToken)
      }

      const { data: invitation, error: queryError } = await query.maybeSingle()

      if (queryError) {
        console.error('Failed to query invitation:', queryError)
        return {
          success: false,
          error: `Failed to validate invitation: ${queryError.message}`,
        }
      }

      if (!invitation) {
        return {
          success: true,
          data: {
            valid: false,
            error: 'Invitation not found',
          },
        }
      }

      // Check if invitation has expired
      const now = new Date()
      const expiresAt = new Date(invitation.expires_at)

      if (expiresAt < now) {
        return {
          success: true,
          data: {
            valid: false,
            error: 'Invitation has expired',
          },
        }
      }

      // Check if single-use invitation has already been used
      if (!invitation.is_multi_use && invitation.used_at) {
        return {
          success: true,
          data: {
            valid: false,
            error: 'This invitation has already been used',
          },
        }
      }

      // Transform database response to TeamInvitation type
      const result: TeamInvitation = {
        id: invitation.id,
        proposalId: invitation.proposal_id,
        projectId: invitation.project_id,
        createdBy: invitation.created_by,
        code: invitation.code,
        token: invitation.token,
        expiresAt: invitation.expires_at,
        usedBy: invitation.used_by,
        usedAt: invitation.used_at,
        isMultiUse: invitation.is_multi_use,
        createdAt: invitation.created_at,
      }

      return {
        success: true,
        data: {
          valid: true,
          invitation: result,
        },
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          success: false,
          error: error.issues.map((e: z.ZodIssue) => e.message).join(', '),
        }
      }

      console.error('Error in validateInvitation:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      }
    }
  }

  /**
   * Join a bidding team using a valid invitation
   * Adds user to team and marks invitation as used (for single-use)
   * 
   * Requirements: 4.3
   * 
   * @param input - Join team parameters
   * @returns Created team member or error
   */
  async joinTeam(
    input: JoinTeamInput
  ): Promise<TeamInvitationServiceResult<TeamMember>> {
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

      // Check if user is already a team member
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

      // Add user to team with 'member' role
      const { data: teamMember, error: createError } = await supabase
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
        await supabase
          .from('team_invitations')
          .update({
            used_by: validated.userId,
            used_at: new Date().toISOString(),
          })
          .eq('id', validated.invitationId)
      }

      // Transform database response to TeamMember type
      const result: TeamMember = {
        id: teamMember.id,
        projectId: invitation.project_id || '', // Legacy support
        userId: teamMember.user_id,
        role: teamMember.role as 'lead' | 'member',
        joinedAt: teamMember.joined_at || teamMember.created_at,
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

      console.error('Error in joinTeam:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      }
    }
  }

  /**
   * Get all active invitations for a proposal
   * Returns invitations that haven't expired
   * 
   * @param proposalId - Proposal ID
   * @param userId - User ID for permission check (must be lead)
   * @returns Array of active invitations or error
   */
  async getActiveInvitations(
    proposalId: string,
    userId: string
  ): Promise<TeamInvitationServiceResult<TeamInvitation[]>> {
    try {
      // Validate IDs
      z.string().uuid().parse(proposalId)
      z.string().uuid().parse(userId)

      const supabase = await createClient()

      // Check if user is a proposal lead
      const { data: teamMember, error: memberError } = await supabase
        .from('proposal_team_members')
        .select('role')
        .eq('proposal_id', proposalId)
        .eq('user_id', userId)
        .eq('role', 'lead')
        .maybeSingle()

      if (memberError || !teamMember) {
        return {
          success: false,
          error: 'Only proposal leads can view team invitations',
        }
      }

      // Get all active invitations (not expired)
      const { data: invitations, error } = await supabase
        .from('team_invitations')
        .select('*')
        .eq('proposal_id', proposalId)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Failed to get invitations:', error)
        return {
          success: false,
          error: error.message || 'Failed to retrieve invitations',
        }
      }

      // Transform database response to TeamInvitation array
      const results: TeamInvitation[] = (invitations || []).map((inv) => ({
        id: inv.id,
        proposalId: inv.proposal_id,
        projectId: inv.project_id,
        createdBy: inv.created_by,
        code: inv.code,
        token: inv.token,
        expiresAt: inv.expires_at,
        usedBy: inv.used_by,
        usedAt: inv.used_at,
        isMultiUse: inv.is_multi_use,
        createdAt: inv.created_at,
      }))

      return {
        success: true,
        data: results,
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          success: false,
          error: 'Invalid project ID or user ID',
        }
      }

      console.error('Error in getActiveInvitations:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      }
    }
  }
}
