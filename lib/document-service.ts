/**
 * Document Service
 * 
 * Handles CRUD operations for proposal documents including:
 * - Document creation with automatic owner assignment
 * - Document retrieval with permission checks
 * - Document updates with validation
 * - Document deletion with cascading cleanup
 * - Document listing and search functionality
 */

import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import type { Document, JSONContent } from '@/types/document'

/**
 * Validation Schemas
 */

// JSONContent schema for TipTap editor content
const JSONContentSchema: z.ZodType<JSONContent> = z.lazy(() =>
  z.object({
    type: z.string().optional(),
    attrs: z.record(z.string(), z.any()).optional(),
    content: z.array(JSONContentSchema).optional(),
    marks: z.array(
      z.object({
        type: z.string(),
        attrs: z.record(z.string(), z.any()).optional(),
      }).passthrough()
    ).optional(),
    text: z.string().optional(),
  }).passthrough()
)

const CreateDocumentInputSchema = z.object({
  workspaceId: z.string().uuid('Invalid workspace ID'),
  title: z.string()
    .min(1, 'Title is required')
    .max(200, 'Title must be 200 characters or less'),
  description: z.string()
    .max(1000, 'Description must be 1000 characters or less')
    .optional(),
  createdBy: z.string().uuid('Invalid user ID'),
})

const UpdateDocumentInputSchema = z.object({
  documentId: z.string().uuid('Invalid document ID'),
  content: JSONContentSchema,
  userId: z.string().uuid('Invalid user ID'),
})

const UpdateDocumentMetadataSchema = z.object({
  documentId: z.string().uuid('Invalid document ID'),
  title: z.string()
    .min(1, 'Title is required')
    .max(200, 'Title must be 200 characters or less')
    .optional(),
  description: z.string()
    .max(1000, 'Description must be 1000 characters or less')
    .optional(),
  userId: z.string().uuid('Invalid user ID'),
})

const SearchDocumentsInputSchema = z.object({
  query: z.string().min(1, 'Search query is required'),
  workspaceId: z.string().uuid('Invalid workspace ID'),
  userId: z.string().uuid('Invalid user ID'),
})

/**
 * Input and Output Types
 */

export interface CreateDocumentInput {
  workspaceId: string
  title: string
  description?: string
  createdBy: string
}

export interface UpdateDocumentInput {
  documentId: string
  content: JSONContent
  userId: string
}

export interface UpdateDocumentMetadataInput {
  documentId: string
  title?: string
  description?: string
  userId: string
}

export interface SearchDocumentsInput {
  query: string
  workspaceId: string
  userId: string
}

export interface DocumentServiceResult<T> {
  success: boolean
  data?: T
  error?: string
}

/**
 * Document Service Class
 * Manages all document-related operations
 */
export class DocumentService {
  /**
   * Create a new document
   * Automatically assigns creator as owner via database trigger
   * 
   * @param input - Document creation parameters
   * @returns Created document or error
   */
  async createDocument(
    input: CreateDocumentInput
  ): Promise<DocumentServiceResult<Document>> {
    try {
      // Validate input
      const validated = CreateDocumentInputSchema.parse(input)

      const supabase = await createClient()

      // Verify workspace exists and user has access
      const { data: workspace, error: workspaceError } = await supabase
        .from('workspaces')
        .select('id, lead_id')
        .eq('id', validated.workspaceId)
        .single()

      if (workspaceError || !workspace) {
        return {
          success: false,
          error: 'Workspace not found or access denied',
        }
      }

      // Create document with initial empty content
      const { data: document, error: createError } = await supabase
        .from('documents')
        .insert({
          workspace_id: validated.workspaceId,
          title: validated.title,
          description: validated.description,
          content: {},
          created_by: validated.createdBy,
          last_edited_by: validated.createdBy,
        })
        .select()
        .single()

      if (createError || !document) {
        console.error('Failed to create document:', createError)
        return {
          success: false,
          error: `Failed to create document: ${createError?.message || 'Unknown error'}`,
        }
      }

      // Transform database response to Document type
      const result: Document = {
        id: document.id,
        workspaceId: document.workspace_id,
        title: document.title,
        description: document.description,
        content: document.content as JSONContent,
        createdBy: document.created_by,
        lastEditedBy: document.last_edited_by,
        createdAt: document.created_at,
        updatedAt: document.updated_at,
      }

      return {
        success: true,
        data: result,
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          success: false,
          error: error.issues.map((e: z.ZodIssue) => e.message).join(', '),
        }
      }

      console.error('Error in createDocument:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      }
    }
  }

