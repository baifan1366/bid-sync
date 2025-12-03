/**
 * Deliverable Service
 * 
 * Handles deliverable file uploads, retrieval, and deletion for project completion.
 * Implements requirements 1.2, 1.3, 1.4, 3.2 from the project-delivery-archival spec.
 */

import { createClient } from '@/lib/supabase/server';
import { LoggingService } from '@/lib/logging-service';
import {
  createErrorResponse,
  createSuccessResponse,
  ErrorCode,
  withStorageRetry,
  validateFileSize as validateFileSizeHelper,
  handleStorageError,
  handleDatabaseError,
} from '@/lib/error-handling';

// Maximum file size: 100MB in bytes
const MAX_FILE_SIZE = 100 * 1024 * 1024;

export interface Deliverable {
  id: string;
  projectId: string;
  proposalId: string;
  uploadedBy: string;
  fileName: string;
  filePath: string;
  fileType: string;
  fileSize: number;
  description?: string;
  version: number;
  isFinal: boolean;
  uploadedAt: Date;
}

export interface UploadDeliverableInput {
  projectId: string;
  proposalId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  description?: string;
  file: File | Buffer;
}

export interface UploadDeliverableResult {
  success: boolean;
  deliverable?: Deliverable;
  error?: string;
  errorCode?: 'FILE_TOO_LARGE' | 'UPLOAD_FAILED' | 'DATABASE_ERROR' | 'UNAUTHORIZED' | 'INVALID_STATUS' | 'UNKNOWN';
}

export interface GetDeliverablesResult {
  success: boolean;
  deliverables?: Deliverable[];
  error?: string;
}

export interface DeleteDeliverableResult {
  success: boolean;
  error?: string;
  errorCode?: 'NOT_FOUND' | 'UNAUTHORIZED' | 'INVALID_STATUS' | 'DELETE_FAILED' | 'UNKNOWN';
}

export interface GenerateDownloadUrlResult {
  success: boolean;
  url?: string;
  error?: string;
  errorCode?: 'NOT_FOUND' | 'UNAUTHORIZED' | 'URL_GENERATION_FAILED' | 'UNKNOWN';
}

/**
 * DeliverableService class for managing project deliverables
 */
export class DeliverableService {
  /**
   * Validates file size against the 100MB limit
   * 
   * Requirement 1.3: File size validation
   * 
   * @param fileSize - File size in bytes
   * @returns true if valid, false if exceeds limit
   */
  static validateFileSize(fileSize: number): boolean {
    return fileSize > 0 && fileSize <= MAX_FILE_SIZE;
  }

