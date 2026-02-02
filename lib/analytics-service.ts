/**
 * Analytics Service
 * 
 * Provides comprehensive analytics and performance tracking for bidding leads.
 * Implements Requirements 14.1, 14.2, 14.3, 14.4, 14.5
 */

import { createClient, createAdminClient } from '@/lib/supabase/server';

// ============================================================
// TYPES
// ============================================================

export interface BidPerformance {
  totalProposals: number;
  submitted: number;
  accepted: number;
  rejected: number;
  winRate: number;
  statusBreakdown: {
    draft: number;
    submitted: number;
    reviewing: number;
    approved: number;
    rejected: number;
  };
  averageTeamSize: number;
  averageSectionsCount: number;
  averageTimeToSubmit: number; // in seconds
}

export interface TeamMetrics {
  totalMembers: number;
  activeMembers: number;
  averageContribution: number;
  topContributors: Contributor[];
}

export interface Contributor {
  userId: string;
  userName: string;
  email: string;
  sectionsCompleted: number;
  sectionsAssigned: number;
  completionRate: number;
}

export interface ProposalStatistics {
  totalProposals: number;
  byStatus: {
    draft: number;
    submitted: number;
    reviewing: number;
    approved: number;
    rejected: number;
  };
  recentProposals: RecentProposal[];
  performanceMetrics: {
    averageTeamSize: number;
    averageSectionsCount: number;
    averageDocumentsCount: number;
    averageTimeToSubmit: number;
  };
}

export interface RecentProposal {
  id: string;
  projectId: string;
  projectTitle: string;
  status: string;
  submittedAt: string | null;
  teamSize: number;
  sectionsCount: number;
  documentsCount: number;
}

export interface ActivityPoint {
  date: string;
  count: number;
  status?: string;
}

export interface ActivityTimeline {
  proposalActivity: ActivityPoint[];
  submissionActivity: ActivityPoint[];
  acceptanceActivity: ActivityPoint[];
}

// ============================================================
// ANALYTICS SERVICE
// ============================================================

export class AnalyticsService {
  /**
   * Get comprehensive bid performance metrics for a lead
   * Requirement 14.1, 14.2
   */
  static async getBidPerformance(leadId: string): Promise<BidPerformance> {
    const supabase = await createClient();

    // Use the database function for optimized performance calculation
    const { data, error } = await supabase.rpc('get_bid_performance', {
      p_lead_id: leadId,
    });

    if (error) {
      console.error('Error fetching bid performance:', error);
      throw new Error(`Failed to fetch bid performance: ${error.message}`);
    }

    if (!data) {
      // Return default values if no data
      return {
        totalProposals: 0,
        submitted: 0,
        accepted: 0,
        rejected: 0,
        winRate: 0,
        statusBreakdown: {
          draft: 0,
          submitted: 0,
          reviewing: 0,
          approved: 0,
          rejected: 0,
        },
        averageTeamSize: 0,
        averageSectionsCount: 0,
        averageTimeToSubmit: 0,
      };
    }

    return {
      totalProposals: data.totalProposals || 0,
      submitted: data.submitted || 0,
      accepted: data.accepted || 0,
      rejected: data.rejected || 0,
      winRate: data.winRate || 0,
      statusBreakdown: {
        draft: data.statusBreakdown?.draft || 0,
        submitted: data.statusBreakdown?.submitted || 0,
        reviewing: data.statusBreakdown?.reviewing || 0,
        approved: data.statusBreakdown?.approved || 0,
        rejected: data.statusBreakdown?.rejected || 0,
      },
      averageTeamSize: data.averageTeamSize || 0,
      averageSectionsCount: data.averageSectionsCount || 0,
      averageTimeToSubmit: data.averageTimeToSubmit || 0,
    };
  }

