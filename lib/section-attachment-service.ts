/**
 * Section Attachment Service
 * 
 * Handles section-specific file attachments similar to Microsoft Teams attachments.
 * Supports file upload, download, and deletion with proper validation.
 */

import { createClient } from '@/lib/supabase/client';

// File type validation
const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'text/plain',
  'text/csv',
  'application/zip',
  'application/x-zip-compressed',
];

// File size limit: 100MB
const MAX_FILE_SIZE = 100 * 1024 * 1024;

export interface SectionAttachment {
  id: string;
  sectionId: string;
  documentId: string;
  uploadedBy: string;
  fileName: string;
  filePath: string;
  fileType: string;
  fileSize: number;
  description?: string;
  createdAt: string;
  // Populated fields
  uploader?: {
    id: string;
    name: string;
    email: string;
  };
  downloadUrl?: string;
}

export interface UploadAttachmentInput {
  sectionId: string;
  documentId: string;
  file: File;
  description?: string;
}

export interface AttachmentResult {
  success: boolean;
  attachment?: SectionAttachment;
  error?: string;
  errorCode?: 'INVALID_FILE_TYPE' | 'FILE_TOO_LARGE' | 'UPLOAD_FAILED' | 'UNAUTHORIZED' | 'UNKNOWN';
}

export interface AttachmentsResult {
  success: boolean;
  attachments?: SectionAttachment[];
  error?: string;
}

