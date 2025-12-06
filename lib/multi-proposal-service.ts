/**
 * Multi-Proposal Management Service
 * 
 * Handles management of multiple proposals for bidding leads:
 * - Dashboard view for all proposals
 * - Proposal filtering by status, deadline, project
 * - Workspace state preservation when switching
 * - Aggregate statistics across proposals
 * 
 * Requirements: 17.1, 17.2, 17.3, 17.4, 17.5
 */

import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

// ============================================================
// TYPES AND VALIDATION
// ============================================================

const GetProposalDashboardInputSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  filterStatus: z.enum(['draft', 'submitted', 'reviewing', 'approved', 'rejected', 'archived']).optional(),
  filterDeadlineBefore: z.string().optional(),
  filterDeadlineAfter: z.string().optional(),
  filterProjectId: z.string().uuid().optional(),
  sortBy: z.enum(['deadline', 'status', 'created_at', 'updated_at', 'completion']).default('created_at'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

const SaveWorkspaceStateInputSchema = z.object({
  proposalId: z.string().uuid('Invalid proposal ID'),
  userId: z.string().uuid('Invalid user ID'),
  state: z.any(),
});

const GetWorkspaceStateInputSchema = z.object({
  proposalId: z.string().uuid('Invalid proposal ID'),
  userId: z.string().uuid('Invalid user ID'),
});

const GetAggregateStatsInputSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
});

export interface GetProposalDashboardInput {
  userId: string;
  filterStatus?: 'draft' | 'submitted' | 'reviewing' | 'approved' | 'rejected' | 'archived';
  filterDeadlineBefore?: string;
  filterDeadlineAfter?: string;
  filterProjectId?: string;
  sortBy?: 'deadline' | 'status' | 'created_at' | 'updated_at' | 'completion';
  sortOrder?: 'asc' | 'desc';
}

export interface SaveWorkspaceStateInput {
  proposalId: string;
  userId: string;
  state: Record<string, any>;
}

export interface GetWorkspaceStateInput {
  proposalId: string;
  userId: string;
}

export interface GetAggregateStatsInput {
  userId: string;
}

export interface ProposalDashboardItem {
  id: string;
  projectId: string;
  projectName: string;
  projectDeadline: string | null;
  status: string;
  completionPercentage: number;
  teamSize: number;
  unreadMessages: number;
  lastActivity: string;
  createdAt: string;
  updatedAt: string;
}

export interface AggregateStatistics {
  totalProposals: number;
  activeProposals: number;
  draftProposals: number;
  submittedProposals: number;
  approvedProposals: number;
  rejectedProposals: number;
  archivedProposals: number;
  averageCompletionRate: number;
  upcomingDeadlines: number;
  overdueProposals: number;
  totalTeamMembers: number;
  averageTeamSize: number;
}

export interface WorkspaceState {
  proposalId: string;
  state: Record<string, any>;
  savedAt: string;
}

// ============================================================
// MULTI-PROPOSAL MANAGEMENT SERVICE
// ============================================================

