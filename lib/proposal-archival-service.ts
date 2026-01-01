/**
 * Proposal Archival Service
 * 
 * Handles archiving and unarchiving of proposals with:
 * - Archive/unarchive functionality
 * - Archived status and filtering
 * - Read-only access enforcement for archived proposals
 * - Search options for including/excluding archived proposals
 * - Data preservation during archival
 * 
 * Requirements: 20.2, 20.3, 20.4, 20.5
 */

import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

// ============================================================
// TYPES AND VALIDATION
// ============================================================

const ArchiveProposalInputSchema = z.object({
  proposalId: z.string().uuid('Invalid proposal ID'),
  userId: z.string().uuid('Invalid user ID'),
  reason: z.string().optional(),
});

const UnarchiveProposalInputSchema = z.object({
  proposalId: z.string().uuid('Invalid proposal ID'),
  userId: z.string().uuid('Invalid user ID'),
});

const GetProposalsInputSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  includeArchived: z.boolean().default(false),
  archivedOnly: z.boolean().default(false),
  projectId: z.string().uuid().optional(),
  status: z.enum(['draft', 'submitted', 'reviewing', 'approved', 'rejected', 'archived']).optional(),
});

const CheckArchivedInputSchema = z.object({
  proposalId: z.string().uuid('Invalid proposal ID'),
});

export interface ArchiveProposalInput {
  proposalId: string;
  userId: string;
  reason?: string;
}

export interface UnarchiveProposalInput {
  proposalId: string;
  userId: string;
}

export interface GetProposalsInput {
  userId: string;
  includeArchived?: boolean;
  archivedOnly?: boolean;
  projectId?: string;
  status?: 'draft' | 'submitted' | 'reviewing' | 'approved' | 'rejected' | 'archived';
}

export interface CheckArchivedInput {
  proposalId: string;
}

export interface ArchivalResult {
  success: boolean;
  error?: string;
}

export interface ProposalSummary {
  id: string;
  title: string;
  projectId: string;
  projectTitle: string;
  status: string;
  leadId: string;
  leadName: string;
  submittedAt?: string;
  archivedAt?: string;
  archivedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ArchivedCheckResult {
  isArchived: boolean;
  archivedAt?: string;
  archivedBy?: string;
  archivedByName?: string;
}

// ============================================================
// PROPOSAL ARCHIVAL SERVICE
// ============================================================

export class ProposalArchivalService {
  /**
   * Archive a proposal
   * Requirement 20.2: Data preservation during archival
   * Requirement 20.3: Archived status and filtering
   * 
   * @param input - Archive parameters
   * @returns Success status
   */
  static async archiveProposal(
    input: ArchiveProposalInput
  ): Promise<ArchivalResult> {
    try {
      // Validate input
      const validated = ArchiveProposalInputSchema.parse(input);

      const supabase = await createClient();

      // Get proposal and verify access
      const { data: proposal, error: proposalError } = await supabase
        .from('proposals')
        .select(`
          id,
          lead_id,
          project_id,
          status,
          title
        `)
        .eq('id', validated.proposalId)
        .single();

      if (proposalError || !proposal) {
        return {
          success: false,
          error: 'Proposal not found or access denied',
        };
      }

      // Check if user is the lead or a team member
      const { data: teamMember } = await supabase
        .from('bid_team_members')
        .select('id, role')
        .eq('project_id', proposal.project_id)
        .eq('user_id', validated.userId)
        .maybeSingle();

      const isLead = proposal.lead_id === validated.userId;
      const isTeamLead = teamMember?.role === 'lead';

      if (!isLead && !isTeamLead) {
        return {
          success: false,
          error: 'Only the proposal lead can archive proposals',
        };
      }

      // Check if already archived
      if (proposal.status === 'archived') {
        return {
          success: false,
          error: 'Proposal is already archived',
        };
      }

      // Archive the proposal
      const { error: updateError } = await supabase
        .from('proposals')
        .update({
          status: 'archived',
          archived_at: new Date().toISOString(),
          archived_by: validated.userId,
        })
        .eq('id', validated.proposalId);

      if (updateError) {
        console.error('Failed to archive proposal:', updateError);
        return {
          success: false,
          error: `Failed to archive proposal: ${updateError.message}`,
        };
      }

      // Log the archival (optional - could create an audit log entry)
      console.log(`Proposal ${validated.proposalId} archived by user ${validated.userId}`);
      if (validated.reason) {
        console.log(`Reason: ${validated.reason}`);
      }

      return {
        success: true,
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          success: false,
          error: error.issues.map((e) => e.message).join(', '),
        };
      }

      console.error('Error in archiveProposal:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to archive proposal',
      };
    }
  }