export class SectionAttachmentService {
  /**
   * Validates file type and size
   */
  static validateFile(file: File): { valid: boolean; error?: string; errorCode?: string } {
    // Check file type
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      return {
        valid: false,
        error: `File type ${file.type} is not allowed. Allowed types: PDF, Word, Excel, PowerPoint, Images, Text, CSV, ZIP`,
        errorCode: 'INVALID_FILE_TYPE',
      };
    }

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return {
        valid: false,
        error: `File size ${(file.size / 1024 / 1024).toFixed(2)}MB exceeds maximum allowed size of ${MAX_FILE_SIZE / 1024 / 1024}MB`,
        errorCode: 'FILE_TOO_LARGE',
      };
    }

    return { valid: true };
  }

  /**
   * Uploads an attachment to a section
   */
  static async uploadAttachment(
    input: UploadAttachmentInput,
    userId: string
  ): Promise<AttachmentResult> {
    try {
      // Validate file
      const validation = this.validateFile(input.file);
      if (!validation.valid) {
        return {
          success: false,
          error: validation.error,
          errorCode: validation.errorCode as any,
        };
      }

      const supabase = createClient();

      // Verify user has editor access to the document
      const { data: collaborator } = await supabase
        .from('document_collaborators')
        .select('role')
        .eq('document_id', input.documentId)
        .eq('user_id', userId)
        .maybeSingle();

      if (!collaborator || !['owner', 'editor'].includes(collaborator.role)) {
        return {
          success: false,
          error: 'You do not have permission to upload attachments to this document',
          errorCode: 'UNAUTHORIZED',
        };
      }

      // Upload file to Supabase Storage
      const fileExt = input.file.name.split('.').pop();
      const fileName = `${input.documentId}/${input.sectionId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('section-attachments')
        .upload(fileName, input.file, {
          contentType: input.file.type,
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

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('section-attachments')
        .getPublicUrl(fileName);

      // Store attachment metadata in database
      const { data: attachment, error: dbError } = await supabase
        .from('section_attachments')
        .insert({
          section_id: input.sectionId,
          document_id: input.documentId,
          uploaded_by: userId,
          file_name: input.file.name,
          file_path: fileName,
          file_type: input.file.type,
          file_size: input.file.size,
          description: input.description,
        })
        .select(`
          *,
          users:uploaded_by (
            id,
            raw_user_meta_data
          )
        `)
        .single();

      if (dbError || !attachment) {
        console.error('Error storing attachment metadata:', dbError);

        // Cleanup: Delete uploaded file
        await supabase.storage
          .from('section-attachments')
          .remove([fileName]);

        return {
          success: false,
          error: 'Failed to store attachment metadata',
          errorCode: 'UPLOAD_FAILED',
        };
      }

      return {
        success: true,
        attachment: this.mapAttachment(attachment, urlData.publicUrl),
      };
    } catch (error) {
      console.error('Unexpected error in uploadAttachment:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        errorCode: 'UNKNOWN',
      };
    }
  }

  /**
   * Gets all attachments for a section
   */
  static async getSectionAttachments(
    sectionId: string,
    userId: string
  ): Promise<AttachmentsResult> {
    try {
      const supabase = createClient();

      // Get all attachments for the section
      const { data: attachments, error } = await supabase
        .from('section_attachments')
        .select(`
          *,
          users:uploaded_by (
            id,
            raw_user_meta_data
          )
        `)
        .eq('section_id', sectionId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching attachments:', error);
        return {
          success: false,
          error: 'Failed to fetch attachments',
        };
      }

      // Get download URLs for all attachments
      const mappedAttachments = await Promise.all(
        (attachments || []).map(async (attachment) => {
          const { data: urlData } = supabase.storage
            .from('section-attachments')
            .getPublicUrl(attachment.file_path);

          return this.mapAttachment(attachment, urlData.publicUrl);
        })
      );

      return {
        success: true,
        attachments: mappedAttachments,
      };
    } catch (error) {
      console.error('Unexpected error in getSectionAttachments:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Deletes an attachment
   */
  static async deleteAttachment(
    attachmentId: string,
    userId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const supabase = createClient();

      // Get attachment details
      const { data: attachment, error: fetchError } = await supabase
        .from('section_attachments')
        .select('uploaded_by, file_path, document_id')
        .eq('id', attachmentId)
        .single();

      if (fetchError || !attachment) {
        return {
          success: false,
          error: 'Attachment not found',
        };
      }

      // Check if user is uploader or document owner
      const isUploader = attachment.uploaded_by === userId;
      const { data: collaborator } = await supabase
        .from('document_collaborators')
        .select('role')
        .eq('document_id', attachment.document_id)
        .eq('user_id', userId)
        .maybeSingle();

      const isOwner = collaborator?.role === 'owner';

      if (!isUploader && !isOwner) {
        return {
          success: false,
          error: 'You can only delete your own attachments or you must be the document owner',
        };
      }

      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('section-attachments')
        .remove([attachment.file_path]);

      if (storageError) {
        console.error('Error deleting file from storage:', storageError);
        // Continue with database deletion even if storage deletion fails
      }

      // Delete from database
      const { error: deleteError } = await supabase
        .from('section_attachments')
        .delete()
        .eq('id', attachmentId);

      if (deleteError) {
        console.error('Error deleting attachment from database:', deleteError);
        return {
          success: false,
          error: 'Failed to delete attachment',
        };
      }

      return { success: true };
    } catch (error) {
      console.error('Unexpected error in deleteAttachment:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Gets attachments count for a section
   */
  static async getAttachmentsCount(sectionId: string): Promise<number> {
    try {
      const supabase = createClient();

      const { count, error } = await supabase
        .from('section_attachments')
        .select('*', { count: 'exact', head: true })
        .eq('section_id', sectionId);

      if (error) {
        console.error('Error getting attachments count:', error);
        return 0;
      }

      return count || 0;
    } catch (error) {
      console.error('Unexpected error in getAttachmentsCount:', error);
      return 0;
    }
  }

  /**
   * Maps database attachment to SectionAttachment interface
   */
  private static mapAttachment(attachment: any, downloadUrl: string): SectionAttachment {
    const user = attachment.users;
    return {
      id: attachment.id,
      sectionId: attachment.section_id,
      documentId: attachment.document_id,
      uploadedBy: attachment.uploaded_by,
      fileName: attachment.file_name,
      filePath: attachment.file_path,
      fileType: attachment.file_type,
      fileSize: attachment.file_size,
      description: attachment.description,
      createdAt: attachment.created_at,
      uploader: user
        ? {
            id: user.id,
            name: user.raw_user_meta_data?.name || 'Unknown User',
            email: user.raw_user_meta_data?.email || '',
          }
        : undefined,
      downloadUrl,
    };
  }
}
