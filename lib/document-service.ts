/**
 * Document Service
 * 
 * Handles document creation, retrieval, update, and deletion for collaborative editing.
 * Also handles proposal document upload, storage, retrieval, and deletion.
 * Implements requirements 9.1, 9.2, 9.3, 9.4, 9.5 from the bidding-leader-management spec.
 * 
 * IMPORTANT: This service works with TWO different tables:
 * 
 * 1. `workspace_documents` table - For collaborative editor content (TipTap)
 *    - Used by: createDocument, getDocument, listDocuments, searchDocuments, 
 *               updateDocumentContent, updateDocumentMetadata, deleteDocument
 *    - Contains: title, description, JSONB content for TipTap editor
 * 
 * 2. `documents` table - For file attachments/uploads
 *    - Used by: uploadDocument, getProposalDocuments, deleteProposalDocument,
 *               validateRequiredDocuments, getDocumentWithUrl
 *    - Contains: url, doc_type, file_name, file_size for uploaded files
 */

import { createClient } from '@/lib/supabase/server';
import { sanitizeSearchInput } from './validation-utils';

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
  'text/plain',
  'text/csv',
];

// File size limit: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Collaborative document interfaces
export interface CollaborativeDocument {
  id: string;
  workspaceId: string;
  title: string;
  description?: string;
  content: any;
  createdBy: string;
  lastEditedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDocumentInput {
  workspaceId: string;
  title: string;
  description?: string;
  createdBy: string;
}

export interface UpdateDocumentInput {
  documentId: string;
  content: any;
  userId: string;
}

export interface UpdateDocumentMetadataInput {
  documentId: string;
  title?: string;
  description?: string;
  userId: string;
}

export interface SearchDocumentsInput {
  query: string;
  workspaceId?: string;
  userId: string;
}

export interface DocumentResult {
  success: boolean;
  data?: CollaborativeDocument;
  error?: string;
}

export interface DocumentsResult {
  success: boolean;
  data?: CollaborativeDocument[];
  error?: string;
}

export interface DocumentMetadata {
  fileName: string;
  fileSize: number;
  fileType: string;
  isRequired?: boolean;
}

export interface ProposalDocument {
  id: string;
  proposalId: string;
  url: string;
  docType: string;
  fileName: string;
  fileSize: number;
  uploadedBy: string;
  uploadedAt: string;
  isRequired: boolean;
}

export interface UploadDocumentResult {
  success: boolean;
  document?: ProposalDocument;
  error?: string;
  errorCode?: 'INVALID_FILE_TYPE' | 'FILE_TOO_LARGE' | 'UPLOAD_FAILED' | 'UNAUTHORIZED' | 'PROPOSAL_NOT_FOUND' | 'UNKNOWN';
}

export interface DeleteDocumentResult {
  success: boolean;
  error?: string;
  errorCode?: 'DOCUMENT_NOT_FOUND' | 'UNAUTHORIZED' | 'DELETE_FAILED' | 'UNKNOWN';
}

export interface GetDocumentsResult {
  success: boolean;
  documents?: ProposalDocument[];
  error?: string;
}

/**
 * DocumentService class for managing both collaborative documents and proposal documents
 */
export class DocumentService {
  /**
   * Creates a new collaborative document
   */
  async createDocument(input: CreateDocumentInput): Promise<DocumentResult> {
    try {
      const supabase = await createClient();

      // Verify workspace exists and user has access
      const { data: workspace, error: workspaceError } = await supabase
        .from('workspaces')
        .select('id, lead_id, project_id')
        .eq('id', input.workspaceId)
        .single();

      if (workspaceError || !workspace) {
        return {
          success: false,
          error: 'Workspace not found',
        };
      }

      // Check if user is workspace lead or team member
      const isLead = workspace.lead_id === input.createdBy;
      const { checkProjectTeamMembership } = await import('@/lib/proposal-team-helpers');
      const { isMember } = await checkProjectTeamMembership(workspace.project_id, input.createdBy);

      if (!isLead && !isMember) {
        return {
          success: false,
          error: 'You do not have permission to create documents in this workspace',
        };
      }

      // Create document in workspace_documents table
      const { data: document, error: createError } = await supabase
        .from('workspace_documents')
        .insert({
          workspace_id: input.workspaceId,
          title: input.title,
          description: input.description || null,
          content: {},
          created_by: input.createdBy,
          last_edited_by: input.createdBy,
        })
        .select()
        .single();

      if (createError || !document) {
        console.error('Error creating document:', createError);
        return {
          success: false,
          error: 'Failed to create document',
        };
      }

      // Add creator as owner collaborator
      await supabase
        .from('document_collaborators')
        .insert({
          document_id: document.id,
          user_id: input.createdBy,
          role: 'owner',
          added_by: input.createdBy,
        });

      return {
        success: true,
        data: {
          id: document.id,
          workspaceId: document.workspace_id,
          title: document.title,
          description: document.description,
          content: document.content,
          createdBy: document.created_by,
          lastEditedBy: document.last_edited_by,
          createdAt: document.created_at,
          updatedAt: document.updated_at,
        },
      };
    } catch (error) {
      console.error('Error creating document:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Gets a document by ID
   */
  async getDocument(documentId: string, userId: string): Promise<DocumentResult> {
    try {
      const supabase = await createClient();
      
      // Import admin client for bypassing RLS when needed
      const { createAdminClient } = await import('@/lib/supabase/server');
      const adminClient = createAdminClient();

      // Query workspace_documents table using admin client to bypass RLS
      // Use explicit relationship name to avoid ambiguity
      const { data: document, error } = await adminClient
        .from('workspace_documents')
        .select('*, workspaces!workspace_documents_workspace_id_fkey(lead_id, project_id)')
        .eq('id', documentId)
        .single();

      if (error || !document) {
        console.error('[getDocument] Document fetch error:', error);
        return {
          success: false,
          error: 'Document not found',
        };
      }

      // Check if user has access: workspace lead, document creator, or team member
      const workspace = document.workspaces as any;
      const isWorkspaceLead = workspace.lead_id === userId;
      const isCreator = document.created_by === userId;

      console.log('[getDocument] Access check:', {
        documentId,
        userId,
        projectId: workspace.project_id,
        isWorkspaceLead,
        isCreator
      });

      // Check if user is a collaborator
      const { data: collaborator } = await adminClient
        .from('document_collaborators')
        .select('id')
        .eq('document_id', documentId)
        .eq('user_id', userId)
        .maybeSingle();

      console.log('[getDocument] Collaborator check:', { hasCollaborator: !!collaborator });

      // Check if user is a team member for the project
      const { checkProjectTeamMembership } = await import('@/lib/proposal-team-helpers');
      const { isMember, proposalId, error: memberError } = await checkProjectTeamMembership(workspace.project_id, userId);

      console.log('[getDocument] Team membership check:', { isMember, proposalId, memberError });

      if (!isWorkspaceLead && !isCreator && !collaborator && !isMember) {
        console.error('[getDocument] Access denied - no valid access path found');
        return {
          success: false,
          error: 'You do not have access to this document',
        };
      }

      console.log('[getDocument] Access granted');

      return {
        success: true,
        data: {
          id: document.id,
          workspaceId: document.workspace_id,
          title: document.title,
          description: document.description,
          content: document.content,
          createdBy: document.created_by,
          lastEditedBy: document.last_edited_by,
          createdAt: document.created_at,
          updatedAt: document.updated_at,
        },
      };
    } catch (error) {
      console.error('Error getting document:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Lists all documents in a workspace
   */
  async listDocuments(workspaceId: string, userId: string): Promise<DocumentsResult> {
    try {
      const supabase = await createClient();

      // Verify user has access to workspace
      const { data: workspace, error: workspaceError } = await supabase
        .from('workspaces')
        .select('id, lead_id, project_id')
        .eq('id', workspaceId)
        .single();

      if (workspaceError || !workspace) {
        return {
          success: false,
          error: 'Workspace not found',
        };
      }

      // Check if user is workspace lead or team member
      const isLead = workspace.lead_id === userId;
      // Check if user is lead or team member
      const { checkProjectTeamMembership } = await import('@/lib/proposal-team-helpers');
      const { isMember } = await checkProjectTeamMembership(workspace.project_id, userId);

      if (!isLead && !isMember) {
        return {
          success: false,
          error: 'You do not have access to this workspace',
        };
      }

      const { data: documents, error } = await supabase
        .from('workspace_documents')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('updated_at', { ascending: false });

      if (error) {
        return {
          success: false,
          error: 'Failed to list documents',
        };
      }

      return {
        success: true,
        data: (documents || []).map((doc) => ({
          id: doc.id,
          workspaceId: doc.workspace_id,
          title: doc.title,
          description: doc.description,
          content: doc.content,
          createdBy: doc.created_by,
          lastEditedBy: doc.last_edited_by,
          createdAt: doc.created_at,
          updatedAt: doc.updated_at,
        })),
      };
    } catch (error) {
      console.error('Error listing documents:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Searches documents by query
   */
  async searchDocuments(input: SearchDocumentsInput): Promise<DocumentsResult> {
    try {
      const supabase = await createClient();

      let query = supabase
        .from('workspace_documents')
        .select('*');

      if (input.workspaceId) {
        query = query.eq('workspace_id', input.workspaceId);
      }

      // Search in title and description
      const sanitizedQuery = sanitizeSearchInput(input.query);
      if (sanitizedQuery) {
        query = query.or(`title.ilike.%${sanitizedQuery}%,description.ilike.%${sanitizedQuery}%`);
      }

      const { data: documents, error } = await query.order('updated_at', { ascending: false });

      if (error) {
        return {
          success: false,
          error: 'Failed to search documents',
        };
      }

      return {
        success: true,
        data: (documents || []).map((doc) => ({
          id: doc.id,
          workspaceId: doc.workspace_id,
          title: doc.title,
          description: doc.description,
          content: doc.content,
          createdBy: doc.created_by,
          lastEditedBy: doc.last_edited_by,
          createdAt: doc.created_at,
          updatedAt: doc.updated_at,
        })),
      };
    } catch (error) {
      console.error('Error searching documents:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Updates document content and creates a version history entry
   */
  async updateDocument(input: UpdateDocumentInput): Promise<DocumentResult> {
    try {
      console.log('[updateDocument] Starting update for documentId:', input.documentId);
      
      const supabase = await createClient();

      const { data: document, error } = await supabase
        .from('workspace_documents')
        .update({
          content: input.content,
          last_edited_by: input.userId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', input.documentId)
        .select()
        .single();

      if (error || !document) {
        console.error('[updateDocument] Failed to update document:', error);
        return {
          success: false,
          error: 'Failed to update document',
        };
      }
      
      console.log('[updateDocument] Document updated successfully');

      // Create a version history entry
      try {
        console.log('[updateDocument] 📝 Creating version history entry...');
        console.log('[updateDocument] Version creation input:', {
          documentId: input.documentId,
          userId: input.userId,
          contentLength: JSON.stringify(input.content).length
        });
        
        const { VersionControlService } = await import('@/lib/version-control-service');
        const versionService = new VersionControlService();
        const versionResult = await versionService.createVersion({
          documentId: input.documentId,
          content: input.content,
          userId: input.userId,
        });
        
        console.log('[updateDocument] 📊 Version creation result:', {
          success: versionResult.success,
          error: versionResult.error,
          versionId: versionResult.data?.id,
          versionNumber: versionResult.data?.versionNumber
        });
        
        if (!versionResult.success) {
          console.error('[updateDocument] ⚠️ Version creation failed but continuing:', versionResult.error);
        } else {
          console.log('[updateDocument] ✅ Version created successfully!');
        }
      } catch (versionError) {
        // Log version creation error but don't fail the document update
        console.error('[updateDocument] ❌ Exception during version creation:', versionError);
      }

      return {
        success: true,
        data: {
          id: document.id,
          workspaceId: document.workspace_id,
          title: document.title,
          description: document.description,
          content: document.content,
          createdBy: document.created_by,
          lastEditedBy: document.last_edited_by,
          createdAt: document.created_at,
          updatedAt: document.updated_at,
        },
      };
    } catch (error) {
      console.error('Error updating document:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Updates document metadata (title, description)
   */
  async updateDocumentMetadata(input: UpdateDocumentMetadataInput): Promise<DocumentResult> {
    try {
      const supabase = await createClient();

      const updateData: any = {
        last_edited_by: input.userId,
        updated_at: new Date().toISOString(),
      };

      if (input.title !== undefined) updateData.title = input.title;
      if (input.description !== undefined) updateData.description = input.description;

      const { data: document, error } = await supabase
        .from('workspace_documents')
        .update(updateData)
        .eq('id', input.documentId)
        .select()
        .single();

      if (error || !document) {
        return {
          success: false,
          error: 'Failed to update document metadata',
        };
      }

      return {
        success: true,
        data: {
          id: document.id,
          workspaceId: document.workspace_id,
          title: document.title,
          description: document.description,
          content: document.content,
          createdBy: document.created_by,
          lastEditedBy: document.last_edited_by,
          createdAt: document.created_at,
          updatedAt: document.updated_at,
        },
      };
    } catch (error) {
      console.error('Error updating document metadata:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Deletes a document
   */
  async deleteDocument(documentId: string, userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const supabase = await createClient();

      // Verify document exists and user has permission
      const { data: document, error: fetchError } = await supabase
        .from('workspace_documents')
        .select('*, workspaces!workspace_documents_workspace_id_fkey(lead_id)')
        .eq('id', documentId)
        .single();

      if (fetchError || !document) {
        return {
          success: false,
          error: 'Document not found',
        };
      }

      // Check if user is workspace lead or document owner
      const workspace = document.workspaces as any;
      const isWorkspaceLead = workspace.lead_id === userId;

      // Check if user is document owner
      const { data: collaborator } = await supabase
        .from('document_collaborators')
        .select('role')
        .eq('document_id', documentId)
        .eq('user_id', userId)
        .maybeSingle();

      const isOwner = collaborator?.role === 'owner';

      if (!isWorkspaceLead && !isOwner) {
        return {
          success: false,
          error: 'Unauthorized to delete this document',
        };
      }

      const { error: deleteError } = await supabase
        .from('workspace_documents')
        .delete()
        .eq('id', documentId);

      if (deleteError) {
        return {
          success: false,
          error: 'Failed to delete document',
        };
      }

      return {
        success: true,
      };
    } catch (error) {
      console.error('Error deleting document:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // ============================================================================
  // PROPOSAL DOCUMENT METHODS (Original functionality)
  // ============================================================================

  /**
   * Validates file type and size
   * 
   * Requirement 9.1: Validate file type and size limits
   * 
   * @param file - The file to validate
   * @returns Validation result with error details if invalid
   */
  static validateFile(file: File): { valid: boolean; error?: string; errorCode?: string } {
    // Check file type
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      return {
        valid: false,
        error: `File type ${file.type} is not allowed. Allowed types: PDF, Word, Excel, PowerPoint, Images (JPEG, PNG, GIF), Text, CSV`,
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
   * Uploads a document to a proposal
   * 
   * Requirements:
   * - 9.1: Validate file type and size limits
   * - 9.2: Store securely and associate with proposal
   * 
   * @param proposalId - The proposal ID
   * @param file - The file to upload
   * @param metadata - Additional metadata
   * @param userId - The user uploading the document
   * @returns UploadDocumentResult with document data
   */
  static async uploadDocument(
    proposalId: string,
    file: File,
    metadata: DocumentMetadata,
    userId: string
  ): Promise<UploadDocumentResult> {
    try {
      // Validate file (Requirement 9.1)
      const validation = this.validateFile(file);
      if (!validation.valid) {
        return {
          success: false,
          error: validation.error,
          errorCode: validation.errorCode as any,
        };
      }

      const supabase = await createClient();

      // Verify proposal exists and user has access
      const { data: proposal, error: proposalError } = await supabase
        .from('proposals')
        .select('id, lead_id, project_id')
        .eq('id', proposalId)
        .single();

      if (proposalError || !proposal) {
        return {
          success: false,
          error: 'Proposal not found',
          errorCode: 'PROPOSAL_NOT_FOUND',
        };
      }

      // Check if user is lead or team member
      const { checkProjectTeamMembership } = await import('@/lib/proposal-team-helpers');
      const { isMember } = await checkProjectTeamMembership(proposal.project_id, userId);

      if (proposal.lead_id !== userId && !isMember) {
        return {
          success: false,
          error: 'Unauthorized to upload documents to this proposal',
          errorCode: 'UNAUTHORIZED',
        };
      }

      // Upload file to Supabase Storage (Requirement 9.2)
      const fileExt = metadata.fileName.split('.').pop();
      const fileName = `${proposalId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('proposal-documents')
        .upload(fileName, file, {
          contentType: metadata.fileType,
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
        .from('proposal-documents')
        .getPublicUrl(fileName);

      // Store document metadata in database (Requirement 9.2)
      const { data: document, error: dbError } = await supabase
        .from('documents')
        .insert({
          proposal_id: proposalId,
          url: urlData.publicUrl,
          doc_type: metadata.fileType,
          file_name: metadata.fileName,
          file_size: metadata.fileSize,
          created_by: userId,
          is_required: metadata.isRequired || false,
        })
        .select('id, proposal_id, url, doc_type, file_name, file_size, created_by, created_at, is_required')
        .single();

      if (dbError || !document) {
        console.error('Error storing document metadata:', dbError);
        
        // Cleanup: Delete uploaded file
        await supabase.storage
          .from('proposal-documents')
          .remove([fileName]);

        return {
          success: false,
          error: 'Failed to store document metadata',
          errorCode: 'UPLOAD_FAILED',
        };
      }

      return {
        success: true,
        document: {
          id: document.id,
          proposalId: document.proposal_id,
          url: document.url,
          docType: document.doc_type,
          fileName: document.file_name,
          fileSize: document.file_size,
          uploadedBy: document.created_by,
          uploadedAt: document.created_at,
          isRequired: document.is_required,
        },
      };
    } catch (error) {
      console.error('Unexpected error in uploadDocument:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        errorCode: 'UNKNOWN',
      };
    }
  }

  /**
   * Gets all documents for a proposal
   * 
   * Requirement 9.3: Display all uploaded files with metadata
   * 
   * @param proposalId - The proposal ID
   * @returns GetDocumentsResult with documents array
   */
  static async getDocuments(proposalId: string): Promise<GetDocumentsResult> {
    try {
      const supabase = await createClient();

      const { data: documents, error } = await supabase
        .from('documents')
        .select(`
          id,
          proposal_id,
          url,
          doc_type,
          file_name,
          file_size,
          created_by,
          created_at,
          is_required
        `)
        .eq('proposal_id', proposalId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching documents:', error);
        return {
          success: false,
          error: 'Failed to fetch documents',
        };
      }

      return {
        success: true,
        documents: documents.map((doc) => ({
          id: doc.id,
          proposalId: doc.proposal_id,
          url: doc.url,
          docType: doc.doc_type,
          fileName: doc.file_name,
          fileSize: doc.file_size,
          uploadedBy: doc.created_by,
          uploadedAt: doc.created_at,
          isRequired: doc.is_required,
        })),
      };
    } catch (error) {
      console.error('Unexpected error in getDocuments:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Deletes a document from a proposal
   * 
   * Requirement 9.4: Require confirmation and remove from storage
   * 
   * @param documentId - The document ID
   * @param userId - The user deleting the document
   * @returns DeleteDocumentResult
   */
  static async deleteDocument(
    documentId: string,
    userId: string
  ): Promise<DeleteDocumentResult> {
    try {
      const supabase = await createClient();

      // Get document details
      const { data: document, error: docError } = await supabase
        .from('documents')
        .select(`
          id,
          proposal_id,
          url,
          proposals!inner (
            id,
            lead_id,
            project_id
          )
        `)
        .eq('id', documentId)
        .single();

      if (docError || !document) {
        return {
          success: false,
          error: 'Document not found',
          errorCode: 'DOCUMENT_NOT_FOUND',
        };
      }

      // Check if user is lead or team member
      const proposal = document.proposals as any;
      const { checkProjectTeamMembership } = await import('@/lib/proposal-team-helpers');
      const { isMember } = await checkProjectTeamMembership(proposal.project_id, userId);

      if (proposal.lead_id !== userId && !isMember) {
        return {
          success: false,
          error: 'Unauthorized to delete this document',
          errorCode: 'UNAUTHORIZED',
        };
      }

      // Extract file path from URL
      const url = new URL(document.url);
      const pathParts = url.pathname.split('/');
      const fileName = pathParts.slice(-2).join('/'); // Get last two parts (proposalId/filename)

      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('proposal-documents')
        .remove([fileName]);

      if (storageError) {
        console.error('Error deleting file from storage:', storageError);
        // Continue with database deletion even if storage deletion fails
      }

      // Delete from database
      const { error: deleteError } = await supabase
        .from('documents')
        .delete()
        .eq('id', documentId);

      if (deleteError) {
        console.error('Error deleting document from database:', deleteError);
        return {
          success: false,
          error: 'Failed to delete document',
          errorCode: 'DELETE_FAILED',
        };
      }

      return {
        success: true,
      };
    } catch (error) {
      console.error('Unexpected error in deleteDocument:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        errorCode: 'UNKNOWN',
      };
    }
  }

  /**
   * Checks if all required documents are uploaded for a proposal
   * 
   * Requirement 9.5: Track required documents and prevent submission without them
   * 
   * @param proposalId - The proposal ID
   * @param requiredDocTypes - Array of required document types
   * @returns Object with validation result and missing documents
   */
  static async validateRequiredDocuments(
    proposalId: string,
    requiredDocTypes: string[]
  ): Promise<{
    valid: boolean;
    missingDocuments: string[];
  }> {
    try {
      const supabase = await createClient();

      // Get all documents for the proposal
      const { data: documents, error } = await supabase
        .from('documents')
        .select('doc_type, is_required')
        .eq('proposal_id', proposalId);

      if (error) {
        console.error('Error fetching documents for validation:', error);
        return {
          valid: false,
          missingDocuments: requiredDocTypes,
        };
      }

      // Check which required documents are missing
      const uploadedTypes = new Set(documents.map((doc) => doc.doc_type));
      const missingDocuments = requiredDocTypes.filter(
        (type) => !uploadedTypes.has(type)
      );

      return {
        valid: missingDocuments.length === 0,
        missingDocuments,
      };
    } catch (error) {
      console.error('Unexpected error in validateRequiredDocuments:', error);
      return {
        valid: false,
        missingDocuments: requiredDocTypes,
      };
    }
  }

  /**
   * Gets proposal document by ID
   * 
   * @param documentId - The document ID
   * @returns Document data or null
   */
  static async getProposalDocument(documentId: string): Promise<ProposalDocument | null> {
    try {
      const supabase = await createClient();

      const { data: document, error } = await supabase
        .from('documents')
        .select(`
          id,
          proposal_id,
          url,
          doc_type,
          file_name,
          file_size,
          created_by,
          created_at,
          is_required
        `)
        .eq('id', documentId)
        .single();

      if (error || !document) {
        console.error('Error fetching document:', error);
        return null;
      }

      return {
        id: document.id,
        proposalId: document.proposal_id,
        url: document.url,
        docType: document.doc_type,
        fileName: document.file_name,
        fileSize: document.file_size,
        uploadedBy: document.created_by,
        uploadedAt: document.created_at,
        isRequired: document.is_required,
      };
    } catch (error) {
      console.error('Unexpected error in getProposalDocument:', error);
      return null;
    }
  }
}
