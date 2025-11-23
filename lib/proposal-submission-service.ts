/**
 * Proposal Submission Service
 * 
 * Handles the complete proposal submission workflow including:
 * - Validation of submission data
 * - Database transactions for atomic operations
 * - Email notifications to stakeholders
 * - Activity logging for audit trail
 * - Draft saving for partial submissions
 */

import { createClient } from '@/lib/supabase/server';
import { logActivity } from '@/lib/activity-logger';
import {
  sendClientNotification,
  sendLeadConfirmation,
  sendAdminNotifications,
} from '@/lib/email';

/**
 * Input parameters for proposal submission
 */
export interface SubmitProposalParams {
  proposalId: string;
  projectId: string;
  userId: string;
  title: string;
  budgetEstimate: number;
  timelineEstimate: string;
  executiveSummary: string;
  additionalInfo: Array<{
    fieldId: string;
    fieldName: string;
    fieldValue: any;
  }>;
}

/**
 * Result of proposal submission
 */
export interface SubmissionResult {
  success: boolean;
  proposalId: string;
  submittedAt: string;
  errors?: string[];
}

/**
 * Parameters for saving a submission draft
 */
export interface SaveDraftParams {
  proposalId: string;
  userId: string;
  currentStep: number;
  draftData: Record<string, any>;
}

/**
 * Parameters for validation
 */
