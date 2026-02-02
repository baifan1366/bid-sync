/**
 * Proposal Service
 * 
 * Handles proposal creation, initialization, and management for bidding leaders.
 * Implements requirements 2.1, 2.2, 2.3, 2.4, 2.5 from the bidding-leader-management spec.
 */

import { createClient } from '@/lib/supabase/server';

export interface CreateProposalResult {
  success: boolean;
  proposal?: {
    id: string;
    projectId: string;
    leadId: string;
    status: string;
    createdAt: string;
  };
  workspace?: {
    id: string;
    name: string;
  };
  document?: {
    id: string;
    title: string;
  };
  error?: string;
  errorCode?: 'DUPLICATE_PROPOSAL' | 'PROJECT_NOT_FOUND' | 'UNAUTHORIZED' | 'WORKSPACE_CREATION_FAILED' | 'UNKNOWN';
}

export interface ProposalInitializationData {
  proposalId: string;
  workspaceId: string;
  documentId: string;
  sections: Array<{
    id: string;
    title: string;
    order: number;
  }>;
}

export interface SubmitProposalResult {
  success: boolean;
  proposal?: {
    id: string;
    status: string;
    submittedAt: string;
  };
  notificationsSent?: number;
  notificationsFailed?: number;
  error?: string;
  errorCode?: 'PROPOSAL_NOT_FOUND' | 'INVALID_STATUS' | 'COMPLIANCE_FAILED' | 'UPDATE_FAILED' | 'UNKNOWN';
  complianceIssues?: Array<any>;
  complianceReport?: string;
}

/**
 * ProposalService class for managing proposal lifecycle
 */
export class ProposalService {
  /**
   * Creates a new proposal for a project
   * 
   * Requirements:
   * - 2.1: Create proposal with status "draft"
   * - 2.2: Associate with project and bidding lead
   * - 2.3: Automatically create workspace
   * - 2.4: Initialize with default sections
   * 
   * Note: Multiple proposals per project are allowed. A bidding leader can create
   * multiple proposals for the same project (different approaches, teams, etc.)
   * but only one can be submitted to the client at a time.
   * 
   * @param projectId - The project ID to create proposal for
   * @param leadId - The bidding lead user ID
   * @returns CreateProposalResult with proposal and workspace data
   */
  static async createProposal(
    projectId: string,
    leadId: string
  ): Promise<CreateProposalResult> {
    try {
      const supabase = await createClient();

      // Verify the project exists and is open
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('id, title, status')
        .eq('id', projectId)
        .single();

      if (projectError || !project) {
        return {
          success: false,
          error: 'Project not found',
          errorCode: 'PROJECT_NOT_FOUND',
        };
      }

      // Note: Multiple proposals per project are allowed
      // A bidding leader can create multiple proposals for the same project
      // (e.g., different approaches, different team compositions)
      // Only one can be submitted to the client at a time

      // Create the proposal (Requirements 2.1, 2.2)
      const { data: proposal, error: proposalError } = await supabase
        .from('proposals')
        .insert({
          project_id: projectId,
          lead_id: leadId,
          status: 'draft',
        })
        .select('id, project_id, lead_id, status, created_at')
        .single();

      if (proposalError || !proposal) {
        console.error('Error creating proposal:', proposalError);
        return {
          success: false,
          error: 'Failed to create proposal',
          errorCode: 'UNKNOWN',
        };
      }

      // Create workspace for collaboration (Requirement 2.3)
      const workspaceName = `${project.title} - Proposal Workspace`;
      const { data: workspace, error: workspaceError } = await supabase
        .from('workspaces')
        .insert({
          project_id: projectId,
          lead_id: leadId,
          name: workspaceName,
          description: `Collaborative workspace for proposal on ${project.title}`,
        })
        .select('id, name')
        .single();

      if (workspaceError || !workspace) {
        console.error('Error creating workspace:', workspaceError);
        
        // Rollback: Delete the proposal since workspace creation failed
        await supabase
          .from('proposals')
          .delete()
          .eq('id', proposal.id);

        return {
          success: false,
          error: 'Failed to create workspace',
          errorCode: 'WORKSPACE_CREATION_FAILED',
        };
      }

      // Initialize proposal with default sections (Requirement 2.4)
      const initResult = await this.initializeProposalSections(
        workspace.id,
        leadId,
        project.title
      );

      if (!initResult.success) {
        console.error('Error initializing proposal sections:', initResult.error);
        
        // Rollback: Delete workspace and proposal
        await supabase.from('workspaces').delete().eq('id', workspace.id);
        await supabase.from('proposals').delete().eq('id', proposal.id);

        return {
          success: false,
          error: 'Failed to initialize proposal sections',
          errorCode: 'UNKNOWN',
        };
      }

      return {
        success: true,
        proposal: {
          id: proposal.id,
          projectId: proposal.project_id,
          leadId: proposal.lead_id,
          status: proposal.status,
          createdAt: proposal.created_at,
        },
        workspace: {
          id: workspace.id,
          name: workspace.name,
        },
        document: initResult.data ? {
          id: initResult.data.documentId,
          title: `Proposal for ${project.title}`,
        } : undefined,
      };
    } catch (error) {
      console.error('Unexpected error in createProposal:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        errorCode: 'UNKNOWN',
      };
    }
  }

