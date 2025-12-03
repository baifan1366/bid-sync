/**
 * Retention Service
 * 
 * Handles data retention policy enforcement, archive deletion, and legal hold management.
 * 
 * Implements requirements 8.1, 8.2, 8.3, 8.4, 8.5 from the 
 * project-delivery-archival spec.
 */

import { createClient } from '@/lib/supabase/server';
import { LoggingService } from '@/lib/logging-service';

// Grace period for deletion: 30 days
const DELETION_GRACE_PERIOD_DAYS = 30;

export interface ArchiveForDeletion {
  id: string;
  projectId: string;
  archiveIdentifier: string;
  retentionUntil: Date;
  legalHold: boolean;
  legalHoldReason?: string;
}

export interface ApplyLegalHoldResult {
  success: boolean;
  archive?: {
    id: string;
    projectId: string;
    archiveIdentifier: string;
    legalHold: boolean;
    legalHoldReason: string;
  };
  error?: string;
  errorCode?: 
    | 'NOT_FOUND'
    | 'UNAUTHORIZED'
    | 'VALIDATION_ERROR'
    | 'DATABASE_ERROR'
    | 'UNKNOWN';
}

export interface RemoveLegalHoldResult {
  success: boolean;
  archive?: {
    id: string;
    projectId: string;
    archiveIdentifier: string;
    legalHold: boolean;
  };
  error?: string;
  errorCode?: 
    | 'NOT_FOUND'
    | 'UNAUTHORIZED'
    | 'DATABASE_ERROR'
    | 'UNKNOWN';
}

export interface MarkForDeletionResult {
  success: boolean;
  error?: string;
}

export interface DeleteArchiveResult {
  success: boolean;
  error?: string;
  errorCode?: 
    | 'NOT_FOUND'
    | 'LEGAL_HOLD_ACTIVE'
    | 'DATABASE_ERROR'
    | 'UNKNOWN';
}

export interface SendDeletionNotificationsResult {
  success: boolean;
  notificationsSent: number;
  error?: string;
}

/**
 * RetentionService class for managing data retention policies
 */
export class RetentionService {
  /**
   * Gets archives that have passed their retention period and should be marked for deletion
   * 
   * Requirement 8.1: Check retention period and mark archives for deletion
   * 
   * @returns Array of archives ready for deletion marking
   */
  static async getArchivesForDeletion(): Promise<ArchiveForDeletion[]> {
    try {
      const supabase = await createClient();

      const now = new Date().toISOString();

      // Get archives where retention_until has passed and not under legal hold
      const { data: archives, error } = await supabase
        .from('project_archives')
        .select('id, project_id, archive_identifier, retention_until, legal_hold, legal_hold_reason')
        .lt('retention_until', now)
        .eq('legal_hold', false)
        .is('marked_for_deletion_at', null); // Not already marked

      if (error) {
        console.error('Error fetching archives for deletion:', error);
        return [];
      }

      return (archives || []).map((a) => ({
        id: a.id,
        projectId: a.project_id,
        archiveIdentifier: a.archive_identifier,
        retentionUntil: new Date(a.retention_until),
        legalHold: a.legal_hold,
        legalHoldReason: a.legal_hold_reason,
      }));
    } catch (error) {
      console.error('Unexpected error in getArchivesForDeletion:', error);
      return [];
    }
  }

