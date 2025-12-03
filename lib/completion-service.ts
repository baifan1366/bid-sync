/**
 * Completion Service
 * 
 * Handles project completion workflow including marking ready for delivery,
 * client review, acceptance, and revision requests.
 * 
 * Implements requirements 2.1, 2.3, 3.5, 4.1, 5.1, 5.2 from the 
 * project-delivery-archival spec.
 */

import { createClient } from '@/lib/supabase/server';
import {
  sendClientReadyForDeliveryNotification,
  sendTeamCompletionNotifications,
  sendLeadRevisionRequestNotification,
} from '@/lib/email/completion-notifications';
import { ArchiveService } from '@/lib/archive-service';
import { LoggingService } from '@/lib/logging-service';

export type ReviewStatus = 'pending' | 'accepted' | 'revision_requested';

export interface ProjectCompletion {
  id: string;
  projectId: string;
  proposalId: string;
  submittedBy: string;
  submittedAt: Date;
  reviewedBy?: string;
  reviewedAt?: Date;
  reviewStatus: ReviewStatus;
  reviewComments?: string;
  revisionCount: number;
  completedAt?: Date;
}

export interface CompletionRevision {
  id: string;
  completionId: string;
  revisionNumber: number;
  requestedBy: string;
  requestedAt: Date;
  revisionNotes: string;
  resolvedBy?: string;
  resolvedAt?: Date;
}

export interface MarkReadyForDeliveryInput {
  projectId: string;
  proposalId: string;
}

export interface ReviewCompletionInput {
  completionId: string;
  reviewStatus: ReviewStatus;
  reviewComments?: string;
}

export interface RequestRevisionInput {
  completionId: string;
  revisionNotes: string;
}

export interface CompletionResult {
  success: boolean;
  completion?: ProjectCompletion;
  error?: string;
  errorCode?: 
    | 'NO_DELIVERABLES'
    | 'INVALID_STATUS'
    | 'UNAUTHORIZED'
    | 'NOT_FOUND'
    | 'VALIDATION_ERROR'
    | 'DATABASE_ERROR'
    | 'UNKNOWN';
}

export interface RevisionResult {
  success: boolean;
  revision?: CompletionRevision;
  error?: string;
  errorCode?: 
    | 'NOT_FOUND'
    | 'UNAUTHORIZED'
    | 'INVALID_STATUS'
    | 'VALIDATION_ERROR'
    | 'DATABASE_ERROR'
    | 'UNKNOWN';
}

/**
 * CompletionService class for managing project completion workflow
 */