  /**
   * Initializes a proposal with default sections
   * 
   * Creates a main proposal document with standard sections:
   * - Executive Summary
   * - Technical Approach
   * - Timeline & Deliverables
   * - Budget Breakdown
   * - Team Qualifications
   * 
   * @param workspaceId - The workspace ID
   * @param leadId - The bidding lead user ID
   * @param projectTitle - The project title for document naming
   * @returns Result with initialization data
   */
  private static async initializeProposalSections(
    workspaceId: string,
    leadId: string,
    projectTitle: string
  ): Promise<{ success: boolean; error?: string; data?: ProposalInitializationData }> {
    try {
      const supabase = await createClient();

      // Create the main proposal document
      const { data: document, error: docError } = await supabase
        .from('workspace_documents')
        .insert({
          workspace_id: workspaceId,
          title: `Proposal for ${projectTitle}`,
          description: 'Main proposal document',
          content: {},
          created_by: leadId,
          last_edited_by: leadId,
        })
        .select('id')
        .single();

      if (docError || !document) {
        console.error('Error creating proposal document:', docError);
        return {
          success: false,
          error: 'Failed to create proposal document',
        };
      }

      // Define default sections
      const defaultSections = [
        { title: 'Executive Summary', order: 1 },
        { title: 'Technical Approach', order: 2 },
        { title: 'Timeline & Deliverables', order: 3 },
        { title: 'Budget Breakdown', order: 4 },
        { title: 'Team Qualifications', order: 5 },
      ];

      // Create sections
      const sectionsToInsert = defaultSections.map((section) => ({
        document_id: document.id,
        title: section.title,
        order: section.order,
        status: 'not_started' as const,
        content: {},
      }));

      const { data: sections, error: sectionsError } = await supabase
        .from('document_sections')
        .insert(sectionsToInsert)
        .select('id, title, order');

      if (sectionsError || !sections) {
        console.error('Error creating sections:', sectionsError);
        return {
          success: false,
          error: 'Failed to create proposal sections',
        };
      }

      return {
        success: true,
        data: {
          proposalId: workspaceId,
          workspaceId: workspaceId,
          documentId: document.id,
          sections: sections.map((s) => ({
            id: s.id,
            title: s.title,
            order: s.order,
          })),
        },
      };
    } catch (error) {
      console.error('Unexpected error in initializeProposalSections:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Gets a proposal by ID with full details
   * 
   * @param proposalId - The proposal ID
   * @returns Proposal data or null
   */
  static async getProposal(proposalId: string) {
    try {
      const supabase = await createClient();

      const { data: proposal, error } = await supabase
        .from('proposals')
        .select(`
          id,
          project_id,
          lead_id,
          status,
          submitted_at,
          created_at,
          updated_at,
          projects (
            id,
            title,
            description,
            status,
            budget,
            deadline
          )
        `)
        .eq('id', proposalId)
        .single();

      if (error) {
        console.error('Error fetching proposal:', error);
        return null;
      }

      return proposal;
    } catch (error) {
      console.error('Unexpected error in getProposal:', error);
      return null;
    }
  }

  /**
   * Gets workspace for a proposal
   * 
   * @param projectId - The project ID
   * @param leadId - The lead ID
   * @returns Workspace data or null
   */
  static async getWorkspaceByProject(projectId: string, leadId: string) {
    try {
      const supabase = await createClient();

      const { data: workspace, error } = await supabase
        .from('workspaces')
        .select('*')
        .eq('project_id', projectId)
        .eq('lead_id', leadId)
        .single();

      if (error) {
        console.error('Error fetching workspace:', error);
        return null;
      }

      return workspace;
    } catch (error) {
      console.error('Unexpected error in getWorkspaceByProject:', error);
      return null;
    }
  }

  /**
   * Submits a proposal for review
   * 
   * Requirements:
   * - 13.1: Run a final compliance check before allowing submission
   * - 13.2: Update proposal status from "draft" to "submitted"
   * - 13.3: Record the submission timestamp and lock editing
   * - 13.4: Send email notifications to the client, team members, and admins
   * - 13.5: Display specific error messages when submission fails
   * 
   * @param proposalId - The proposal ID to submit
   * @returns SubmitProposalResult with success status and details
   */
  static async submitProposal(proposalId: string): Promise<SubmitProposalResult> {
    try {
      const supabase = await createClient();

      // Get proposal details
      const { data: proposal, error: proposalError } = await supabase
        .from('proposals')
        .select(`
          id,
          project_id,
          lead_id,
          status,
          projects (
            id,
            title,
            client_id
          )
        `)
        .eq('id', proposalId)
        .single();

      if (proposalError || !proposal) {
        return {
          success: false,
          error: 'Proposal not found',
          errorCode: 'PROPOSAL_NOT_FOUND',
        };
      }

      // Check if proposal is already submitted
      if (proposal.status !== 'draft') {
        return {
          success: false,
          error: `Proposal cannot be submitted. Current status: ${proposal.status}`,
          errorCode: 'INVALID_STATUS',
        };
      }

      // Requirement 13.1: Run final compliance check
      const { ComplianceService } = await import('./compliance-service');
      const complianceCheck = await ComplianceService.runComplianceCheck(proposalId);

      if (!complianceCheck.passed) {
        return {
          success: false,
          error: 'Proposal failed compliance check. Please address all issues before submitting.',
          errorCode: 'COMPLIANCE_FAILED',
          complianceIssues: complianceCheck.issues,
          complianceReport: ComplianceService.generateComplianceReport(complianceCheck),
        };
      }

      // Requirements 13.2 & 13.3: Update status to submitted and record timestamp
      const submittedAt = new Date().toISOString();
      const { data: updatedProposal, error: updateError } = await supabase
        .from('proposals')
        .update({
          status: 'submitted',
          submitted_at: submittedAt,
          updated_at: submittedAt,
        })
        .eq('id', proposalId)
        .select('id, status, submitted_at')
        .single();

      if (updateError || !updatedProposal) {
        console.error('Error updating proposal status:', updateError);
        return {
          success: false,
          error: 'Failed to update proposal status',
          errorCode: 'UPDATE_FAILED',
        };
      }

      // Requirement 13.4: Send notifications to all stakeholders
      const project = proposal.projects as any;
      const notificationResults = await this.sendSubmissionNotifications(
        proposalId,
        proposal.lead_id,
        proposal.project_id,
        project.client_id,
        project.title
      );

      return {
        success: true,
        proposal: {
          id: updatedProposal.id,
          status: updatedProposal.status,
          submittedAt: updatedProposal.submitted_at,
        },
        notificationsSent: notificationResults.filter(r => r.success).length,
        notificationsFailed: notificationResults.filter(r => !r.success).length,
      };
    } catch (error) {
      console.error('Unexpected error in submitProposal:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred during submission',
        errorCode: 'UNKNOWN',
      };
    }
  }

  /**
   * Sends submission notifications to all stakeholders
   * 
   * Requirement 13.4: Notify client, team members, and admins
   * 
   * @private
   */
  private static async sendSubmissionNotifications(
    proposalId: string,
    leadId: string,
    projectId: string,
    clientId: string,
    projectTitle: string
  ): Promise<Array<{ success: boolean; recipient: string; error?: string }>> {
    const results: Array<{ success: boolean; recipient: string; error?: string }> = [];
    const { NotificationService } = await import('./notification-service');
    const supabase = await createClient();

    try {
      // Notify the client
      const clientNotification = await NotificationService.createNotification({
        userId: clientId,
        type: 'proposal_submitted',
        title: `New Proposal Submitted for ${projectTitle}`,
        body: `A bidding team has submitted a proposal for your project "${projectTitle}". Please review it at your earliest convenience.`,
        data: {
          proposalId,
          projectId,
          projectTitle,
          leadId,
        },
        sendEmail: true,
      });

      results.push({
        success: clientNotification.success,
        recipient: 'client',
        error: clientNotification.error,
      });

      // Notify all team members
      const { data: teamMembers } = await supabase
        .from('bid_team_members')
        .select('user_id')
        .eq('project_id', projectId)
        .neq('user_id', leadId); // Exclude lead (they know they submitted)

      if (teamMembers && teamMembers.length > 0) {
        for (const member of teamMembers) {
          const memberNotification = await NotificationService.createNotification({
            userId: member.user_id,
            type: 'proposal_submitted',
            title: `Proposal Submitted for ${projectTitle}`,
            body: `Your team's proposal for "${projectTitle}" has been successfully submitted. You will be notified of any updates.`,
            data: {
              proposalId,
              projectId,
              projectTitle,
              leadId,
            },
            sendEmail: true,
          });

          results.push({
            success: memberNotification.success,
            recipient: `team_member_${member.user_id}`,
            error: memberNotification.error,
          });
        }
      }

      // Requirement 10.2, 10.3, 10.5: Notify all admins (in-app only)
      const { data: admins } = await supabase
        .from('users')
        .select('id')
        .eq('role', 'admin');

      if (admins && admins.length > 0) {
        for (const admin of admins) {
          const adminNotification = await NotificationService.createNotification({
            userId: admin.id,
            type: 'proposal_submitted',
            title: `New Proposal Submitted: ${projectTitle}`,
            body: `A proposal has been submitted for project "${projectTitle}". Review required.`,
            data: {
              proposalId,
              projectId,
              projectTitle,
              leadId,
              clientId, // Requirement 10.3: Include relevant entity IDs
            },
            sendEmail: false, // Requirement 10.5: In-app only for admin proposal notifications
          });

          results.push({
            success: adminNotification.success,
            recipient: `admin_${admin.id}`,
            error: adminNotification.error,
          });
        }
      }

      // Notify the lead (confirmation)
      const leadNotification = await NotificationService.createNotification({
        userId: leadId,
        type: 'proposal_submitted',
        title: `Proposal Successfully Submitted: ${projectTitle}`,
        body: `Your proposal for "${projectTitle}" has been successfully submitted and is now under review. You will be notified of any status changes.`,
        data: {
          proposalId,
          projectId,
          projectTitle,
        },
        sendEmail: true,
      });

      results.push({
        success: leadNotification.success,
        recipient: 'lead',
        error: leadNotification.error,
      });

    } catch (error) {
      console.error('Error sending submission notifications:', error);
      results.push({
        success: false,
        recipient: 'unknown',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    return results;
  }
}