export class MultiProposalService {
  /**
   * Get dashboard view of all proposals for a bidding lead
   * Requirement 17.1: Display all active proposals across different projects
   * Requirement 17.2: Show project name, proposal status, deadline, and completion percentage
   * Requirement 17.3: Support filtering by status, deadline, and project
   * 
   * @param input - Dashboard filter parameters
   * @returns List of proposals with metadata
   */
  static async getProposalDashboard(
    input: GetProposalDashboardInput
  ): Promise<{ success: boolean; data?: ProposalDashboardItem[]; error?: string }> {
    try {
      // Validate input
      const validated = GetProposalDashboardInputSchema.parse(input);

      const supabase = await createClient();

      // Build query for proposals
      let query = supabase
        .from('proposals')
        .select(`
          id,
          project_id,
          status,
          created_at,
          updated_at,
          projects!inner (
            id,
            title,
            deadline
          )
        `)
        .eq('lead_id', validated.userId);

      // Apply status filter
      if (validated.filterStatus) {
        query = query.eq('status', validated.filterStatus);
      }

      // Apply project filter
      if (validated.filterProjectId) {
        query = query.eq('project_id', validated.filterProjectId);
      }

      const { data: proposals, error: proposalsError } = await query;

      if (proposalsError) {
        console.error('Failed to fetch proposals:', proposalsError);
        return {
          success: false,
          error: `Failed to fetch proposals: ${proposalsError.message}`,
        };
      }

      if (!proposals || proposals.length === 0) {
        return {
          success: true,
          data: [],
        };
      }

      // Get additional data for each proposal
      const dashboardItems = await Promise.all(
        proposals.map(async (proposal: any) => {
          // Get team size
          const { count: teamSize } = await supabase
            .from('bid_team_members')
            .select('*', { count: 'exact', head: true })
            .eq('project_id', proposal.project_id);

          // Get unread messages count
          const { count: unreadCount } = await supabase
            .from('chat_messages')
            .select('*', { count: 'exact', head: true })
            .eq('proposal_id', proposal.id)
            .eq('read', false)
            .neq('sender_id', validated.userId);

          // Get completion percentage (based on document sections)
          const { data: sections } = await supabase
            .from('document_sections')
            .select('status')
            .eq('proposal_id', proposal.id);

          let completionPercentage = 0;
          if (sections && sections.length > 0) {
            const completedSections = sections.filter(
              (s: any) => s.status === 'completed'
            ).length;
            completionPercentage = Math.round((completedSections / sections.length) * 100);
          }

          // Get last activity (most recent update to sections or documents)
          const { data: recentActivity } = await supabase
            .from('document_sections')
            .select('updated_at')
            .eq('proposal_id', proposal.id)
            .order('updated_at', { ascending: false })
            .limit(1)
            .single();

          const lastActivity = recentActivity?.updated_at || proposal.updated_at;

          return {
            id: proposal.id,
            projectId: proposal.project_id,
            projectName: proposal.projects.title,
            projectDeadline: proposal.projects.deadline,
            status: proposal.status,
            completionPercentage,
            teamSize: teamSize || 0,
            unreadMessages: unreadCount || 0,
            lastActivity,
            createdAt: proposal.created_at,
            updatedAt: proposal.updated_at,
          };
        })
      );

      // Apply deadline filters
      let filteredItems = dashboardItems;
      if (validated.filterDeadlineBefore) {
        const beforeDate = new Date(validated.filterDeadlineBefore);
        filteredItems = filteredItems.filter((item) => {
          if (!item.projectDeadline) return false;
          return new Date(item.projectDeadline) <= beforeDate;
        });
      }
      if (validated.filterDeadlineAfter) {
        const afterDate = new Date(validated.filterDeadlineAfter);
        filteredItems = filteredItems.filter((item) => {
          if (!item.projectDeadline) return false;
          return new Date(item.projectDeadline) >= afterDate;
        });
      }

      // Apply sorting
      filteredItems.sort((a, b) => {
        let aValue: any;
        let bValue: any;

        switch (validated.sortBy) {
          case 'deadline':
            aValue = a.projectDeadline ? new Date(a.projectDeadline).getTime() : 0;
            bValue = b.projectDeadline ? new Date(b.projectDeadline).getTime() : 0;
            break;
          case 'status':
            aValue = a.status;
            bValue = b.status;
            break;
          case 'completion':
            aValue = a.completionPercentage;
            bValue = b.completionPercentage;
            break;
          case 'updated_at':
            aValue = new Date(a.updatedAt).getTime();
            bValue = new Date(b.updatedAt).getTime();
            break;
          case 'created_at':
          default:
            aValue = new Date(a.createdAt).getTime();
            bValue = new Date(b.createdAt).getTime();
            break;
        }

        if (validated.sortOrder === 'asc') {
          return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
        } else {
          return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
        }
      });

      return {
        success: true,
        data: filteredItems,
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          success: false,
          error: error.issues.map((e) => e.message).join(', '),
        };
      }

      console.error('Error in getProposalDashboard:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch proposal dashboard',
      };
    }
  }

  /**
   * Save workspace state for a proposal
   * Requirement 17.4: Preserve the state of each proposal workspace when switching
   * 
   * @param input - Workspace state to save
   * @returns Success status
   */
  static async saveWorkspaceState(
    input: SaveWorkspaceStateInput
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Validate input
      const validated = SaveWorkspaceStateInputSchema.parse(input);

      const supabase = await createClient();

      // Check if state already exists
      const { data: existing } = await supabase
        .from('proposal_workspace_states')
        .select('id')
        .eq('proposal_id', validated.proposalId)
        .eq('user_id', validated.userId)
        .single();

      if (existing) {
        // Update existing state
        const { error: updateError } = await supabase
          .from('proposal_workspace_states')
          .update({
            state: validated.state,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);

        if (updateError) {
          console.error('Failed to update workspace state:', updateError);
          return {
            success: false,
            error: `Failed to update workspace state: ${updateError.message}`,
          };
        }
      } else {
        // Create new state
        const { error: insertError } = await supabase
          .from('proposal_workspace_states')
          .insert({
            proposal_id: validated.proposalId,
            user_id: validated.userId,
            state: validated.state,
          });

        if (insertError) {
          console.error('Failed to save workspace state:', insertError);
          return {
            success: false,
            error: `Failed to save workspace state: ${insertError.message}`,
          };
        }
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

      console.error('Error in saveWorkspaceState:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save workspace state',
      };
    }
  }

  /**
   * Get workspace state for a proposal
   * Requirement 17.4: Preserve the state of each proposal workspace when switching
   * 
   * @param input - Proposal and user identifiers
   * @returns Workspace state
   */
  static async getWorkspaceState(
    input: GetWorkspaceStateInput
  ): Promise<{ success: boolean; data?: WorkspaceState; error?: string }> {
    try {
      // Validate input
      const validated = GetWorkspaceStateInputSchema.parse(input);

      const supabase = await createClient();

      const { data: state, error } = await supabase
        .from('proposal_workspace_states')
        .select('*')
        .eq('proposal_id', validated.proposalId)
        .eq('user_id', validated.userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        // PGRST116 is "not found" which is acceptable
        console.error('Failed to fetch workspace state:', error);
        return {
          success: false,
          error: `Failed to fetch workspace state: ${error.message}`,
        };
      }

      if (!state) {
        // No saved state, return empty state
        return {
          success: true,
          data: {
            proposalId: validated.proposalId,
            state: {},
            savedAt: new Date().toISOString(),
          },
        };
      }

      return {
        success: true,
        data: {
          proposalId: state.proposal_id,
          state: state.state || {},
          savedAt: state.updated_at || state.created_at,
        },
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          success: false,
          error: error.issues.map((e) => e.message).join(', '),
        };
      }

      console.error('Error in getWorkspaceState:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch workspace state',
      };
    }
  }

  /**
   * Get aggregate statistics across all proposals
   * Requirement 17.5: Show aggregate metrics across all proposals
   * 
   * @param input - User identifier
   * @returns Aggregate statistics
   */
  static async getAggregateStatistics(
    input: GetAggregateStatsInput
  ): Promise<{ success: boolean; data?: AggregateStatistics; error?: string }> {
    try {
      // Validate input
      const validated = GetAggregateStatsInputSchema.parse(input);

      const supabase = await createClient();

      // Get all proposals for the user
      const { data: proposals, error: proposalsError } = await supabase
        .from('proposals')
        .select(`
          id,
          project_id,
          status,
          projects!inner (
            deadline
          )
        `)
        .eq('lead_id', validated.userId);

      if (proposalsError) {
        console.error('Failed to fetch proposals for stats:', proposalsError);
        return {
          success: false,
          error: `Failed to fetch proposals: ${proposalsError.message}`,
        };
      }

      const totalProposals = proposals?.length || 0;

      // Count by status
      const draftProposals = proposals?.filter((p) => p.status === 'draft').length || 0;
      const submittedProposals = proposals?.filter((p) => p.status === 'submitted').length || 0;
      const approvedProposals = proposals?.filter((p) => p.status === 'approved').length || 0;
      const rejectedProposals = proposals?.filter((p) => p.status === 'rejected').length || 0;
      const archivedProposals = proposals?.filter((p) => p.status === 'archived').length || 0;
      const activeProposals = totalProposals - archivedProposals;

      // Calculate upcoming deadlines (within 7 days)
      const now = new Date();
      const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const upcomingDeadlines =
        proposals?.filter((p) => {
          const project = Array.isArray(p.projects) ? p.projects[0] : p.projects;
          if (!project?.deadline) return false;
          const deadline = new Date(project.deadline);
          return deadline >= now && deadline <= sevenDaysFromNow;
        }).length || 0;

      // Calculate overdue proposals
      const overdueProposals =
        proposals?.filter((p) => {
          const project = Array.isArray(p.projects) ? p.projects[0] : p.projects;
          if (!project?.deadline || p.status === 'submitted' || p.status === 'approved' || p.status === 'rejected' || p.status === 'archived') {
            return false;
          }
          const deadline = new Date(project.deadline);
          return deadline < now;
        }).length || 0;

      // Calculate average completion rate
      let totalCompletion = 0;
      let proposalsWithSections = 0;

      for (const proposal of proposals || []) {
        const { data: sections } = await supabase
          .from('document_sections')
          .select('status')
          .eq('proposal_id', proposal.id);

        if (sections && sections.length > 0) {
          proposalsWithSections++;
          const completedSections = sections.filter((s: any) => s.status === 'completed').length;
          totalCompletion += (completedSections / sections.length) * 100;
        }
      }

      const averageCompletionRate =
        proposalsWithSections > 0 ? Math.round(totalCompletion / proposalsWithSections) : 0;

      // Calculate team statistics
      const projectIds = [...new Set(proposals?.map((p) => p.project_id) || [])];
      let totalTeamMembers = 0;

      for (const projectId of projectIds) {
        const { count } = await supabase
          .from('bid_team_members')
          .select('*', { count: 'exact', head: true })
          .eq('project_id', projectId);

        totalTeamMembers += count || 0;
      }

      const averageTeamSize =
        projectIds.length > 0 ? Math.round(totalTeamMembers / projectIds.length) : 0;

      return {
        success: true,
        data: {
          totalProposals,
          activeProposals,
          draftProposals,
          submittedProposals,
          approvedProposals,
          rejectedProposals,
          archivedProposals,
          averageCompletionRate,
          upcomingDeadlines,
          overdueProposals,
          totalTeamMembers,
          averageTeamSize,
        },
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          success: false,
          error: error.issues.map((e) => e.message).join(', '),
        };
      }

      console.error('Error in getAggregateStatistics:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to calculate statistics',
      };
    }
  }

  /**
   * Clear workspace state for a proposal
   * 
   * @param proposalId - Proposal ID
   * @param userId - User ID
   * @returns Success status
   */
  static async clearWorkspaceState(
    proposalId: string,
    userId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      z.string().uuid().parse(proposalId);
      z.string().uuid().parse(userId);

      const supabase = await createClient();

      const { error } = await supabase
        .from('proposal_workspace_states')
        .delete()
        .eq('proposal_id', proposalId)
        .eq('user_id', userId);

      if (error) {
        console.error('Failed to clear workspace state:', error);
        return {
          success: false,
          error: error.message,
        };
      }

      return {
        success: true,
      };
    } catch (error) {
      console.error('Error in clearWorkspaceState:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to clear workspace state',
      };
    }
  }
}
