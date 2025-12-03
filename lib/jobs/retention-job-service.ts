/**
 * Retention Job Service
 * 
 * Wrapper service for retention operations that need to run in background jobs.
 * Uses service role client instead of user session client.
 */

import { createServiceRoleClient } from '../supabase/service-role';

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

/**
 * RetentionJobService class for background job operations
 */
export class RetentionJobService {
  /**
   * Gets archives that have passed their retention period
   */
  static async getArchivesForDeletion(): Promise<ArchiveForDeletion[]> {
    try {
      const supabase = createServiceRoleClient();
      const now = new Date().toISOString();

      const { data: archives, error } = await supabase
        .from('project_archives')
        .select('id, project_id, archive_identifier, retention_until, legal_hold, legal_hold_reason')
        .lt('retention_until', now)
        .eq('legal_hold', false)
        .is('marked_for_deletion_at', null);

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
   * Marks an archive for deletion
   */
  static async markForDeletion(archiveId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const supabase = createServiceRoleClient();

      const { data: archive, error: fetchError } = await supabase
        .from('project_archives')
        .select('id, legal_hold, retention_until')
        .eq('id', archiveId)
        .single();

      if (fetchError || !archive) {
        return { success: false, error: 'Archive not found' };
      }

      if (archive.legal_hold) {
        return { success: false, error: 'Cannot mark archive for deletion while under legal hold' };
      }

      const deletionDate = new Date();
      deletionDate.setDate(deletionDate.getDate() + DELETION_GRACE_PERIOD_DAYS);

      const { error: updateError } = await supabase
        .from('project_archives')
        .update({
          marked_for_deletion_at: new Date().toISOString(),
          scheduled_deletion_at: deletionDate.toISOString(),
        })
        .eq('id', archiveId);

      if (updateError) {
        console.error('Error marking archive for deletion:', updateError);
        return { success: false, error: 'Failed to mark archive for deletion' };
      }

      return { success: true };
    } catch (error) {
      console.error('Unexpected error in markForDeletion:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Sends deletion notifications
   */
  static async sendDeletionNotifications(archiveId: string): Promise<{
    success: boolean;
    notificationsSent: number;
    error?: string;
  }> {
    try {
      const supabase = createServiceRoleClient();

      const { data: archive, error: archiveError } = await supabase
        .from('project_archives')
        .select('project_id, archive_identifier, scheduled_deletion_at')
        .eq('id', archiveId)
        .single();

      if (archiveError || !archive) {
        return { success: false, notificationsSent: 0, error: 'Archive not found' };
      }

      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('title, client_id')
        .eq('id', archive.project_id)
        .single();

      if (projectError || !project) {
        return { success: false, notificationsSent: 0, error: 'Project not found' };
      }

      const { data: teamMembers } = await supabase
        .from('bid_team_members')
        .select('user_id')
        .eq('project_id', archive.project_id);

      const stakeholderIds = new Set<string>();
      stakeholderIds.add(project.client_id);
      
      if (teamMembers) {
        teamMembers.forEach((member) => stakeholderIds.add(member.user_id));
      }

      const deletionDate = archive.scheduled_deletion_at 
        ? new Date(archive.scheduled_deletion_at).toLocaleDateString()
        : 'soon';

      const notificationPromises = Array.from(stakeholderIds).map(async (userId) => {
        try {
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

          return { success: !notifError };
        } catch (error) {
          console.error('Error sending notification:', error);
          return { success: false };
        }
      });

      const results = await Promise.allSettled(notificationPromises);
      const successCount = results.filter(
        (r) => r.status === 'fulfilled' && r.value.success
      ).length;

      return { success: true, notificationsSent: successCount };
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
   * Deletes an archive
   */
  static async deleteArchive(archiveId: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      const supabase = createServiceRoleClient();

      const { data: archive, error: fetchError } = await supabase
        .from('project_archives')
        .select('id, project_id, archive_identifier, legal_hold, scheduled_deletion_at')
        .eq('id', archiveId)
        .single();

      if (fetchError || !archive) {
        return { success: false, error: 'Archive not found' };
      }

      if (archive.legal_hold) {
        return { success: false, error: 'Cannot delete archive while under legal hold' };
      }

      if (archive.scheduled_deletion_at) {
        const scheduledDate = new Date(archive.scheduled_deletion_at);
        const now = new Date();
        
        if (now < scheduledDate) {
          return { success: false, error: 'Grace period has not expired yet' };
        }
      }

      // Log deletion
      await supabase.from('archive_deletion_logs').insert({
        archive_id: archiveId,
        project_id: archive.project_id,
        archive_identifier: archive.archive_identifier,
        deleted_by: 'system',
        deleted_at: new Date().toISOString(),
      });

      // Delete archive
      const { error: deleteError } = await supabase
        .from('project_archives')
        .delete()
        .eq('id', archiveId);

      if (deleteError) {
        console.error('Error deleting archive:', deleteError);
        return { success: false, error: 'Failed to delete archive' };
      }

      return { success: true };
    } catch (error) {
      console.error('Unexpected error in deleteArchive:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Enforces retention policies
   */
  static async enforceRetentionPolicies(): Promise<{
    success: boolean;
    archivesMarked: number;
    notificationsSent: number;
    errors: string[];
  }> {
    try {
      const errors: string[] = [];
      let archivesMarked = 0;
      let totalNotificationsSent = 0;

      const archives = await this.getArchivesForDeletion();
      console.log(`Found ${archives.length} archives past retention period`);

      for (const archive of archives) {
        const markResult = await this.markForDeletion(archive.id);
        
        if (markResult.success) {
          archivesMarked++;
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

      return {
        success: true,
        archivesMarked,
        notificationsSent: totalNotificationsSent,
        errors,
      };
    } catch (error) {
      console.error('Unexpected error in enforceRetentionPolicies:', error);
      return {
        success: false,
        archivesMarked: 0,
        notificationsSent: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error occurred'],
      };
    }
  }

  /**
   * Executes scheduled deletions
   */
  static async executeScheduledDeletions(): Promise<{
    success: boolean;
    archivesDeleted: number;
    errors: string[];
  }> {
    try {
      const supabase = createServiceRoleClient();
      const errors: string[] = [];
      let archivesDeleted = 0;

      const now = new Date().toISOString();

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
        return { success: true, archivesDeleted: 0, errors: [] };
      }

      for (const archive of archives) {
        const deleteResult = await this.deleteArchive(archive.id);
        
        if (deleteResult.success) {
          archivesDeleted++;
          console.log(`Deleted archive ${archive.archive_identifier}`);
        } else {
          errors.push(`Failed to delete archive ${archive.archive_identifier}: ${deleteResult.error}`);
        }
      }

      return { success: true, archivesDeleted, errors };
    } catch (error) {
      console.error('Unexpected error in executeScheduledDeletions:', error);
      return {
        success: false,
        archivesDeleted: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error occurred'],
      };
    }
  }
}