  /**
   * Get a document by ID
   * Checks user permissions via RLS policies
   * 
   * @param documentId - Document ID
   * @param userId - User ID for permission check
   * @returns Document or error
   */
  async getDocument(
    documentId: string,
    userId: string
  ): Promise<DocumentServiceResult<Document>> {
    try {
      // Validate IDs
      z.string().uuid().parse(documentId)
      z.string().uuid().parse(userId)

      const supabase = await createClient()

      const { data: document, error } = await supabase
        .from('documents')
        .select('*')
        .eq('id', documentId)
        .single()

      if (error || !document) {
        return {
          success: false,
          error: 'Document not found or access denied',
        }
      }

      // Transform database response to Document type
      const result: Document = {
        id: document.id,
        workspaceId: document.workspace_id,
        title: document.title,
        description: document.description,
        content: document.content as JSONContent,
        createdBy: document.created_by,
        lastEditedBy: document.last_edited_by,
        createdAt: document.created_at,
        updatedAt: document.updated_at,
      }

      return {
        success: true,
        data: result,
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          success: false,
          error: 'Invalid document ID or user ID',
        }
      }

      console.error('Error in getDocument:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      }
    }
  }

  /**
   * Update document content
   * Requires editor or owner role (enforced by RLS)
   * 
   * @param input - Update parameters
   * @returns Updated document or error
   */
  async updateDocument(
    input: UpdateDocumentInput
  ): Promise<DocumentServiceResult<Document>> {
    try {
      // Validate input
      const validated = UpdateDocumentInputSchema.parse(input)

      const supabase = await createClient()

      // Update document content
      const { data: document, error: updateError } = await supabase
        .from('documents')
        .update({
          content: validated.content,
          last_edited_by: validated.userId,
        })
        .eq('id', validated.documentId)
        .select()
        .single()

      if (updateError || !document) {
        console.error('Failed to update document:', updateError)
        return {
          success: false,
          error: updateError?.message || 'Failed to update document or insufficient permissions',
        }
      }

      // Transform database response to Document type
      const result: Document = {
        id: document.id,
        workspaceId: document.workspace_id,
        title: document.title,
        description: document.description,
        content: document.content as JSONContent,
        createdBy: document.created_by,
        lastEditedBy: document.last_edited_by,
        createdAt: document.created_at,
        updatedAt: document.updated_at,
      }

      return {
        success: true,
        data: result,
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          success: false,
          error: error.issues.map((e: z.ZodIssue) => e.message).join(', '),
        }
      }

      console.error('Error in updateDocument:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      }
    }
  }

  /**
   * Update document metadata (title, description)
   * Requires editor or owner role (enforced by RLS)
   * 
   * @param input - Update parameters
   * @returns Updated document or error
   */
  async updateDocumentMetadata(
    input: UpdateDocumentMetadataInput
  ): Promise<DocumentServiceResult<Document>> {
    try {
      // Validate input
      const validated = UpdateDocumentMetadataSchema.parse(input)

      const supabase = await createClient()

      // Build update object with only provided fields
      const updateData: any = {
        last_edited_by: validated.userId,
      }

      if (validated.title !== undefined) {
        updateData.title = validated.title
      }

      if (validated.description !== undefined) {
        updateData.description = validated.description
      }

      // Update document metadata
      const { data: document, error: updateError } = await supabase
        .from('documents')
        .update(updateData)
        .eq('id', validated.documentId)
        .select()
        .single()

      if (updateError || !document) {
        console.error('Failed to update document metadata:', updateError)
        return {
          success: false,
          error: updateError?.message || 'Failed to update document or insufficient permissions',
        }
      }

      // Transform database response to Document type
      const result: Document = {
        id: document.id,
        workspaceId: document.workspace_id,
        title: document.title,
        description: document.description,
        content: document.content as JSONContent,
        createdBy: document.created_by,
        lastEditedBy: document.last_edited_by,
        createdAt: document.created_at,
        updatedAt: document.updated_at,
      }

      return {
        success: true,
        data: result,
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          success: false,
          error: error.issues.map((e: z.ZodIssue) => e.message).join(', '),
        }
      }

      console.error('Error in updateDocumentMetadata:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      }
    }
  }

