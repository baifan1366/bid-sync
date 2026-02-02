/**
 * Export Service
 * 
 * Handles project data export including request creation, async processing,
 * package generation with JSON metadata, download URL generation with expiry,
 * and cleanup of expired exports.
 * 
 * Implements requirements 9.1, 9.2, 9.3, 9.4, 9.5 from the 
 * project-delivery-archival spec.
 */

import { createClient } from '@/lib/supabase/server';
import { ArchiveService } from './archive-service';
import { z } from 'zod';
import { LoggingService } from '@/lib/logging-service';

// Export link expiry: 7 days
const EXPORT_EXPIRY_DAYS = 7;
const EXPORT_EXPIRY_SECONDS = EXPORT_EXPIRY_DAYS * 24 * 60 * 60;

// Validation schemas
const RequestExportInputSchema = z.object({
  projectId: z.string().uuid('Invalid project ID'),
  userId: z.string().uuid('Invalid user ID'),
});

export interface RequestExportInput {
  projectId: string;
  userId: string;
}

export interface ProjectExport {
  id: string;
  projectId: string;
  requestedBy: string;
  requestedAt: Date;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  exportPath?: string;
  exportSize?: number;
  expiresAt?: Date;
  errorMessage?: string;
}

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

export interface RequestExportResult {
  success: boolean;
  export?: ProjectExport;
  error?: string;
  errorCode?:
    | 'NOT_FOUND'
    | 'UNAUTHORIZED'
    | 'INVALID_STATUS'
    | 'DATABASE_ERROR'
    | 'UNKNOWN';
}

export interface GetExportResult {
  success: boolean;
  export?: ProjectExport;
  error?: string;
  errorCode?: 'NOT_FOUND' | 'UNAUTHORIZED' | 'UNKNOWN';
}

export interface GetExportsResult {
  success: boolean;
  exports?: ProjectExport[];
  error?: string;
}

export interface GenerateDownloadUrlResult {
  success: boolean;
  url?: string;
  expiresAt?: Date;
  error?: string;
  errorCode?: 'NOT_FOUND' | 'EXPIRED' | 'NOT_READY' | 'STORAGE_ERROR' | 'UNKNOWN';
}

/**
 * ExportService class for managing project exports
 */