  /**
   * Get team metrics and contribution statistics for a project
   * Requirement 14.3, 14.5
   */
  static async getTeamMetrics(projectId: string): Promise<TeamMetrics> {
    const supabase = await createClient();

    // Get all proposals for this project
    const { data: proposals } = await supabase
      .from('proposals')
      .select('id')
      .eq('project_id', projectId);

    if (!proposals || proposals.length === 0) {
      return {
        totalMembers: 0,
        activeMembers: 0,
        averageContribution: 0,
        topContributors: [],
      };
    }

    const proposalIds = proposals.map(p => p.id);

    // Get all team members for the proposals
    const { data: teamMembers, error: teamError } = await supabase
      .from('proposal_team_members')
      .select('user_id, role, joined_at')
      .in('proposal_id', proposalIds);

    if (teamError) {
      console.error('Error fetching team members:', teamError);
      throw new Error(`Failed to fetch team members: ${teamError.message}`);
    }

    // Get user details separately using admin client
    const adminClient = createAdminClient();
    const teamMembersWithUsers = await Promise.all(
      (teamMembers || []).map(async (member: any) => {
        const { data: userData } = await adminClient.auth.admin.getUserById(member.user_id);
        return {
          user_id: member.user_id,
          role: member.role,
          created_at: member.joined_at,
          user: userData?.user ? {
            id: userData.user.id,
            email: userData.user.email,
            full_name: userData.user.user_metadata?.full_name || userData.user.user_metadata?.name,
          } : null,
        };
      })
    );

    if (!teamMembersWithUsers || teamMembersWithUsers.length === 0) {
      return {
        totalMembers: 0,
        activeMembers: 0,
        averageContribution: 0,
        topContributors: [],
      };
    }

    // Get document sections for contribution tracking
    const { data: sections } = await supabase
      .from('document_sections')
      .select(`
        id,
        assigned_to,
        status,
        document_id,
        workspace_documents!inner (
          workspace_id,
          workspaces!inner (
            project_id
          )
        )
      `)
      .eq('workspace_documents.workspaces.project_id', projectId);

    // Calculate contribution statistics
    const contributionMap = new Map<string, {
      sectionsCompleted: number;
      sectionsAssigned: number;
    }>();

    sections?.forEach((section) => {
      if (section.assigned_to) {
        const current = contributionMap.get(section.assigned_to) || {
          sectionsCompleted: 0,
          sectionsAssigned: 0,
        };
        
        current.sectionsAssigned++;
        if (section.status === 'completed') {
          current.sectionsCompleted++;
        }
        
        contributionMap.set(section.assigned_to, current);
      }
    });

    // Build contributor list
    const contributors: Contributor[] = teamMembersWithUsers
      .map((member: any) => {
        const stats = contributionMap.get(member.user_id) || {
          sectionsCompleted: 0,
          sectionsAssigned: 0,
        };
        
        return {
          userId: member.user_id,
          userName: member.user?.full_name || 'Unknown',
          email: member.user?.email || '',
          sectionsCompleted: stats.sectionsCompleted,
          sectionsAssigned: stats.sectionsAssigned,
          completionRate: stats.sectionsAssigned > 0
            ? (stats.sectionsCompleted / stats.sectionsAssigned) * 100
            : 0,
        };
      })
      .sort((a, b) => b.sectionsCompleted - a.sectionsCompleted);

    // Calculate active members (those with assigned sections)
    const activeMembers = contributors.filter(c => c.sectionsAssigned > 0).length;

    // Calculate average contribution
    const totalSections = sections?.length || 0;
    const averageContribution = teamMembersWithUsers.length > 0
      ? totalSections / teamMembersWithUsers.length
      : 0;

    return {
      totalMembers: teamMembersWithUsers.length,
      activeMembers,
      averageContribution: Math.round(averageContribution * 10) / 10,
      topContributors: contributors.slice(0, 5), // Top 5 contributors
    };
  }