  /**
   * Marks an archive for deletion with a grace period
   * 
   * Requirement 8.1: Mark archives for deletion when retention period expires
   * 
   * @param archiveId - Archive ID to mark for deletion
   * @returns MarkForDeletionResult with success status
   */
  static async markForDeletion(archiveId: string): Promise<MarkForDeletionResult> {
    try {
      const supabase = await createClient();

      // Check if archive exists and is not under legal hold
      const { data: archive, error: fetchError } = await supabase
        .from('project_archives')
        .select('id, legal_hold, retention_until')
        .eq('id', archiveId)
        .single();

      if (fetchError || !archive) {
        console.error('Archive not found:', fetchError);
        return {
          success: false,
          error: 'Archive not found',
        };
      }

      // Requirement 8.5: Cannot mark for deletion if under legal hold
      if (archive.legal_hold) {
        return {
          success: false,
          error: 'Cannot mark archive for deletion while under legal hold',
        };
      }

      // Calculate deletion date (grace period from now)
      const deletionDate = new Date();
      deletionDate.setDate(deletionDate.getDate() + DELETION_GRACE_PERIOD_DAYS);

      // Mark for deletion
      const { error: updateError } = await supabase
        .from('project_archives')
        .update({
          marked_for_deletion_at: new Date().toISOString(),
          scheduled_deletion_at: deletionDate.toISOString(),
        })
        .eq('id', archiveId);

      if (updateError) {
        console.error('Error marking archive for deletion:', updateError);
        return {
          success: false,
          error: 'Failed to mark archive for deletion',
        };
      }

      // Log marking for deletion
      await LoggingService.logRetentionMarkDeletion(
        archiveId,
        '',
        '',
        deletionDate,
        true
      );

      return {
        success: true,
      };
    } catch (error) {
      console.error('Unexpected error in markForDeletion:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Sends deletion notifications to relevant stakeholders
   * 
   * Requirement 8.2: Send notifications when archive is marked for deletion
   * 
   * @param archiveId - Archive ID
   * @returns SendDeletionNotificationsResult with count of notifications sent
   */
  static async sendDeletionNotifications(
    archiveId: string
  ): Promise<SendDeletionNotificationsResult> {
    try {
      const supabase = await createClient();

      // Get archive and project details
      const { data: archive, error: archiveError } = await supabase
        .from('project_archives')
        .select('project_id, archive_identifier, scheduled_deletion_at')
        .eq('id', archiveId)
        .single();

      if (archiveError || !archive) {
        console.error('Archive not found:', archiveError);
        return {
          success: false,
          notificationsSent: 0,
          error: 'Archive not found',
        };
      }

      // Get project details
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('title, client_id')
        .eq('id', archive.project_id)
        .single();

      if (projectError || !project) {
        console.error('Project not found:', projectError);
        return {
          success: false,
          notificationsSent: 0,
          error: 'Project not found',
        };
      }

      // Get all team members
      const { data: teamMembers, error: teamError } = await supabase
        .from('bid_team_members')
        .select('user_id')
        .eq('project_id', archive.project_id);

      if (teamError) {
        console.error('Error fetching team members:', teamError);
      }

      // Collect all stakeholder IDs (client + team members)
      const stakeholderIds = new Set<string>();
      stakeholderIds.add(project.client_id);
      
      if (teamMembers) {
        teamMembers.forEach((member) => stakeholderIds.add(member.user_id));
      }

      // Create notifications for each stakeholder
      const deletionDate = archive.scheduled_deletion_at 
        ? new Date(archive.scheduled_deletion_at).toLocaleDateString()
        : 'soon';

      const notificationPromises = Array.from(stakeholderIds).map(async (userId) => {
        try {
          // Create in-app notification
          const { error: notifError } = await supabase
            .from('notifications')
            .insert({
              user_id: userId,
              type: 'archive_deletion_scheduled',
              title: 'Archive Scheduled for Deletion',
              message: `The archive for project "${project.title}" (${archive.archive_identifier}) is scheduled for deletion on ${deletionDate}. If you need to retain this data, please contact support to apply a legal hold.`,
              metadata: {
                projectId: archive.project_id,
                archiveId: archiveId,
                archiveIdentifier: archive.archive_identifier,
                scheduledDeletionAt: archive.scheduled_deletion_at,
              },
            });

          if (notifError) {
            console.error('Error creating notification:', notifError);
            return { success: false };
          }

          return { success: true };
        } catch (error) {
          console.error('Error sending notification to user:', userId, error);
          return { success: false };
        }
      });

      const results = await Promise.allSettled(notificationPromises);
      const successCount = results.filter(
        (r) => r.status === 'fulfilled' && r.value.success
      ).length;

      return {
        success: true,
        notificationsSent: successCount,
      };
    } catch (error) {
      console.error('Unexpected error in sendDeletionNotifications:', error);
      return {
        success: false,
        notificationsSent: 0,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Deletes an archive after grace period has expired
   * 
   * Requirement 8.3: Delete archive after grace period expires
   * Requirement 8.4: Log deletion event with timestamp and administrator identity
   * 
   * @param archiveId - Archive ID to delete
   * @param adminId - Administrator ID performing the deletion (optional, for manual deletions)
   * @returns DeleteArchiveResult with success status
   */
  static async deleteArchive(
    archiveId: string,
    adminId?: string
  ): Promise<DeleteArchiveResult> {
    try {
      const supabase = await createClient();

      // Get archive details
      const { data: archive, error: fetchError } = await supabase
        .from('project_archives')
        .select('id, project_id, archive_identifier, legal_hold, scheduled_deletion_at')
        .eq('id', archiveId)
        .single();

      if (fetchError || !archive) {
        return {
          success: false,
          error: 'Archive not found',
          errorCode: 'NOT_FOUND',
        };
      }

      // Requirement 8.5: Cannot delete if under legal hold
      if (archive.legal_hold) {
        return {
          success: false,
          error: 'Cannot delete archive while under legal hold',
          errorCode: 'LEGAL_HOLD_ACTIVE',
        };
      }

      // Verify grace period has passed (if scheduled)
      if (archive.scheduled_deletion_at) {
        const scheduledDate = new Date(archive.scheduled_deletion_at);
        const now = new Date();
        
        if (now < scheduledDate) {
          return {
            success: false,
            error: 'Grace period has not expired yet',
            errorCode: 'DATABASE_ERROR',
          };
        }
      }

      // Requirement 8.4: Log deletion event before deleting
      const deletionLogResult = await this.logArchiveDeletion(
        archiveId,
        archive.project_id,
        archive.archive_identifier,
        adminId || 'system'
      );

      if (!deletionLogResult.success) {
        console.error('Failed to log archive deletion');
        // Continue with deletion even if logging fails
      }

      // Delete the archive
      const { error: deleteError } = await supabase
        .from('project_archives')
        .delete()
        .eq('id', archiveId);

      if (deleteError) {
        console.error('Error deleting archive:', deleteError);
        
        await LoggingService.logArchiveDelete(
          adminId || 'system',
          archive.project_id,
          archiveId,
          archive.archive_identifier,
          'Retention policy',
          false
        );
        
        return {
          success: false,
          error: 'Failed to delete archive',
          errorCode: 'DATABASE_ERROR',
        };
      }

      // Log successful deletion
      await LoggingService.logArchiveDelete(
        adminId || 'system',
        archive.project_id,
        archiveId,
        archive.archive_identifier,
        'Retention policy',
        true
      );

      return {
        success: true,
      };
    } catch (error) {
      console.error('Unexpected error in deleteArchive:', error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        errorCode: 'UNKNOWN',
      };
    }
  }

  /**
   * Applies a legal hold to an archive to prevent deletion
   * 
   * Requirement 8.5: Apply legal hold to prevent deletion
   * 
   * @param archiveId - Archive ID
   * @param reason - Reason for legal hold
   * @param userId - User ID applying the hold (must be admin)
   * @returns ApplyLegalHoldResult with updated archive data
   */
  static async applyLegalHold(
    archiveId: string,
    reason: string,
    userId: string
  ): Promise<ApplyLegalHoldResult> {
    try {
      const supabase = await createClient();

      // Validate reason is provided
      if (!reason || reason.trim().length === 0) {
        return {
          success: false,
          error: 'Legal hold reason is required',
          errorCode: 'VALIDATION_ERROR',
        };
      }

      // Verify user is admin
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('role')
        .eq('id', userId)
        .single();

      if (userError || !user || user.role !== 'admin') {
        return {
          success: false,
          error: 'Only administrators can apply legal holds',
          errorCode: 'UNAUTHORIZED',
        };
      }

      // Get archive
      const { data: archive, error: fetchError } = await supabase
        .from('project_archives')
        .select('id, project_id, archive_identifier')
        .eq('id', archiveId)
        .single();

      if (fetchError || !archive) {
        return {
          success: false,
          error: 'Archive not found',
          errorCode: 'NOT_FOUND',
        };
      }

      // Apply legal hold
      const { data: updatedArchive, error: updateError } = await supabase
        .from('project_archives')
        .update({
          legal_hold: true,
          legal_hold_reason: reason.trim(),
          legal_hold_applied_by: userId,
          legal_hold_applied_at: new Date().toISOString(),
          // Clear deletion scheduling if it was marked
          marked_for_deletion_at: null,
          scheduled_deletion_at: null,
        })
        .eq('id', archiveId)
        .select('id, project_id, archive_identifier, legal_hold, legal_hold_reason')
        .single();

      if (updateError || !updatedArchive) {
        console.error('Error applying legal hold:', updateError);
        return {
          success: false,
          error: 'Failed to apply legal hold',
          errorCode: 'DATABASE_ERROR',
        };
      }

      // Log the legal hold application
      await this.logLegalHoldAction(
        archiveId,
        archive.project_id,
        'applied',
        reason.trim(),
        userId
      );

      // Log to operation logs
      await LoggingService.logLegalHoldApply(
        userId,
        archive.project_id,
        archiveId,
        archive.archive_identifier,
        reason.trim(),
        true
      );

      return {
        success: true,
        archive: {
          id: updatedArchive.id,
          projectId: updatedArchive.project_id,
          archiveIdentifier: updatedArchive.archive_identifier,
          legalHold: updatedArchive.legal_hold,
          legalHoldReason: updatedArchive.legal_hold_reason,
        },
      };
    } catch (error) {
      console.error('Unexpected error in applyLegalHold:', error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        errorCode: 'UNKNOWN',
      };
    }
  }

  /**
   * Removes a legal hold from an archive
   * 
   * Requirement 8.5: Remove legal hold to allow deletion
   * 
   * @param archiveId - Archive ID
   * @param userId - User ID removing the hold (must be admin)
   * @returns RemoveLegalHoldResult with updated archive data
   */
  static async removeLegalHold(
    archiveId: string,
    userId: string
  ): Promise<RemoveLegalHoldResult> {
    try {
      const supabase = await createClient();

      // Verify user is admin
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('role')
        .eq('id', userId)
        .single();

      if (userError || !user || user.role !== 'admin') {
        return {
          success: false,
          error: 'Only administrators can remove legal holds',
          errorCode: 'UNAUTHORIZED',
        };
      }

      // Get archive
      const { data: archive, error: fetchError } = await supabase
        .from('project_archives')
        .select('id, project_id, archive_identifier, legal_hold_reason')
        .eq('id', archiveId)
        .single();

      if (fetchError || !archive) {
        return {
          success: false,
          error: 'Archive not found',
          errorCode: 'NOT_FOUND',
        };
      }

      // Remove legal hold
      const { data: updatedArchive, error: updateError } = await supabase
        .from('project_archives')
        .update({
          legal_hold: false,
          legal_hold_reason: null,
          legal_hold_removed_by: userId,
          legal_hold_removed_at: new Date().toISOString(),
        })
        .eq('id', archiveId)
        .select('id, project_id, archive_identifier, legal_hold')
        .single();

      if (updateError || !updatedArchive) {
        console.error('Error removing legal hold:', updateError);
        return {
          success: false,
          error: 'Failed to remove legal hold',
          errorCode: 'DATABASE_ERROR',
        };
      }

      // Log the legal hold removal
      await this.logLegalHoldAction(
        archiveId,
        archive.project_id,
        'removed',
        archive.legal_hold_reason || '',
        userId
      );

      // Log to operation logs
      await LoggingService.logLegalHoldRemove(
        userId,
        archive.project_id,
        archiveId,
        archive.archive_identifier,
        true
      );

      return {
        success: true,
        archive: {
          id: updatedArchive.id,
          projectId: updatedArchive.project_id,
          archiveIdentifier: updatedArchive.archive_identifier,
          legalHold: updatedArchive.legal_hold,
        },
      };
    } catch (error) {
      console.error('Unexpected error in removeLegalHold:', error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        errorCode: 'UNKNOWN',
      };
    }
  }

  /**
   * Enforces retention policies by checking and marking archives for deletion
   * 
   * This method should be called by a scheduled job (e.g., daily cron)
   * 
   * Requirements:
   * - 8.1: Mark archives for deletion when retention period expires
   * - 8.2: Send deletion notifications
   * 
   * @returns Object with counts of archives processed and notifications sent
   */
  static async enforceRetentionPolicies(): Promise<{
    success: boolean;
    archivesMarked: number;
    notificationsSent: number;
    errors: string[];
  }> {
    const timer = LoggingService.startTimer();
    
    try {
      const errors: string[] = [];
      let archivesMarked = 0;
      let totalNotificationsSent = 0;

      // Get archives that need to be marked for deletion
      const archives = await this.getArchivesForDeletion();

      console.log(`Found ${archives.length} archives past retention period`);

      for (const archive of archives) {
        // Mark for deletion
        const markResult = await this.markForDeletion(archive.id);
        
        if (markResult.success) {
          archivesMarked++;

          // Send notifications
          const notifResult = await this.sendDeletionNotifications(archive.id);
          
          if (notifResult.success) {
            totalNotificationsSent += notifResult.notificationsSent;
          } else {
            errors.push(`Failed to send notifications for archive ${archive.archiveIdentifier}: ${notifResult.error}`);
          }
        } else {
          errors.push(`Failed to mark archive ${archive.archiveIdentifier} for deletion: ${markResult.error}`);
        }
      }

      // Log retention check
      const duration = timer();
      await LoggingService.logRetentionCheck(
        archives.length,
        archivesMarked,
        duration
      );

      return {
        success: true,
        archivesMarked,
        notificationsSent: totalNotificationsSent,
        errors,
      };
    } catch (error) {
      console.error('Unexpected error in enforceRetentionPolicies:', error);
      
      await LoggingService.logRetentionCheck(
        0,
        0,
        timer()
      );
      
      return {
        success: false,
        archivesMarked: 0,
        notificationsSent: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error occurred'],
      };
    }
  }

  /**
   * Executes scheduled deletions for archives past their grace period
   * 
   * This method should be called by a scheduled job (e.g., daily cron)
   * 
   * Requirement 8.3: Delete archives after grace period expires
   * 
   * @returns Object with count of archives deleted and errors
   */
  static async executeScheduledDeletions(): Promise<{
    success: boolean;
    archivesDeleted: number;
    errors: string[];
  }> {
    const timer = LoggingService.startTimer();
    
    try {
      const supabase = await createClient();
      const errors: string[] = [];
      let archivesDeleted = 0;

      const now = new Date().toISOString();

      // Get archives scheduled for deletion where grace period has passed
      const { data: archives, error } = await supabase
        .from('project_archives')
        .select('id, archive_identifier, legal_hold')
        .not('scheduled_deletion_at', 'is', null)
        .lt('scheduled_deletion_at', now)
        .eq('legal_hold', false);

      if (error) {
        console.error('Error fetching archives for deletion:', error);
        return {
          success: false,
          archivesDeleted: 0,
          errors: ['Failed to fetch archives for deletion'],
        };
      }

      console.log(`Found ${archives?.length || 0} archives ready for deletion`);

      if (!archives || archives.length === 0) {
        return {
          success: true,
          archivesDeleted: 0,
          errors: [],
        };
      }

      for (const archive of archives) {
        const deleteResult = await this.deleteArchive(archive.id, 'system');
        
        if (deleteResult.success) {
          archivesDeleted++;
          console.log(`Deleted archive ${archive.archive_identifier}`);
        } else {
          errors.push(`Failed to delete archive ${archive.archive_identifier}: ${deleteResult.error}`);
        }
      }

      // Log deletion execution
      const duration = timer();
      await LoggingService.logRetentionExecuteDeletion(
        archivesDeleted,
        errors,
        duration
      );

      return {
        success: true,
        archivesDeleted,
        errors,
      };
    } catch (error) {
      console.error('Unexpected error in executeScheduledDeletions:', error);
      
      await LoggingService.logRetentionExecuteDeletion(
        0,
        [error instanceof Error ? error.message : 'Unknown error occurred'],
        timer()
      );
      
      return {
        success: false,
        archivesDeleted: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error occurred'],
      };
    }
  }

  /**
   * Logs an archive deletion event
   * 
   * Requirement 8.4: Log deletion with timestamp and administrator identity
   * 
   * @private
   * @param archiveId - Archive ID
   * @param projectId - Project ID
   * @param archiveIdentifier - Archive identifier
   * @param deletedBy - User ID who performed the deletion
   * @returns Success status
   */
  private static async logArchiveDeletion(
    archiveId: string,
    projectId: string,
    archiveIdentifier: string,
    deletedBy: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const supabase = await createClient();

      const { error } = await supabase
        .from('archive_deletion_logs')
        .insert({
          archive_id: archiveId,
          project_id: projectId,
          archive_identifier: archiveIdentifier,
          deleted_by: deletedBy,
          deleted_at: new Date().toISOString(),
        });

      if (error) {
        console.error('Error logging archive deletion:', error);
        return {
          success: false,
          error: 'Failed to log deletion',
        };
      }

      return {
        success: true,
      };
    } catch (error) {
      console.error('Unexpected error in logArchiveDeletion:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Logs a legal hold action (applied or removed)
   * 
   * @private
   * @param archiveId - Archive ID
   * @param projectId - Project ID
   * @param action - Action type ('applied' or 'removed')
   * @param reason - Reason for the action
   * @param performedBy - User ID who performed the action
   * @returns Success status
   */
  private static async logLegalHoldAction(
    archiveId: string,
    projectId: string,
    action: 'applied' | 'removed',
    reason: string,
    performedBy: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const supabase = await createClient();

      const { error } = await supabase
        .from('legal_hold_logs')
        .insert({
          archive_id: archiveId,
          project_id: projectId,
          action,
          reason,
          performed_by: performedBy,
          performed_at: new Date().toISOString(),
        });

      if (error) {
        console.error('Error logging legal hold action:', error);
        return {
          success: false,
          error: 'Failed to log legal hold action',
        };
      }

      return {
        success: true,
      };
    } catch (error) {
      console.error('Unexpected error in logLegalHoldAction:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }
}