export class ExportService {
  /**
   * Request a project export
   * 
   * Requirement 9.1: Generate downloadable package containing all project data
   * Requirement 9.4: Process request asynchronously and notify user when ready
   * 
   * @param input - Export request parameters
   * @returns RequestExportResult with export record or error
   */
  static async requestExport(
    input: RequestExportInput
  ): Promise<RequestExportResult> {
    try {
      // Validate input
      const validated = RequestExportInputSchema.parse(input);

      const supabase = await createClient();

      // Verify project exists
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('id, status, client_id')
        .eq('id', validated.projectId)
        .single();

      if (projectError || !project) {
        return {
          success: false,
          error: 'Project not found',
          errorCode: 'NOT_FOUND',
        };
      }

      // Verify user has access (must be client or team member)
      const hasAccess = await this.verifyExportAccess(validated.projectId, validated.userId);
      if (!hasAccess) {
        return {
          success: false,
          error: 'User is not authorized to export this project',
          errorCode: 'UNAUTHORIZED',
        };
      }

      // Create export request record
      const { data: exportRecord, error: exportError } = await supabase
        .from('project_exports')
        .insert({
          project_id: validated.projectId,
          requested_by: validated.userId,
          requested_at: new Date().toISOString(),
          status: 'pending',
        })
        .select('*')
        .single();

      if (exportError || !exportRecord) {
        console.error('Error creating export record:', exportError);
        return {
          success: false,
          error: 'Failed to create export request',
          errorCode: 'DATABASE_ERROR',
        };
      }

      // In a real implementation, this would queue a background job
      // For now, we'll process it immediately in the background
      // Note: In production, use a job queue like Bull, BullMQ, or similar
      this.processExportAsync(exportRecord.id).catch((error) => {
        console.error('Error processing export:', error);
      });

      // Log export request
      await LoggingService.logExportRequest(
        validated.userId,
        validated.projectId,
        exportRecord.id,
        true
      );

      return {
        success: true,
        export: {
          id: exportRecord.id,
          projectId: exportRecord.project_id,
          requestedBy: exportRecord.requested_by,
          requestedAt: new Date(exportRecord.requested_at),
          status: exportRecord.status,
          exportPath: exportRecord.export_path,
          exportSize: exportRecord.export_size,
          expiresAt: exportRecord.expires_at ? new Date(exportRecord.expires_at) : undefined,
          errorMessage: exportRecord.error_message,
        },
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          success: false,
          error: error.issues.map((e) => e.message).join(', '),
          errorCode: 'UNKNOWN',
        };
      }

      console.error('Unexpected error in requestExport:', error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        errorCode: 'UNKNOWN',
      };
    }
  }

  /**
   * Process export asynchronously
   * 
   * Requirement 9.2: Include all deliverables, workspace documents, proposal versions, and comments
   * Requirement 9.3: Create structured format with metadata in JSON
   * 
   * @param exportId - Export ID to process
   */
  static async processExportAsync(exportId: string): Promise<void> {
    const timer = LoggingService.startTimer();
    const supabase = await createClient();

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

      // Calculate expiry date (7 days from now)
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

      // Send notification to user (Requirement 9.4)
      await this.sendExportReadyNotification(exportRecord.requested_by, exportId);

      // Log successful export processing
      const duration = timer();
      await LoggingService.logExportProcess(
        exportId,
        exportRecord.project_id,
        'completed',
        packageResult.size,
        undefined,
        duration
      );
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
        .select('requested_by, project_id')
        .eq('id', exportId)
        .single();

      if (exportRecord) {
        await this.sendExportFailedNotification(exportRecord.requested_by, exportId);
        
        // Log failed export processing
        const duration = timer();
        await LoggingService.logExportProcess(
          exportId,
          exportRecord.project_id,
          'failed',
          undefined,
          error instanceof Error ? error.message : 'Unknown error',
          duration
        );
      }
    }
  }

  /**
   * Generate export package with all project data
   * 
   * Requirement 9.1: Generate downloadable package containing all project data
   * Requirement 9.2: Include all deliverables, workspace documents, proposal versions, and comments
   * Requirement 9.3: Create structured format with metadata in JSON
   * 
   * @param projectId - Project ID
   * @param userId - User ID requesting export
   * @returns Export package path and size
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
      const supabase = await createClient();

      // Collect all project data using ArchiveService
      const archiveData = await ArchiveService.collectProjectData(projectId);

      // Build export package with metadata
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
      const { data: uploadData, error: uploadError } = await supabase.storage
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
   * Get export by ID
   * 
   * @param exportId - Export ID
   * @param userId - User ID requesting export
   * @returns GetExportResult with export data or error
   */
  static async getExport(
    exportId: string,
    userId: string
  ): Promise<GetExportResult> {
    try {
      const supabase = await createClient();

      const { data: exportRecord, error: exportError } = await supabase
        .from('project_exports')
        .select('*')
        .eq('id', exportId)
        .single();

      if (exportError || !exportRecord) {
        return {
          success: false,
          error: 'Export not found',
          errorCode: 'NOT_FOUND',
        };
      }

      // Verify user has access
      const hasAccess = await this.verifyExportAccess(exportRecord.project_id, userId);
      if (!hasAccess) {
        return {
          success: false,
          error: 'User is not authorized to access this export',
          errorCode: 'UNAUTHORIZED',
        };
      }

      return {
        success: true,
        export: {
          id: exportRecord.id,
          projectId: exportRecord.project_id,
          requestedBy: exportRecord.requested_by,
          requestedAt: new Date(exportRecord.requested_at),
          status: exportRecord.status,
          exportPath: exportRecord.export_path,
          exportSize: exportRecord.export_size,
          expiresAt: exportRecord.expires_at ? new Date(exportRecord.expires_at) : undefined,
          errorMessage: exportRecord.error_message,
        },
      };
    } catch (error) {
      console.error('Unexpected error in getExport:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        errorCode: 'UNKNOWN',
      };
    }
  }

  /**
   * Get all exports for a project
   * 
   * @param projectId - Project ID
   * @param userId - User ID requesting exports
   * @returns GetExportsResult with exports or error
   */
  static async getExportsByProject(
    projectId: string,
    userId: string
  ): Promise<GetExportsResult> {
    try {
      const supabase = await createClient();

      // Verify user has access
      const hasAccess = await this.verifyExportAccess(projectId, userId);
      if (!hasAccess) {
        return {
          success: false,
          error: 'User is not authorized to access exports for this project',
        };
      }

      const { data: exports, error: exportsError } = await supabase
        .from('project_exports')
        .select('*')
        .eq('project_id', projectId)
        .order('requested_at', { ascending: false });

      if (exportsError) {
        console.error('Error fetching exports:', exportsError);
        return {
          success: false,
          error: 'Failed to fetch exports',
        };
      }

      return {
        success: true,
        exports: (exports || []).map((e: any) => ({
          id: e.id,
          projectId: e.project_id,
          requestedBy: e.requested_by,
          requestedAt: new Date(e.requested_at),
          status: e.status,
          exportPath: e.export_path,
          exportSize: e.export_size,
          expiresAt: e.expires_at ? new Date(e.expires_at) : undefined,
          errorMessage: e.error_message,
        })),
      };
    } catch (error) {
      console.error('Unexpected error in getExportsByProject:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Generate download URL for export
   * 
   * Requirement 9.5: Provide download link valid for 7 days
   * 
   * @param exportId - Export ID
   * @param userId - User ID requesting download
   * @returns GenerateDownloadUrlResult with signed URL or error
   */
  static async generateDownloadUrl(
    exportId: string,
    userId: string
  ): Promise<GenerateDownloadUrlResult> {
    try {
      const supabase = await createClient();

      // Get export record
      const { data: exportRecord, error: exportError } = await supabase
        .from('project_exports')
        .select('*')
        .eq('id', exportId)
        .single();

      if (exportError || !exportRecord) {
        return {
          success: false,
          error: 'Export not found',
          errorCode: 'NOT_FOUND',
        };
      }

      // Verify user has access
      const hasAccess = await this.verifyExportAccess(exportRecord.project_id, userId);
      if (!hasAccess) {
        return {
          success: false,
          error: 'User is not authorized to download this export',
          errorCode: 'NOT_FOUND',
        };
      }

      // Check if export is ready
      if (exportRecord.status !== 'completed') {
        return {
          success: false,
          error: `Export is not ready. Current status: ${exportRecord.status}`,
          errorCode: 'NOT_READY',
        };
      }

      // Check if export has expired
      if (exportRecord.expires_at) {
        const expiresAt = new Date(exportRecord.expires_at);
        if (expiresAt < new Date()) {
          return {
            success: false,
            error: 'Export has expired',
            errorCode: 'EXPIRED',
          };
        }
      }

      // Generate signed URL (1 hour expiry for the download link itself)
      const { data: urlData, error: urlError } = await supabase.storage
        .from('exports')
        .createSignedUrl(exportRecord.export_path, 3600);

      if (urlError || !urlData) {
        console.error('Error generating signed URL:', urlError);
        return {
          success: false,
          error: 'Failed to generate download URL',
          errorCode: 'STORAGE_ERROR',
        };
      }

      return {
        success: true,
        url: urlData.signedUrl,
        expiresAt: exportRecord.expires_at ? new Date(exportRecord.expires_at) : undefined,
      };
    } catch (error) {
      console.error('Unexpected error in generateDownloadUrl:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        errorCode: 'UNKNOWN',
      };
    }
  }

  /**
   * Clean up expired exports
   * 
   * Requirement 9.5: Remove expired exports
   * 
   * This should be called by a scheduled job (e.g., daily cron)
   * 
   * @returns Number of exports cleaned up
   */
  static async cleanupExpiredExports(): Promise<{
    success: boolean;
    cleanedCount?: number;
    error?: string;
  }> {
    const timer = LoggingService.startTimer();
    
    try {
      const supabase = await createClient();

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

      // Log cleanup operation
      const duration = timer();
      await LoggingService.logExportCleanup(
        cleanedCount,
        duration
      );

      return {
        success: true,
        cleanedCount,
      };
    } catch (error) {
      console.error('Unexpected error in cleanupExpiredExports:', error);
      
      await LoggingService.logExportCleanup(
        0,
        timer()
      );
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Verify if user has access to export a project
   * 
   * @param projectId - Project ID
   * @param userId - User ID
   * @returns true if user has access, false otherwise
   */
  private static async verifyExportAccess(
    projectId: string,
    userId: string
  ): Promise<boolean> {
    try {
      const supabase = await createClient();

      // Check if user is the client
      const { data: project } = await supabase
        .from('projects')
        .select('client_id')
        .eq('id', projectId)
        .single();

      if (project && project.client_id === userId) {
        return true;
      }

      // Check if user is a team member of any proposal for this project
      const { data: proposals } = await supabase
        .from('proposals')
        .select('id')
        .eq('project_id', projectId);

      if (proposals && proposals.length > 0) {
        const proposalIds = proposals.map(p => p.id);
        
        const { data: teamMember } = await supabase
          .from('proposal_team_members')
          .select('user_id')
          .in('proposal_id', proposalIds)
          .eq('user_id', userId)
          .maybeSingle();

        if (teamMember) {
          return true;
        }
      }

      return false;
    } catch (error) {
      console.error('Error verifying export access:', error);
      return false;
    }
  }

  /**
   * Send notification when export is ready
   * 
   * Requirement 9.4: Notify user when export is ready
   * 
   * @param userId - User ID to notify
   * @param exportId - Export ID
   */
  private static async sendExportReadyNotification(
    userId: string,
    exportId: string
  ): Promise<void> {
    try {
      const supabase = await createClient();

      // Create notification record
      // Note: Adjust this based on your notification system
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
   * 
   * Requirement 9.4: Notify user when export fails
   * 
   * @param userId - User ID to notify
   * @param exportId - Export ID
   */
  private static async sendExportFailedNotification(
    userId: string,
    exportId: string
  ): Promise<void> {
    try {
      const supabase = await createClient();

      // Create notification record
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