export class CompletionService {
  /**
   * Marks a project as ready for delivery
   * 
   * Requirements:
   * - 2.1: Change project status to "pending_completion"
   * - 2.3: Validate deliverables exist before marking ready
   * 
   * @param input - Mark ready for delivery input
   * @param userId - Current user ID (must be bidding lead)
   * @returns CompletionResult with completion record or error
   */
  static async markReadyForDelivery(
    input: MarkReadyForDeliveryInput,
    userId: string
  ): Promise<CompletionResult> {
    const timer = LoggingService.startTimer();
    
    try {
      const supabase = await createClient();

      // Verify user is the bidding lead for this proposal
      const { data: proposal, error: proposalError } = await supabase
        .from('proposals')
        .select('lead_id, project_id')
        .eq('id', input.proposalId)
        .eq('project_id', input.projectId)
        .single();

      if (proposalError || !proposal) {
        return {
          success: false,
          error: 'Proposal not found',
          errorCode: 'NOT_FOUND',
        };
      }

      if (proposal.lead_id !== userId) {
        return {
          success: false,
          error: 'Only the bidding lead can mark the project ready for delivery',
          errorCode: 'UNAUTHORIZED',
        };
      }

      // Check project status - must be 'awarded'
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('status, client_id')
        .eq('id', input.projectId)
        .single();

      if (projectError || !project) {
        return {
          success: false,
          error: 'Project not found',
          errorCode: 'NOT_FOUND',
        };
      }

      if (project.status !== 'awarded') {
        return {
          success: false,
          error: `Cannot mark ready for delivery. Project status is ${project.status}`,
          errorCode: 'INVALID_STATUS',
        };
      }

      // Requirement 2.3: Validate deliverables exist
      const { data: deliverables, error: deliverablesError } = await supabase
        .from('project_deliverables')
        .select('id')
        .eq('project_id', input.projectId)
        .limit(1);

      if (deliverablesError) {
        console.error('Error checking deliverables:', deliverablesError);
        return {
          success: false,
          error: 'Failed to validate deliverables',
          errorCode: 'DATABASE_ERROR',
        };
      }

      if (!deliverables || deliverables.length === 0) {
        await LoggingService.logValidationError(
          'markReadyForDelivery',
          userId,
          input.projectId,
          ['No deliverables uploaded']
        );
        
        return {
          success: false,
          error: 'Cannot mark ready for delivery without uploading deliverables',
          errorCode: 'NO_DELIVERABLES',
        };
      }

      // Create completion record
      const { data: completion, error: completionError } = await supabase
        .from('project_completions')
        .insert({
          project_id: input.projectId,
          proposal_id: input.proposalId,
          submitted_by: userId,
          submitted_at: new Date().toISOString(),
          review_status: 'pending',
          revision_count: 0,
        })
        .select('*')
        .single();

      if (completionError || !completion) {
        console.error('Error creating completion record:', completionError);
        return {
          success: false,
          error: 'Failed to create completion record',
          errorCode: 'DATABASE_ERROR',
        };
      }

      // Requirement 2.1: Update project status to pending_completion
      const { error: statusError } = await supabase
        .from('projects')
        .update({ status: 'pending_completion' })
        .eq('id', input.projectId);

      if (statusError) {
        console.error('Error updating project status:', statusError);
        // Rollback completion record
        await supabase
          .from('project_completions')
          .delete()
          .eq('id', completion.id);

        return {
          success: false,
          error: 'Failed to update project status',
          errorCode: 'DATABASE_ERROR',
        };
      }

      // Requirement 2.2: Send notification to client (non-blocking)
      this.sendClientReadyNotification(
        project.client_id,
        input.projectId,
        deliverables.length
      ).catch((error) => {
        console.error('Error sending completion notification:', error);
      });

      // Log successful operation
      const duration = timer();
      await LoggingService.logReadyForDelivery(
        userId,
        input.projectId,
        input.proposalId,
        deliverables.length,
        true
      );
      
      await LoggingService.logStatusTransition(
        userId,
        input.projectId,
        'awarded',
        'pending_completion',
        'Marked ready for delivery'
      );

      return {
        success: true,
        completion: {
          id: completion.id,
          projectId: completion.project_id,
          proposalId: completion.proposal_id,
          submittedBy: completion.submitted_by,
          submittedAt: new Date(completion.submitted_at),
          reviewedBy: completion.reviewed_by,
          reviewedAt: completion.reviewed_at ? new Date(completion.reviewed_at) : undefined,
          reviewStatus: completion.review_status as ReviewStatus,
          reviewComments: completion.review_comments,
          revisionCount: completion.revision_count,
          completedAt: completion.completed_at ? new Date(completion.completed_at) : undefined,
        },
      };
    } catch (error) {
      console.error('Unexpected error in markReadyForDelivery:', error);
      
      await LoggingService.logReadyForDelivery(
        userId,
        input.projectId,
        input.proposalId,
        0,
        false
      );
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        errorCode: 'UNKNOWN',
      };
    }
  }

  /**
   * Reviews a project completion (client action)
   * 
   * Requirement 3.5: Store review comments
   * 
   * @param input - Review completion input
   * @param userId - Current user ID (must be client)
   * @returns CompletionResult with updated completion record or error
   */
  static async reviewCompletion(
    input: ReviewCompletionInput,
    userId: string
  ): Promise<CompletionResult> {
    try {
      const supabase = await createClient();

      // Get completion record
      const { data: completion, error: completionError } = await supabase
        .from('project_completions')
        .select('*, projects!inner(client_id, status)')
        .eq('id', input.completionId)
        .single();

      if (completionError || !completion) {
        return {
          success: false,
          error: 'Completion record not found',
          errorCode: 'NOT_FOUND',
        };
      }

      // Verify user is the client
      const clientId = (completion.projects as any).client_id;
      if (clientId !== userId) {
        return {
          success: false,
          error: 'Only the project client can review completion',
          errorCode: 'UNAUTHORIZED',
        };
      }

      // Verify project is in pending_completion status
      const projectStatus = (completion.projects as any).status;
      if (projectStatus !== 'pending_completion') {
        return {
          success: false,
          error: `Cannot review completion. Project status is ${projectStatus}`,
          errorCode: 'INVALID_STATUS',
        };
      }

      // Update completion record with review
      const { data: updatedCompletion, error: updateError } = await supabase
        .from('project_completions')
        .update({
          reviewed_by: userId,
          reviewed_at: new Date().toISOString(),
          review_status: input.reviewStatus,
          review_comments: input.reviewComments || null,
        })
        .eq('id', input.completionId)
        .select('*')
        .single();

      if (updateError || !updatedCompletion) {
        console.error('Error updating completion record:', updateError);
        return {
          success: false,
          error: 'Failed to update completion record',
          errorCode: 'DATABASE_ERROR',
        };
      }

      return {
        success: true,
        completion: {
          id: updatedCompletion.id,
          projectId: updatedCompletion.project_id,
          proposalId: updatedCompletion.proposal_id,
          submittedBy: updatedCompletion.submitted_by,
          submittedAt: new Date(updatedCompletion.submitted_at),
          reviewedBy: updatedCompletion.reviewed_by,
          reviewedAt: updatedCompletion.reviewed_at ? new Date(updatedCompletion.reviewed_at) : undefined,
          reviewStatus: updatedCompletion.review_status as ReviewStatus,
          reviewComments: updatedCompletion.review_comments,
          revisionCount: updatedCompletion.revision_count,
          completedAt: updatedCompletion.completed_at ? new Date(updatedCompletion.completed_at) : undefined,
        },
      };
    } catch (error) {
      console.error('Unexpected error in reviewCompletion:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        errorCode: 'UNKNOWN',
      };
    }
  }

  /**
   * Accepts project completion (client action)
   * 
   * Requirement 4.1: Change project status to "completed"
   * 
   * @param completionId - Completion record ID
   * @param userId - Current user ID (must be client)
   * @returns CompletionResult with updated completion record or error
   */
  static async acceptCompletion(
    completionId: string,
    userId: string
  ): Promise<CompletionResult> {
    const timer = LoggingService.startTimer();
    
    try {
      const supabase = await createClient();

      // Get completion record
      const { data: completion, error: completionError } = await supabase
        .from('project_completions')
        .select('*, projects!inner(client_id, status)')
        .eq('id', completionId)
        .single();

      if (completionError || !completion) {
        return {
          success: false,
          error: 'Completion record not found',
          errorCode: 'NOT_FOUND',
        };
      }

      // Verify user is the client
      const clientId = (completion.projects as any).client_id;
      if (clientId !== userId) {
        return {
          success: false,
          error: 'Only the project client can accept completion',
          errorCode: 'UNAUTHORIZED',
        };
      }

      // Verify project is in pending_completion status
      const projectStatus = (completion.projects as any).status;
      if (projectStatus !== 'pending_completion') {
        return {
          success: false,
          error: `Cannot accept completion. Project status is ${projectStatus}`,
          errorCode: 'INVALID_STATUS',
        };
      }

      const completedAt = new Date().toISOString();

      // Update completion record
      const { data: updatedCompletion, error: updateError } = await supabase
        .from('project_completions')
        .update({
          reviewed_by: userId,
          reviewed_at: completedAt,
          review_status: 'accepted',
          completed_at: completedAt,
        })
        .eq('id', completionId)
        .select('*')
        .single();

      if (updateError || !updatedCompletion) {
        console.error('Error updating completion record:', updateError);
        return {
          success: false,
          error: 'Failed to update completion record',
          errorCode: 'DATABASE_ERROR',
        };
      }

      // Requirement 4.1: Update project status to completed
      const { error: statusError } = await supabase
        .from('projects')
        .update({ status: 'completed' })
        .eq('id', completion.project_id);

      if (statusError) {
        console.error('Error updating project status:', statusError);
        // Rollback completion update
        await supabase
          .from('project_completions')
          .update({
            reviewed_by: null,
            reviewed_at: null,
            review_status: 'pending',
            completed_at: null,
          })
          .eq('id', completionId);

        return {
          success: false,
          error: 'Failed to update project status',
          errorCode: 'DATABASE_ERROR',
        };
      }

      // Requirement 4.3: Send notifications to all team members (non-blocking)
      this.sendTeamCompletionNotificationsHelper(completion.project_id, completion.proposal_id)
        .catch((error) => {
          console.error('Error sending team notifications:', error);
        });

      // Requirement 4.5: Initiate archival process (non-blocking)
      ArchiveService.createArchive(completion.project_id, userId)
        .catch((error) => {
          console.error('Error creating archive:', error);
        });

      // Log successful operation
      const duration = timer();
      await LoggingService.logCompletionAccept(
        userId,
        completion.project_id,
        completionId,
        true
      );
      
      await LoggingService.logStatusTransition(
        userId,
        completion.project_id,
        'pending_completion',
        'completed',
        'Completion accepted'
      );

      return {
        success: true,
        completion: {
          id: updatedCompletion.id,
          projectId: updatedCompletion.project_id,
          proposalId: updatedCompletion.proposal_id,
          submittedBy: updatedCompletion.submitted_by,
          submittedAt: new Date(updatedCompletion.submitted_at),
          reviewedBy: updatedCompletion.reviewed_by,
          reviewedAt: updatedCompletion.reviewed_at ? new Date(updatedCompletion.reviewed_at) : undefined,
          reviewStatus: updatedCompletion.review_status as ReviewStatus,
          reviewComments: updatedCompletion.review_comments,
          revisionCount: updatedCompletion.revision_count,
          completedAt: updatedCompletion.completed_at ? new Date(updatedCompletion.completed_at) : undefined,
        },
      };
    } catch (error) {
      console.error('Unexpected error in acceptCompletion:', error);
      
      await LoggingService.logCompletionAccept(
        userId,
        '',
        completionId,
        false
      );
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        errorCode: 'UNKNOWN',
      };
    }
  }

  /**
   * Requests revisions to deliverables (client action)
   * 
   * Requirements:
   * - 5.1: Change project status back to "awarded"
   * - 5.2: Require revision notes
   * 
   * @param input - Request revision input
   * @param userId - Current user ID (must be client)
   * @returns RevisionResult with revision record or error
   */
  static async requestRevision(
    input: RequestRevisionInput,
    userId: string
  ): Promise<RevisionResult> {
    const timer = LoggingService.startTimer();
    
    try {
      const supabase = await createClient();

      // Requirement 5.2: Validate revision notes are provided
      if (!input.revisionNotes || input.revisionNotes.trim().length === 0) {
        await LoggingService.logValidationError(
          'requestRevision',
          userId,
          undefined,
          ['Revision notes are required']
        );
        
        return {
          success: false,
          error: 'Revision notes are required',
          errorCode: 'VALIDATION_ERROR',
        };
      }

      // Get completion record
      const { data: completion, error: completionError } = await supabase
        .from('project_completions')
        .select('*, projects!inner(client_id, status)')
        .eq('id', input.completionId)
        .single();

      if (completionError || !completion) {
        return {
          success: false,
          error: 'Completion record not found',
          errorCode: 'NOT_FOUND',
        };
      }

      // Verify user is the client
      const clientId = (completion.projects as any).client_id;
      if (clientId !== userId) {
        return {
          success: false,
          error: 'Only the project client can request revisions',
          errorCode: 'UNAUTHORIZED',
        };
      }

      // Verify project is in pending_completion status
      const projectStatus = (completion.projects as any).status;
      if (projectStatus !== 'pending_completion') {
        return {
          success: false,
          error: `Cannot request revisions. Project status is ${projectStatus}`,
          errorCode: 'INVALID_STATUS',
        };
      }

      const revisionNumber = completion.revision_count + 1;

      // Create revision record
      const { data: revision, error: revisionError } = await supabase
        .from('completion_revisions')
        .insert({
          completion_id: input.completionId,
          revision_number: revisionNumber,
          requested_by: userId,
          requested_at: new Date().toISOString(),
          revision_notes: input.revisionNotes.trim(),
        })
        .select('*')
        .single();

      if (revisionError || !revision) {
        console.error('Error creating revision record:', revisionError);
        return {
          success: false,
          error: 'Failed to create revision record',
          errorCode: 'DATABASE_ERROR',
        };
      }

      // Update completion record
      const { error: updateError } = await supabase
        .from('project_completions')
        .update({
          review_status: 'revision_requested',
          review_comments: input.revisionNotes.trim(),
          reviewed_by: userId,
          reviewed_at: new Date().toISOString(),
          revision_count: revisionNumber,
        })
        .eq('id', input.completionId);

      if (updateError) {
        console.error('Error updating completion record:', updateError);
        // Rollback revision record
        await supabase
          .from('completion_revisions')
          .delete()
          .eq('id', revision.id);

        return {
          success: false,
          error: 'Failed to update completion record',
          errorCode: 'DATABASE_ERROR',
        };
      }

      // Requirement 5.1: Update project status back to awarded
      const { error: statusError } = await supabase
        .from('projects')
        .update({ status: 'awarded' })
        .eq('id', completion.project_id);

      if (statusError) {
        console.error('Error updating project status:', statusError);
        // Rollback changes
        await supabase
          .from('completion_revisions')
          .delete()
          .eq('id', revision.id);
        await supabase
          .from('project_completions')
          .update({
            review_status: 'pending',
            review_comments: null,
            reviewed_by: null,
            reviewed_at: null,
            revision_count: completion.revision_count,
          })
          .eq('id', input.completionId);

        return {
          success: false,
          error: 'Failed to update project status',
          errorCode: 'DATABASE_ERROR',
        };
      }

      // Requirement 5.3: Send notification to bidding lead (non-blocking)
      this.sendLeadRevisionNotification(
        completion.submitted_by,
        completion.project_id,
        input.revisionNotes.trim()
      ).catch((error) => {
        console.error('Error sending revision notification:', error);
      });

      // Log successful operation
      const duration = timer();
      await LoggingService.logRevisionRequest(
        userId,
        completion.project_id,
        input.completionId,
        revisionNumber,
        true,
        true
      );
      
      await LoggingService.logStatusTransition(
        userId,
        completion.project_id,
        'pending_completion',
        'awarded',
        `Revision #${revisionNumber} requested`
      );

      return {
        success: true,
        revision: {
          id: revision.id,
          completionId: revision.completion_id,
          revisionNumber: revision.revision_number,
          requestedBy: revision.requested_by,
          requestedAt: new Date(revision.requested_at),
          revisionNotes: revision.revision_notes,
          resolvedBy: revision.resolved_by,
          resolvedAt: revision.resolved_at ? new Date(revision.resolved_at) : undefined,
        },
      };
    } catch (error) {
      console.error('Unexpected error in requestRevision:', error);
      
      await LoggingService.logRevisionRequest(
        userId,
        '',
        input.completionId,
        0,
        false,
        false
      );
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        errorCode: 'UNKNOWN',
      };
    }
  }

  /**
   * Gets completion record for a project
   * 
   * @param projectId - Project ID
   * @returns ProjectCompletion or null
   */
  static async getCompletion(projectId: string): Promise<ProjectCompletion | null> {
    try {
      const supabase = await createClient();

      const { data: completion, error } = await supabase
        .from('project_completions')
        .select('*')
        .eq('project_id', projectId)
        .maybeSingle();

      if (error || !completion) {
        return null;
      }

      return {
        id: completion.id,
        projectId: completion.project_id,
        proposalId: completion.proposal_id,
        submittedBy: completion.submitted_by,
        submittedAt: new Date(completion.submitted_at),
        reviewedBy: completion.reviewed_by,
        reviewedAt: completion.reviewed_at ? new Date(completion.reviewed_at) : undefined,
        reviewStatus: completion.review_status as ReviewStatus,
        reviewComments: completion.review_comments,
        revisionCount: completion.revision_count,
        completedAt: completion.completed_at ? new Date(completion.completed_at) : undefined,
      };
    } catch (error) {
      console.error('Unexpected error in getCompletion:', error);
      return null;
    }
  }

  /**
   * Validates if a project is ready for delivery
   * 
   * @param projectId - Project ID
   * @returns true if ready, false otherwise
   */
  static async validateReadyForDelivery(projectId: string): Promise<boolean> {
    try {
      const supabase = await createClient();

      // Check project status
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('status')
        .eq('id', projectId)
        .single();

      if (projectError || !project || project.status !== 'awarded') {
        return false;
      }

      // Check deliverables exist
      const { data: deliverables, error: deliverablesError } = await supabase
        .from('project_deliverables')
        .select('id')
        .eq('project_id', projectId)
        .limit(1);

      if (deliverablesError || !deliverables || deliverables.length === 0) {
        return false;
      }

      return true;
    } catch (error) {
      console.error('Unexpected error in validateReadyForDelivery:', error);
      return false;
    }
  }

  /**
   * Gets all revisions for a completion
   * 
   * @param completionId - Completion ID
   * @returns Array of CompletionRevision
   */
  static async getRevisions(completionId: string): Promise<CompletionRevision[]> {
    try {
      const supabase = await createClient();

      const { data: revisions, error } = await supabase
        .from('completion_revisions')
        .select('*')
        .eq('completion_id', completionId)
        .order('revision_number', { ascending: true });

      if (error || !revisions) {
        return [];
      }

      return revisions.map((r) => ({
        id: r.id,
        completionId: r.completion_id,
        revisionNumber: r.revision_number,
        requestedBy: r.requested_by,
        requestedAt: new Date(r.requested_at),
        revisionNotes: r.revision_notes,
        resolvedBy: r.resolved_by,
        resolvedAt: r.resolved_at ? new Date(r.resolved_at) : undefined,
      }));
    } catch (error) {
      console.error('Unexpected error in getRevisions:', error);
      return [];
    }
  }

  /**
   * Sends ready for delivery notification to client
   * 
   * Requirement 2.2: Notify client when project status changes to "pending_completion"
   * 
   * @private
   * @param clientId - Client user ID
   * @param projectId - Project ID
   * @param deliverableCount - Number of deliverables
   */
  private static async sendClientReadyNotification(
    clientId: string,
    projectId: string,
    deliverableCount: number
  ): Promise<void> {
    try {
      const supabase = await createClient();

      // Get project and team details
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('title, proposals!inner(lead_id, users!inner(full_name))')
        .eq('id', projectId)
        .single();

      if (projectError || !project) {
        console.error('Error fetching project details:', projectError);
        return;
      }

      const proposals = project.proposals as any[];
      const teamName = proposals[0]?.users?.full_name || 'The Bidding Team';

      await sendClientReadyForDeliveryNotification({
        clientId,
        projectId,
        projectTitle: project.title,
        teamName,
        deliverableCount,
      });
    } catch (error) {
      console.error('Error in sendClientReadyNotification:', error);
    }
  }

  /**
   * Sends completion notifications to all team members
   * 
   * Requirement 4.3: Notify all bidding team members when project is marked completed
   * 
   * @private
   * @param projectId - Project ID
   * @param proposalId - Proposal ID
   */
  private static async sendTeamCompletionNotificationsHelper(
    projectId: string,
    proposalId: string
  ): Promise<void> {
    try {
      const supabase = await createClient();

      // Get project and client details
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('title, client_id, users!inner(full_name)')
        .eq('id', projectId)
        .single();

      if (projectError || !project) {
        console.error('Error fetching project details:', projectError);
        return;
      }

      const clientName = (project.users as any)?.full_name || 'The Client';

      await sendTeamCompletionNotifications({
        projectId,
        proposalId,
        projectTitle: project.title,
        clientName,
      });
    } catch (error) {
      console.error('Error in sendTeamCompletionNotificationsHelper:', error);
    }
  }

  /**
   * Sends revision request notification to bidding lead
   * 
   * Requirement 5.3: Notify bidding lead with revision notes when revisions are requested
   * 
   * @private
   * @param leadId - Lead user ID
   * @param projectId - Project ID
   * @param revisionNotes - Revision notes from client
   */
  private static async sendLeadRevisionNotification(
    leadId: string,
    projectId: string,
    revisionNotes: string
  ): Promise<void> {
    try {
      const supabase = await createClient();

      // Get project and client details
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('title, client_id, users!inner(full_name)')
        .eq('id', projectId)
        .single();

      if (projectError || !project) {
        console.error('Error fetching project details:', projectError);
        return;
      }

      const clientName = (project.users as any)?.full_name || 'The Client';

      await sendLeadRevisionRequestNotification({
        leadId,
        projectId,
        projectTitle: project.title,
        clientName,
        revisionNotes,
      });
    } catch (error) {
      console.error('Error in sendLeadRevisionNotification:', error);
    }
  }
}
