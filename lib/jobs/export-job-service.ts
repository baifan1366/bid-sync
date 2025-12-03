/**
 * Export Job Service
 * 
 * Wrapper service for export operations that need to run in background jobs.
 * Uses service role client instead of user session client.
 */

import { createServiceRoleClient } from '../supabase/service-role';
import { ArchiveService } from '../archive-service';

// Export link expiry: 7 days
const EXPORT_EXPIRY_DAYS = 7;

export interface ExportPackage {
  project: any;
  proposals: any[];
  deliverables: any[];
  workspaces: any[];
  comments: any[];
  metadata: {
    exportedAt: Date;
    exportedBy: string;
    version: string;
    format: string;
  };
}

/**
 * ExportJobService class for background job operations
 */
export class ExportJobService {
  /**
   * Process export asynchronously
   */
  static async processExportAsync(exportId: string): Promise<void> {
    const supabase = createServiceRoleClient();

    try {
      // Update status to processing
      await supabase
        .from('project_exports')
        .update({ status: 'processing', updated_at: new Date().toISOString() })
        .eq('id', exportId);

      // Get export record
      const { data: exportRecord } = await supabase
        .from('project_exports')
        .select('*')
        .eq('id', exportId)
        .single();

      if (!exportRecord) {
        throw new Error('Export record not found');
      }

      // Generate export package
      const packageResult = await this.generateExportPackage(
        exportRecord.project_id,
        exportRecord.requested_by
      );

      if (!packageResult.success || !packageResult.path || !packageResult.size) {
        throw new Error(packageResult.error || 'Failed to generate export package');
      }

      // Calculate expiry date
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + EXPORT_EXPIRY_DAYS);

      // Update export record with success
      await supabase
        .from('project_exports')
        .update({
          status: 'completed',
          export_path: packageResult.path,
          export_size: packageResult.size,
          expires_at: expiresAt.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', exportId);

      // Send notification
      await this.sendExportReadyNotification(exportRecord.requested_by, exportId);
    } catch (error) {
      console.error('Error in processExportAsync:', error);

      // Update export record with failure
      await supabase
        .from('project_exports')
        .update({
          status: 'failed',
          error_message: error instanceof Error ? error.message : 'Unknown error',
          updated_at: new Date().toISOString(),
        })
        .eq('id', exportId);

      // Send failure notification
      const { data: exportRecord } = await supabase
        .from('project_exports')
        .select('requested_by')
        .eq('id', exportId)
        .single();

      if (exportRecord) {
        await this.sendExportFailedNotification(exportRecord.requested_by, exportId);
      }
    }
  }

  /**
   * Generate export package
   */
  static async generateExportPackage(
    projectId: string,
    userId: string
  ): Promise<{
    success: boolean;
    path?: string;
    size?: number;
    error?: string;
  }> {
    try {
      const supabase = createServiceRoleClient();

      // Collect all project data
      const archiveData = await ArchiveService.collectProjectData(projectId);

      // Build export package
      const exportPackage: ExportPackage = {
        project: archiveData.project,
        proposals: archiveData.proposals,
        deliverables: archiveData.deliverables,
        workspaces: archiveData.workspaces,
        comments: archiveData.comments,
        metadata: {
          exportedAt: new Date(),
          exportedBy: userId,
          version: '1.0',
          format: 'JSON',
        },
      };

      // Convert to JSON
      const jsonString = JSON.stringify(exportPackage, null, 2);
      const jsonBuffer = Buffer.from(jsonString, 'utf8');
      const exportSize = jsonBuffer.length;

      // Generate unique filename
      const timestamp = Date.now();
      const fileName = `project-export-${projectId}-${timestamp}.json`;
      const filePath = `exports/${fileName}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('exports')
        .upload(filePath, jsonBuffer, {
          contentType: 'application/json',
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        console.error('Error uploading export package:', uploadError);
        return {
          success: false,
          error: `Failed to upload export package: ${uploadError.message}`,
        };
      }

      return {
        success: true,
        path: filePath,
        size: exportSize,
      };
    } catch (error) {
      console.error('Error generating export package:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate export package',
      };
    }
  }

  /**
   * Clean up expired exports
   */
  static async cleanupExpiredExports(): Promise<{
    success: boolean;
    cleanedCount?: number;
    error?: string;
  }> {
    try {
      const supabase = createServiceRoleClient();

      // Find expired exports
      const { data: expiredExports, error: fetchError } = await supabase
        .from('project_exports')
        .select('id, export_path')
        .eq('status', 'completed')
        .lt('expires_at', new Date().toISOString());

      if (fetchError) {
        console.error('Error fetching expired exports:', fetchError);
        return {
          success: false,
          error: 'Failed to fetch expired exports',
        };
      }

      if (!expiredExports || expiredExports.length === 0) {
        return {
          success: true,
          cleanedCount: 0,
        };
      }

      let cleanedCount = 0;

      // Delete each expired export
      for (const exportRecord of expiredExports) {
        try {
          // Delete file from storage
          if (exportRecord.export_path) {
            const { error: deleteError } = await supabase.storage
              .from('exports')
              .remove([exportRecord.export_path]);

            if (deleteError) {
              console.error(`Error deleting export file ${exportRecord.export_path}:`, deleteError);
            }
          }

          // Delete export record
          const { error: recordError } = await supabase
            .from('project_exports')
            .delete()
            .eq('id', exportRecord.id);

          if (recordError) {
            console.error(`Error deleting export record ${exportRecord.id}:`, recordError);
          } else {
            cleanedCount++;
          }
        } catch (error) {
          console.error(`Error cleaning up export ${exportRecord.id}:`, error);
        }
      }

      return {
        success: true,
        cleanedCount,
      };
    } catch (error) {
      console.error('Unexpected error in cleanupExpiredExports:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Send notification when export is ready
   */
  private static async sendExportReadyNotification(
    userId: string,
    exportId: string
  ): Promise<void> {
    try {
      const supabase = createServiceRoleClient();

      await supabase.from('notifications').insert({
        user_id: userId,
        type: 'export_ready',
        title: 'Export Ready',
        message: 'Your project export is ready for download.',
        data: { exportId },
        created_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error sending export ready notification:', error);
    }
  }

  /**
   * Send notification when export fails
   */
  private static async sendExportFailedNotification(
    userId: string,
    exportId: string
  ): Promise<void> {
    try {
      const supabase = createServiceRoleClient();

      await supabase.from('notifications').insert({
        user_id: userId,
        type: 'export_failed',
        title: 'Export Failed',
        message: 'Your project export failed to generate. Please try again.',
        data: { exportId },
        created_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error sending export failed notification:', error);
    }
  }
}