export interface ValidateParams {
  proposalId: string;
  projectId: string;
  title: string;
  budgetEstimate: number;
  timelineEstimate: string;
  executiveSummary: string;
  additionalInfo: Array<{
    fieldId: string;
    fieldName: string;
    fieldValue: any;
  }>;
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Proposal Submission Service
 * Manages the complete proposal submission workflow
 */
export class ProposalSubmissionService {
  /**
   * Validate submission data before processing
   */
  async validateSubmission(params: ValidateParams): Promise<ValidationResult> {
    const errors: string[] = [];

    // Validate title
    if (!params.title || params.title.trim().length === 0) {
      errors.push('Proposal title is required');
    } else if (params.title.length > 200) {
      errors.push('Proposal title must be 200 characters or less');
    }

    // Validate budget estimate
    if (params.budgetEstimate === null || params.budgetEstimate === undefined) {
      errors.push('Budget estimate is required');
    } else if (params.budgetEstimate <= 0) {
      errors.push('Budget estimate must be a positive number');
    }

    // Validate timeline estimate
    if (!params.timelineEstimate || params.timelineEstimate.trim().length === 0) {
      errors.push('Timeline estimate is required');
    }

    // Validate executive summary
    if (!params.executiveSummary || params.executiveSummary.trim().length === 0) {
      errors.push('Executive summary is required');
    } else if (params.executiveSummary.length > 5000) {
      errors.push('Executive summary must be 5000 characters or less');
    }

    // Validate proposal exists and is in draft status
    const supabase = await createClient();
    const { data: proposal, error: proposalError } = await supabase
      .from('proposals')
      .select('status, project_id')
      .eq('id', params.proposalId)
      .single();

    if (proposalError || !proposal) {
      errors.push('Proposal not found');
    } else {
      if (proposal.status !== 'draft') {
        errors.push('Only draft proposals can be submitted');
      }
      if (proposal.project_id !== params.projectId) {
        errors.push('Proposal does not belong to the specified project');
      }
    }

    // Validate project exists and get additional info requirements
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('additional_info_requirements')
      .eq('id', params.projectId)
      .single();

    if (projectError || !project) {
      errors.push('Project not found');
    } else {
      // Validate additional info against requirements
      const requirements = project.additional_info_requirements || [];
      
      for (const requirement of requirements) {
        if (requirement.required) {
          const providedInfo = params.additionalInfo.find(
            info => info.fieldId === requirement.id
          );

          if (!providedInfo || !providedInfo.fieldValue) {
            errors.push(`Required field "${requirement.fieldName}" is missing`);
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Process proposal submission with database transaction
   * Ensures atomic operation with rollback on failure
   */
  async processSubmission(params: SubmitProposalParams): Promise<SubmissionResult> {
    const supabase = await createClient();
    const submittedAt = new Date().toISOString();

    try {
      // Validate submission first
      const validation = await this.validateSubmission(params);
      if (!validation.valid) {
        return {
          success: false,
          proposalId: params.proposalId,
          submittedAt,
          errors: validation.errors,
        };
      }

      // Begin transaction by updating proposal
      const { error: updateError } = await supabase
        .from('proposals')
        .update({
          title: params.title,
          budget_estimate: params.budgetEstimate,
          timeline_estimate: params.timelineEstimate,
          executive_summary: params.executiveSummary,
          status: 'submitted',
          submitted_at: submittedAt,
        })
        .eq('id', params.proposalId)
        .eq('status', 'draft'); // Ensure it's still draft

      if (updateError) {
        throw new Error(`Failed to update proposal: ${updateError.message}`);
      }

      // Store additional info
      if (params.additionalInfo && params.additionalInfo.length > 0) {
        const additionalInfoRecords = params.additionalInfo.map(info => ({
          proposal_id: params.proposalId,
          field_id: info.fieldId,
          field_name: info.fieldName,
          field_value: info.fieldValue,
        }));

        const { error: additionalInfoError } = await supabase
          .from('proposal_additional_info')
          .insert(additionalInfoRecords);

        if (additionalInfoError) {
          // Rollback: revert proposal status
          await supabase
            .from('proposals')
            .update({ status: 'draft', submitted_at: null })
            .eq('id', params.proposalId);

          throw new Error(`Failed to store additional info: ${additionalInfoError.message}`);
        }
      }

      // Log activity for audit trail
      await logActivity({
        userId: params.userId,
        action: 'submit_proposal',
        resourceType: 'proposal',
        resourceId: params.proposalId,
        metadata: {
          projectId: params.projectId,
          title: params.title,
          budgetEstimate: params.budgetEstimate,
          timelineEstimate: params.timelineEstimate,
          submittedAt,
        },
      });

      // Send notifications (non-blocking - failures don't rollback submission)
      await this.sendNotifications({
        proposalId: params.proposalId,
        projectId: params.projectId,
        title: params.title,
        budgetEstimate: params.budgetEstimate,
        timelineEstimate: params.timelineEstimate,
        executiveSummary: params.executiveSummary,
        submittedAt,
      });

      return {
        success: true,
        proposalId: params.proposalId,
        submittedAt,
      };
    } catch (error) {
      // Rollback on any error
      try {
        await supabase
          .from('proposals')
          .update({ status: 'draft', submitted_at: null })
          .eq('id', params.proposalId);

        // Delete any additional info that was inserted
        await supabase
          .from('proposal_additional_info')
          .delete()
          .eq('proposal_id', params.proposalId);
      } catch (rollbackError) {
        console.error('Rollback failed:', rollbackError);
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('Proposal submission failed:', errorMessage);

      return {
        success: false,
        proposalId: params.proposalId,
        submittedAt,
        errors: [errorMessage],
      };
    }
  }

  /**
   * Send email notifications to all stakeholders
   * Failures are logged but don't block submission
   */
  async sendNotifications(params: {
    proposalId: string;
    projectId: string;
    title: string;
    budgetEstimate: number;
    timelineEstimate: string;
    executiveSummary: string;
    submittedAt: string;
  }): Promise<void> {
    try {
      // Send client notification
      const clientResult = await sendClientNotification({
        proposalId: params.proposalId,
        projectId: params.projectId,
        proposalTitle: params.title,
        submittedAt: params.submittedAt,
      });

      if (!clientResult.success) {
        console.error('Client notification failed:', clientResult.error);
        // Continue with other notifications
      }

      // Send lead confirmation
      const leadResult = await sendLeadConfirmation({
        proposalId: params.proposalId,
        projectId: params.projectId,
        proposalTitle: params.title,
        submittedAt: params.submittedAt,
        executiveSummary: params.executiveSummary,
        budgetEstimate: params.budgetEstimate,
        timelineEstimate: params.timelineEstimate,
      });

      if (!leadResult.success) {
        console.error('Lead confirmation failed:', leadResult.error);
        // Continue with other notifications
      }

      // Send admin notifications
      const adminResult = await sendAdminNotifications({
        proposalId: params.proposalId,
        projectId: params.projectId,
        proposalTitle: params.title,
        submittedAt: params.submittedAt,
      });

      if (!adminResult.success) {
        console.error('Admin notifications failed:', adminResult.errors);
      } else {
        console.log(`Admin notifications: ${adminResult.sentCount} sent, ${adminResult.failedCount} failed`);
      }
    } catch (error) {
      console.error('Error in sendNotifications:', error);
      // Don't throw - notification failures shouldn't block submission
    }
  }

  /**
   * Save a partial submission as a draft
   * Allows users to resume submission later
   */
  async saveSubmissionDraft(params: SaveDraftParams): Promise<boolean> {
    const supabase = await createClient();

    try {
      const { error } = await supabase
        .from('submission_drafts')
        .upsert({
          proposal_id: params.proposalId,
          user_id: params.userId,
          current_step: params.currentStep,
          draft_data: params.draftData,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'proposal_id,user_id',
        });

      if (error) {
        console.error('Failed to save submission draft:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error saving submission draft:', error);
      return false;
    }
  }
}