  /**
   * Get comprehensive proposal statistics for a lead
   * Requirement 14.3, 14.4
   */
  static async getProposalStatistics(leadId: string): Promise<ProposalStatistics> {
    const supabase = await createClient();

    // Get all proposals for the lead
    const { data: proposals, error: proposalsError } = await supabase
      .from('proposals')
      .select(`
        id,
        project_id,
        status,
        submitted_at,
        projects (
          title
        )
      `)
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false });

    if (proposalsError) {
      console.error('Error fetching proposals:', proposalsError);
      throw new Error(`Failed to fetch proposals: ${proposalsError.message}`);
    }

    if (!proposals || proposals.length === 0) {
      return {
        totalProposals: 0,
        byStatus: {
          draft: 0,
          submitted: 0,
          reviewing: 0,
          approved: 0,
          rejected: 0,
        },
        recentProposals: [],
        performanceMetrics: {
          averageTeamSize: 0,
          averageSectionsCount: 0,
          averageDocumentsCount: 0,
          averageTimeToSubmit: 0,
        },
      };
    }

    // Count by status
    const byStatus = {
      draft: 0,
      submitted: 0,
      reviewing: 0,
      approved: 0,
      rejected: 0,
    };

    proposals.forEach((proposal: any) => {
      const status = proposal.status as keyof typeof byStatus;
      if (status in byStatus) {
        byStatus[status]++;
      }
    });

    // Get performance metrics for all proposals
    const { data: performanceData } = await supabase
      .from('proposal_performance')
      .select('*')
      .eq('lead_id', leadId);

    const performanceMetrics = {
      averageTeamSize: 0,
      averageSectionsCount: 0,
      averageDocumentsCount: 0,
      averageTimeToSubmit: 0,
    };

    if (performanceData && performanceData.length > 0) {
      const totalTeamSize = performanceData.reduce((sum, p) => sum + (p.team_size || 0), 0);
      const totalSections = performanceData.reduce((sum, p) => sum + (p.sections_count || 0), 0);
      const totalDocuments = performanceData.reduce((sum, p) => sum + (p.documents_count || 0), 0);
      
      // Calculate average time to submit (convert interval to seconds)
      const submittedProposals = performanceData.filter(p => p.time_to_submit);
      let totalSeconds = 0;
      submittedProposals.forEach(p => {
        if (p.time_to_submit) {
          // Parse PostgreSQL interval format
          const match = p.time_to_submit.match(/(\d+):(\d+):(\d+)/);
          if (match) {
            const hours = parseInt(match[1]);
            const minutes = parseInt(match[2]);
            const seconds = parseInt(match[3]);
            totalSeconds += hours * 3600 + minutes * 60 + seconds;
          }
        }
      });

      performanceMetrics.averageTeamSize = Math.round((totalTeamSize / performanceData.length) * 10) / 10;
      performanceMetrics.averageSectionsCount = Math.round((totalSections / performanceData.length) * 10) / 10;
      performanceMetrics.averageDocumentsCount = Math.round((totalDocuments / performanceData.length) * 10) / 10;
      performanceMetrics.averageTimeToSubmit = submittedProposals.length > 0
        ? Math.round(totalSeconds / submittedProposals.length)
        : 0;
    }

    // Get recent proposals with performance data
    const recentProposalsData = await Promise.all(
      proposals.slice(0, 10).map(async (proposal: any) => {
        const { data: perfData } = await supabase
          .from('proposal_performance')
          .select('*')
          .eq('proposal_id', proposal.id)
          .single();

        return {
          id: proposal.id,
          projectId: proposal.project_id,
          projectTitle: proposal.projects?.title || 'Untitled Project',
          status: proposal.status,
          submittedAt: proposal.submitted_at,
          teamSize: perfData?.team_size || 0,
          sectionsCount: perfData?.sections_count || 0,
          documentsCount: perfData?.documents_count || 0,
        };
      })
    );

    return {
      totalProposals: proposals.length,
      byStatus,
      recentProposals: recentProposalsData,
      performanceMetrics,
    };
  }

  /**
   * Generate activity timeline showing proposal activity over time
   * Requirement 14.4
   */
  static async getActivityTimeline(
    leadId: string,
    daysBack: number = 30
  ): Promise<ActivityTimeline> {
    const supabase = await createClient();

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    // Get proposals created in the time period
    const { data: proposals, error } = await supabase
      .from('proposals')
      .select('id, status, created_at, submitted_at')
      .eq('lead_id', leadId)
      .gte('created_at', startDate.toISOString());

    if (error) {
      console.error('Error fetching activity timeline:', error);
      throw new Error(`Failed to fetch activity timeline: ${error.message}`);
    }

    // Group by date
    const proposalActivityMap = new Map<string, number>();
    const submissionActivityMap = new Map<string, number>();
    const acceptanceActivityMap = new Map<string, number>();

    proposals?.forEach((proposal: any) => {
      // Proposal creation activity
      const createdDate = new Date(proposal.created_at).toISOString().split('T')[0];
      proposalActivityMap.set(createdDate, (proposalActivityMap.get(createdDate) || 0) + 1);

      // Submission activity
      if (proposal.submitted_at) {
        const submittedDate = new Date(proposal.submitted_at).toISOString().split('T')[0];
        submissionActivityMap.set(submittedDate, (submissionActivityMap.get(submittedDate) || 0) + 1);
      }

      // Acceptance activity
      if (proposal.status === 'approved') {
        // Use submitted_at as proxy for acceptance date (in real system, track separately)
        const acceptedDate = new Date(proposal.submitted_at || proposal.created_at).toISOString().split('T')[0];
        acceptanceActivityMap.set(acceptedDate, (acceptanceActivityMap.get(acceptedDate) || 0) + 1);
      }
    });

    // Convert maps to arrays
    const proposalActivity: ActivityPoint[] = Array.from(proposalActivityMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const submissionActivity: ActivityPoint[] = Array.from(submissionActivityMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const acceptanceActivity: ActivityPoint[] = Array.from(acceptanceActivityMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      proposalActivity,
      submissionActivity,
      acceptanceActivity,
    };
  }

  /**
   * Store or update performance data for a proposal
   * Called automatically when proposals are submitted or updated
   */
  static async updateProposalPerformance(proposalId: string): Promise<void> {
    const supabase = await createClient();

    const { error } = await supabase.rpc('update_proposal_performance', {
      p_proposal_id: proposalId,
    });

    if (error) {
      console.error('Error updating proposal performance:', error);
      throw new Error(`Failed to update proposal performance: ${error.message}`);
    }
  }
}