  /**
   * Delete a document
   * Requires owner role (enforced by RLS)
   * Cascades to versions, collaborators, sessions, and invitations
   * 
   * @param documentId - Document ID
   * @param userId - User ID for permission check
   * @returns Success status or error
   */
  async deleteDocument(
    documentId: string,
    userId: string
  ): Promise<DocumentServiceResult<boolean>> {
    try {
      // Validate IDs
      z.string().uuid().parse(documentId)
      z.string().uuid().parse(userId)

      const supabase = await createClient()

      // Delete document (RLS ensures only owner can delete)
      const { error: deleteError } = await supabase
        .from('documents')
        .delete()
        .eq('id', documentId)

      if (deleteError) {
        console.error('Failed to delete document:', deleteError)
        return {
          success: false,
          error: deleteError.message || 'Failed to delete document or insufficient permissions',
        }
      }

      return {
        success: true,
        data: true,
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          success: false,
          error: 'Invalid document ID or user ID',
        }
      }

      console.error('Error in deleteDocument:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      }
    }
  }

  /**
   * List all documents in a workspace
   * Returns only documents the user has access to (via RLS)
   * 
   * @param workspaceId - Workspace ID
   * @param userId - User ID for permission check
   * @returns Array of documents or error
   */
  async listDocuments(
    workspaceId: string,
    userId: string
  ): Promise<DocumentServiceResult<Document[]>> {
    try {
      // Validate IDs
      z.string().uuid().parse(workspaceId)
      z.string().uuid().parse(userId)

      const supabase = await createClient()

      const { data: documents, error } = await supabase
        .from('documents')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('updated_at', { ascending: false })

      if (error) {
        console.error('Failed to list documents:', error)
        return {
          success: false,
          error: error.message || 'Failed to list documents',
        }
      }

      // Transform database response to Document array
      const results: Document[] = (documents || []).map(doc => ({
        id: doc.id,
        workspaceId: doc.workspace_id,
        title: doc.title,
        description: doc.description,
        content: doc.content as JSONContent,
        createdBy: doc.created_by,
        lastEditedBy: doc.last_edited_by,
        createdAt: doc.created_at,
        updatedAt: doc.updated_at,
      }))

      return {
        success: true,
        data: results,
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          success: false,
          error: 'Invalid workspace ID or user ID',
        }
      }

      console.error('Error in listDocuments:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      }
    }
  }

  /**
   * Search documents by title, content, or collaborator names
   * Uses PostgreSQL full-text search
   * 
   * @param input - Search parameters
   * @returns Array of matching documents or error
   */
  async searchDocuments(
    input: SearchDocumentsInput
  ): Promise<DocumentServiceResult<Document[]>> {
    try {
      // Validate input
      const validated = SearchDocumentsInputSchema.parse(input)

      const supabase = await createClient()

      // Sanitize search query for PostgreSQL full-text search
      const sanitizedQuery = validated.query
        .trim()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 0)
        .join(' & ')

      if (!sanitizedQuery) {
        return {
          success: true,
          data: [],
        }
      }

      // Search in title and content using full-text search
      const { data: documents, error } = await supabase
        .from('documents')
        .select(`
          *,
          document_collaborators!inner(user_id)
        `)
        .eq('workspace_id', validated.workspaceId)
        .or(`
          to_tsvector('english', title).@@.to_tsquery('english', '${sanitizedQuery}'),
          to_tsvector('english', content::text).@@.to_tsquery('english', '${sanitizedQuery}')
        `)
        .order('updated_at', { ascending: false })

      if (error) {
        console.error('Failed to search documents:', error)
        return {
          success: false,
          error: error.message || 'Failed to search documents',
        }
      }

      // Remove duplicates and transform to Document array
      const uniqueDocuments = new Map<string, any>()
      documents?.forEach(doc => {
        if (!uniqueDocuments.has(doc.id)) {
          uniqueDocuments.set(doc.id, doc)
        }
      })

      const results: Document[] = Array.from(uniqueDocuments.values()).map(doc => ({
        id: doc.id,
        workspaceId: doc.workspace_id,
        title: doc.title,
        description: doc.description,
        content: doc.content as JSONContent,
        createdBy: doc.created_by,
        lastEditedBy: doc.last_edited_by,
        createdAt: doc.created_at,
        updatedAt: doc.updated_at,
      }))

      return {
        success: true,
        data: results,
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          success: false,
          error: error.issues.map((e: z.ZodIssue) => e.message).join(', '),
        }
      }

      console.error('Error in searchDocuments:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        }
    }
  }
}