  /**
   * Uploads a deliverable file to storage and creates database record
   * 
   * Requirements:
   * - 1.2: Store file with metadata (filename, type, size, timestamp, uploader)
   * - 1.3: Validate file size (100MB limit)
   * - 1.4: Store description with deliverable
   * 
   * @param input - Upload deliverable input data
   * @param userId - Current user ID
   * @returns UploadDeliverableResult with deliverable data or error
   */
  static async uploadDeliverable(
    input: UploadDeliverableInput,
    userId: string
  ): Promise<UploadDeliverableResult> {
    const timer = LoggingService.startTimer();
    
    try {
      const supabase = await createClient();

      // Requirement 1.3: Validate file size
      if (!this.validateFileSize(input.fileSize)) {
        await LoggingService.logValidationError(
          'uploadDeliverable',
          userId,
          input.projectId,
          ['File size exceeds 100MB limit']
        );
        
        return {
          success: false,
          error: 'File size exceeds the 100MB limit',
          errorCode: 'FILE_TOO_LARGE',
        };
      }

      // Verify user is authorized (team member)
      const { data: teamMember, error: authError } = await supabase
        .from('bid_team_members')
        .select('user_id')
        .eq('project_id', input.projectId)
        .eq('user_id', userId)
        .maybeSingle();

      if (authError || !teamMember) {
        await LoggingService.logAuthorizationFailure(
          'uploadDeliverable',
          userId,
          input.projectId,
          'User is not a team member'
        );
        
        return {
          success: false,
          error: 'User is not authorized to upload deliverables for this project',
          errorCode: 'UNAUTHORIZED',
        };
      }

      // Check project status - must be 'awarded' to upload
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('status')
        .eq('id', input.projectId)
        .single();

      if (projectError || !project) {
        return {
          success: false,
          error: 'Project not found',
          errorCode: 'UNKNOWN',
        };
      }

      if (project.status !== 'awarded') {
        await LoggingService.logValidationError(
          'uploadDeliverable',
          userId,
          input.projectId,
          [`Invalid project status: ${project.status}`]
        );
        
        return {
          success: false,
          error: `Cannot upload deliverables. Project status is ${project.status}`,
          errorCode: 'INVALID_STATUS',
        };
      }

      // Generate unique file path
      const deliverableId = crypto.randomUUID();
      const timestamp = Date.now();
      const filePath = `${input.projectId}/${deliverableId}/${timestamp}-${input.fileName}`;

      // Upload file to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('deliverables')
        .upload(filePath, input.file, {
          contentType: input.fileType,
          upsert: false,
        });

      if (uploadError || !uploadData) {
        console.error('Error uploading file to storage:', uploadError);
        return {
          success: false,
          error: 'Failed to upload file to storage',
          errorCode: 'UPLOAD_FAILED',
        };
      }

      // Requirement 1.2: Create database record with metadata
      const { data: deliverable, error: dbError } = await supabase
        .from('project_deliverables')
        .insert({
          id: deliverableId,
          project_id: input.projectId,
          proposal_id: input.proposalId,
          uploaded_by: userId,
          file_name: input.fileName,
          file_path: filePath,
          file_type: input.fileType,
          file_size: input.fileSize,
          description: input.description || null,
          version: 1,
          is_final: false,
        })
        .select('*')
        .single();

      if (dbError || !deliverable) {
        console.error('Error creating deliverable record:', dbError);
        
        // Rollback: Delete uploaded file
        await supabase.storage
          .from('deliverables')
          .remove([filePath]);

        await LoggingService.logDeliverableUpload(
          userId,
          input.projectId,
          deliverableId,
          input.fileName,
          input.fileSize,
          false,
          timer()
        );

        return {
          success: false,
          error: 'Failed to create deliverable record',
          errorCode: 'DATABASE_ERROR',
        };
      }

      // Log successful upload
      const duration = timer();
      await LoggingService.logDeliverableUpload(
        userId,
        input.projectId,
        deliverable.id,
        input.fileName,
        input.fileSize,
        true,
        duration
      );

      return {
        success: true,
        deliverable: {
          id: deliverable.id,
          projectId: deliverable.project_id,
          proposalId: deliverable.proposal_id,
          uploadedBy: deliverable.uploaded_by,
          fileName: deliverable.file_name,
          filePath: deliverable.file_path,
          fileType: deliverable.file_type,
          fileSize: deliverable.file_size,
          description: deliverable.description,
          version: deliverable.version,
          isFinal: deliverable.is_final,
          uploadedAt: new Date(deliverable.uploaded_at),
        },
      };
    } catch (error) {
      console.error('Unexpected error in uploadDeliverable:', error);
      
      await LoggingService.logDeliverableUpload(
        userId,
        input.projectId,
        '',
        input.fileName,
        input.fileSize,
        false,
        timer()
      );
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        errorCode: 'UNKNOWN',
      };
    }
  }

  /**
   * Retrieves all deliverables for a project
   * 
   * Requirement 1.5: Display deliverables in chronological order
   * 
   * @param projectId - Project ID
   * @returns GetDeliverablesResult with deliverables array or error
   */
  static async getDeliverables(projectId: string): Promise<GetDeliverablesResult> {
    try {
      const supabase = await createClient();

      // Requirement 1.5: Order by upload timestamp (chronological)
      const { data: deliverables, error } = await supabase
        .from('project_deliverables')
        .select('*')
        .eq('project_id', projectId)
        .order('uploaded_at', { ascending: true });

      if (error) {
        console.error('Error fetching deliverables:', error);
        return {
          success: false,
          error: 'Failed to fetch deliverables',
        };
      }

      return {
        success: true,
        deliverables: (deliverables || []).map((d) => ({
          id: d.id,
          projectId: d.project_id,
          proposalId: d.proposal_id,
          uploadedBy: d.uploaded_by,
          fileName: d.file_name,
          filePath: d.file_path,
          fileType: d.file_type,
          fileSize: d.file_size,
          description: d.description,
          version: d.version,
          isFinal: d.is_final,
          uploadedAt: new Date(d.uploaded_at),
        })),
      };
    } catch (error) {
      console.error('Unexpected error in getDeliverables:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Retrieves deliverables for a specific proposal
   * 
   * @param proposalId - Proposal ID
   * @returns GetDeliverablesResult with deliverables array or error
   */
  static async getDeliverablesByProposal(proposalId: string): Promise<GetDeliverablesResult> {
    try {
      const supabase = await createClient();

      const { data: deliverables, error } = await supabase
        .from('project_deliverables')
        .select('*')
        .eq('proposal_id', proposalId)
        .order('uploaded_at', { ascending: true });

      if (error) {
        console.error('Error fetching deliverables by proposal:', error);
        return {
          success: false,
          error: 'Failed to fetch deliverables',
        };
      }

      return {
        success: true,
        deliverables: (deliverables || []).map((d) => ({
          id: d.id,
          projectId: d.project_id,
          proposalId: d.proposal_id,
          uploadedBy: d.uploaded_by,
          fileName: d.file_name,
          filePath: d.file_path,
          fileType: d.file_type,
          fileSize: d.file_size,
          description: d.description,
          version: d.version,
          isFinal: d.is_final,
          uploadedAt: new Date(d.uploaded_at),
        })),
      };
    } catch (error) {
      console.error('Unexpected error in getDeliverablesByProposal:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Deletes a deliverable file and database record
   * 
   * Only team members can delete deliverables, and only when project is in 'awarded' status
   * 
   * @param deliverableId - Deliverable ID to delete
   * @param userId - Current user ID
   * @returns DeleteDeliverableResult with success status or error
   */
  static async deleteDeliverable(
    deliverableId: string,
    userId: string
  ): Promise<DeleteDeliverableResult> {
    try {
      const supabase = await createClient();

      // Get deliverable details
      const { data: deliverable, error: fetchError } = await supabase
        .from('project_deliverables')
        .select('*, projects!inner(status)')
        .eq('id', deliverableId)
        .single();

      if (fetchError || !deliverable) {
        await LoggingService.logDeliverableDelete(
          userId,
          '',
          deliverableId,
          'unknown',
          false
        );
        
        return {
          success: false,
          error: 'Deliverable not found',
          errorCode: 'NOT_FOUND',
        };
      }

      // Verify user is authorized (must be uploader or team member)
      const { data: teamMember, error: authError } = await supabase
        .from('bid_team_members')
        .select('user_id')
        .eq('project_id', deliverable.project_id)
        .eq('user_id', userId)
        .maybeSingle();

      if (authError || !teamMember) {
        await LoggingService.logAuthorizationFailure(
          'deleteDeliverable',
          userId,
          deliverable.project_id,
          'User is not a team member'
        );
        
        return {
          success: false,
          error: 'User is not authorized to delete this deliverable',
          errorCode: 'UNAUTHORIZED',
        };
      }

      // Check project status - can only delete when status is 'awarded'
      const projectStatus = (deliverable.projects as any).status;
      if (projectStatus !== 'awarded') {
        await LoggingService.logValidationError(
          'deleteDeliverable',
          userId,
          deliverable.project_id,
          [`Invalid project status: ${projectStatus}`]
        );
        
        return {
          success: false,
          error: `Cannot delete deliverables. Project status is ${projectStatus}`,
          errorCode: 'INVALID_STATUS',
        };
      }

      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('deliverables')
        .remove([deliverable.file_path]);

      if (storageError) {
        console.error('Error deleting file from storage:', storageError);
        // Continue with database deletion even if storage deletion fails
      }

      // Delete from database
      const { error: deleteError } = await supabase
        .from('project_deliverables')
        .delete()
        .eq('id', deliverableId);

      if (deleteError) {
        console.error('Error deleting deliverable record:', deleteError);
        
        await LoggingService.logDeliverableDelete(
          userId,
          deliverable.project_id,
          deliverableId,
          deliverable.file_name,
          false
        );
        
        return {
          success: false,
          error: 'Failed to delete deliverable',
          errorCode: 'DELETE_FAILED',
        };
      }

      // Log successful deletion
      await LoggingService.logDeliverableDelete(
        userId,
        deliverable.project_id,
        deliverableId,
        deliverable.file_name,
        true
      );

      return {
        success: true,
      };
    } catch (error) {
      console.error('Unexpected error in deleteDeliverable:', error);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        errorCode: 'UNKNOWN',
      };
    }
  }

  /**
   * Generates a signed download URL for a deliverable
   * 
   * Requirement 3.2: Serve files from Storage Service
   * 
   * @param deliverableId - Deliverable ID
   * @param expiresIn - URL expiration time in seconds (default: 1 hour)
   * @returns GenerateDownloadUrlResult with signed URL or error
   */
  static async generateDownloadUrl(
    deliverableId: string,
    expiresIn: number = 3600
  ): Promise<GenerateDownloadUrlResult> {
    try {
      const supabase = await createClient();

      // Get deliverable file path
      const { data: deliverable, error: fetchError } = await supabase
        .from('project_deliverables')
        .select('file_path')
        .eq('id', deliverableId)
        .single();

      if (fetchError || !deliverable) {
        return {
          success: false,
          error: 'Deliverable not found',
          errorCode: 'NOT_FOUND',
        };
      }

      // Generate signed URL
      const { data: urlData, error: urlError } = await supabase.storage
        .from('deliverables')
        .createSignedUrl(deliverable.file_path, expiresIn);

      if (urlError || !urlData) {
        console.error('Error generating download URL:', urlError);
        return {
          success: false,
          error: 'Failed to generate download URL',
          errorCode: 'URL_GENERATION_FAILED',
        };
      }

      // Note: We don't have userId here, so we can't log the download
      // Logging should be done at the API/resolver level where userId is available

      return {
        success: true,
        url: urlData.signedUrl,
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
   * Gets a single deliverable by ID
   * 
   * @param deliverableId - Deliverable ID
   * @returns Deliverable or null
   */
  static async getDeliverable(deliverableId: string): Promise<Deliverable | null> {
    try {
      const supabase = await createClient();

      const { data: deliverable, error } = await supabase
        .from('project_deliverables')
        .select('*')
        .eq('id', deliverableId)
        .single();

      if (error || !deliverable) {
        console.error('Error fetching deliverable:', error);
        return null;
      }

      return {
        id: deliverable.id,
        projectId: deliverable.project_id,
        proposalId: deliverable.proposal_id,
        uploadedBy: deliverable.uploaded_by,
        fileName: deliverable.file_name,
        filePath: deliverable.file_path,
        fileType: deliverable.file_type,
        fileSize: deliverable.file_size,
        description: deliverable.description,
        version: deliverable.version,
        isFinal: deliverable.is_final,
        uploadedAt: new Date(deliverable.uploaded_at),
      };
    } catch (error) {
      console.error('Unexpected error in getDeliverable:', error);
      return null;
    }
  }
}