  /**
   * Unarchive a proposal
   * Restores proposal to its previous status (before archival)
   * 
   * @param input - Unarchive parameters
   * @returns Success status
   */
  static async unarchiveProposal(
    input: UnarchiveProposalInput
  ): Promise<ArchivalResult> {
    try {
      // Validate input
      const validated = UnarchiveProposalInputSchema.parse(input);

      const supabase = await createClient();

      // Get proposal and verify access
      const { data: proposal, error: proposalError } = await supabase
        .from('proposals')
        .select(`
          id,
          lead_id,
          project_id,
          status,
          submitted_at
        `)
        .eq('id', validated.proposalId)
        .single();

      if (proposalError || !proposal) {
        return {
          success: false,
          error: 'Proposal not found or access denied',
        };
      }

      // Check if user is the lead
      if (proposal.lead_id !== validated.userId) {
        return {
          success: false,
          error: 'Only the proposal lead can unarchive proposals',
        };
      }

      // Check if actually archived
      if (proposal.status !== 'archived') {
        return {
          success: false,
          error: 'Proposal is not archived',
        };
      }

      // Determine the status to restore to
      // If it was submitted, restore to submitted, otherwise draft
      const restoreStatus = proposal.submitted_at ? 'submitted' : 'draft';

      // Unarchive the proposal
      const { error: updateError } = await supabase
        .from('proposals')
        .update({
          status: restoreStatus,
          archived_at: null,
          archived_by: null,
        })
        .eq('id', validated.proposalId);

      if (updateError) {
        console.error('Failed to unarchive proposal:', updateError);
        return {
          success: false,
          error: `Failed to unarchive proposal: ${updateError.message}`,
        };
      }

      console.log(`Proposal ${validated.proposalId} unarchived by user ${validated.userId}`);

      return {
        success: true,
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          success: false,
          error: error.issues.map((e) => e.message).join(', '),
        };
      }

      console.error('Error in unarchiveProposal:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to unarchive proposal',
      };
    }
  }

  /**
   * Get proposals with filtering options
   * Requirement 20.3: Archived status and filtering
   * Requirement 20.4: Search options for including/excluding archived
   * 
   * @param input - Filter parameters
   * @returns List of proposals
   */
  static async getProposals(
    input: GetProposalsInput
  ): Promise<{ success: boolean; data?: ProposalSummary[]; error?: string }> {
    try {
      // Validate input
      const validated = GetProposalsInputSchema.parse(input);

      const supabase = await createClient();

      // Build query
      let query = supabase
        .from('proposals')
        .select(`
          id,
          title,
          project_id,
          lead_id,
          status,
          submitted_at,
          archived_at,
          archived_by,
          created_at,
          updated_at,
          projects (
            title
          )
        `)
        .eq('lead_id', validated.userId)
        .order('created_at', { ascending: false });

      // Apply archived filtering
      if (validated.archivedOnly) {
        // Only archived proposals
        query = query.eq('status', 'archived');
      } else if (!validated.includeArchived) {
        // Exclude archived proposals (default behavior)
        query = query.neq('status', 'archived');
      }
      // If includeArchived is true and archivedOnly is false, no status filter (show all)

      // Apply project filter
      if (validated.projectId) {
        query = query.eq('project_id', validated.projectId);
      }

      // Apply status filter (if not using archived filters)
      if (validated.status && !validated.archivedOnly) {
        query = query.eq('status', validated.status);
      }

      const { data: proposals, error } = await query;

      if (error) {
        console.error('Failed to fetch proposals:', error);
        return {
          success: false,
          error: `Failed to fetch proposals: ${error.message}`,
        };
      }

      if (!proposals || proposals.length === 0) {
        return {
          success: true,
          data: [],
        };
      }

      // Get lead names
      const leadIds = [...new Set(proposals.map((p) => p.lead_id))];
      const { data: leads } = await supabase
        .from('users')
        .select('id, raw_user_meta_data')
        .in('id', leadIds);

      const leadNames: Record<string, string> = {};
      if (leads) {
        leads.forEach((lead) => {
          leadNames[lead.id] = lead.raw_user_meta_data?.name || lead.raw_user_meta_data?.full_name || 'Unknown';
        });
      }

      // Transform to ProposalSummary
      const summaries: ProposalSummary[] = proposals.map((proposal) => {
        const project = Array.isArray(proposal.projects) ? proposal.projects[0] : proposal.projects;
        return {
          id: proposal.id,
          title: proposal.title || 'Untitled Proposal',
          projectId: proposal.project_id,
          projectTitle: project?.title || 'Unknown Project',
          status: proposal.status?.toUpperCase() || 'DRAFT',
          leadId: proposal.lead_id,
          leadName: leadNames[proposal.lead_id] || 'Unknown',
          submittedAt: proposal.submitted_at || undefined,
          archivedAt: proposal.archived_at || undefined,
          archivedBy: proposal.archived_by || undefined,
          createdAt: proposal.created_at,
          updatedAt: proposal.updated_at,
        };
      });

      return {
        success: true,
        data: summaries,
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          success: false,
          error: error.issues.map((e) => e.message).join(', '),
        };
      }

      console.error('Error in getProposals:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch proposals',
      };
    }
  }

  /**
   * Check if a proposal is archived
   * Requirement 20.5: Read-only access for archived proposals
   * 
   * @param input - Check parameters
   * @returns Archived status and details
   */
  static async isProposalArchived(
    input: CheckArchivedInput
  ): Promise<{ success: boolean; data?: ArchivedCheckResult; error?: string }> {
    try {
      // Validate input
      const validated = CheckArchivedInputSchema.parse(input);

      const supabase = await createClient();

      // Get proposal archived status
      const { data: proposal, error } = await supabase
        .from('proposals')
        .select(`
          status,
          archived_at,
          archived_by
        `)
        .eq('id', validated.proposalId)
        .single();

      if (error || !proposal) {
        return {
          success: false,
          error: 'Proposal not found',
        };
      }

      const isArchived = proposal.status === 'archived';

      if (!isArchived) {
        return {
          success: true,
          data: {
            isArchived: false,
          },
        };
      }

      // Get archived by user name
      let archivedByName: string | undefined;
      if (proposal.archived_by) {
        const { data: user } = await supabase
          .from('users')
          .select('raw_user_meta_data')
          .eq('id', proposal.archived_by)
          .single();

        if (user) {
          archivedByName = user.raw_user_meta_data?.name || user.raw_user_meta_data?.full_name;
        }
      }

      return {
        success: true,
        data: {
          isArchived: true,
          archivedAt: proposal.archived_at || undefined,
          archivedBy: proposal.archived_by || undefined,
          archivedByName,
        },
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          success: false,
          error: error.issues.map((e) => e.message).join(', '),
        };
      }

      console.error('Error in isProposalArchived:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to check archived status',
      };
    }
  }

  /**
   * Get archived proposals count for a user
   * 
   * @param userId - User ID
   * @returns Count of archived proposals
   */
  static async getArchivedCount(
    userId: string
  ): Promise<{ success: boolean; count?: number; error?: string }> {
    try {
      z.string().uuid().parse(userId);

      const supabase = await createClient();

      const { count, error } = await supabase
        .from('proposals')
        .select('id', { count: 'exact', head: true })
        .eq('lead_id', userId)
        .eq('status', 'archived');

      if (error) {
        return {
          success: false,
          error: error.message,
        };
      }

      return {
        success: true,
        count: count || 0,
      };
    } catch (error) {
      console.error('Error in getArchivedCount:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get archived count',
      };
    }
  }

  /**
   * Bulk archive multiple proposals
   * 
   * @param proposalIds - Array of proposal IDs
   * @param userId - User ID performing the archival
   * @returns Results for each proposal
   */
  static async bulkArchive(
    proposalIds: string[],
    userId: string
  ): Promise<{ success: boolean; results?: Array<{ proposalId: string; success: boolean; error?: string }>; error?: string }> {
    try {
      const results = await Promise.all(
        proposalIds.map(async (proposalId) => {
          const result = await this.archiveProposal({ proposalId, userId });
          return {
            proposalId,
            success: result.success,
            error: result.error,
          };
        })
      );

      const allSuccessful = results.every((r) => r.success);

      return {
        success: allSuccessful,
        results,
      };
    } catch (error) {
      console.error('Error in bulkArchive:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to bulk archive',
      };
    }
  }
}
