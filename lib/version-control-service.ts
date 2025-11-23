/**
 * Version Control Service
 * 
 * Manages document versions and rollback functionality including:
 * - Version creation on document saves
 * - Version history retrieval
 * - Version content retrieval
 * - Rollback to previous versions
 * - Version comparison
 */

import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import type { DocumentVersion, JSONContent, Document } from '@/types/document'
import { broadcastRollbackNotification } from '@/lib/realtime-server-helpers'
import { sendRollbackNotificationEmail } from '@/lib/email'

/**
 * Validation Schemas
 */

const CreateVersionInputSchema = z.object({
  documentId: z.string().uuid('Invalid document ID'),
  content: z.any(), // JSONContent validation is complex, handled separately
  userId: z.string().uuid('Invalid user ID'),
  changesSummary: z.string().optional(),
})

const RollbackInputSchema = z.object({
  documentId: z.string().uuid('Invalid document ID'),
  versionId: z.string().uuid('Invalid version ID'),
  userId: z.string().uuid('Invalid user ID'),
})

const CompareVersionsInputSchema = z.object({
  versionId1: z.string().uuid('Invalid version ID'),
  versionId2: z.string().uuid('Invalid version ID'),
})

/**
 * Input and Output Types
 */

export interface CreateVersionInput {
  documentId: string
  content: JSONContent
  userId: string
  changesSummary?: string
}

export interface RollbackInput {
  documentId: string
  versionId: string
  userId: string
}

export interface CompareVersionsInput {
  versionId1: string
  versionId2: string
}

export interface VersionDiff {
  additions: number
  deletions: number
  changes: DiffChange[]
}

export interface DiffChange {
  path: string
  type: 'added' | 'removed' | 'modified'
  oldValue?: any
  newValue?: any
}

export interface VersionControlServiceResult<T> {
  success: boolean
  data?: T
  error?: string
}

/**
 * Version Control Service Class
 * Manages all version control operations
 */
export class VersionControlService {
  /**
   * Create a new version of a document
   * Automatically assigns the next version number
   * 
   * @param input - Version creation parameters
   * @returns Created version or error
   */
  async createVersion(
    input: CreateVersionInput
  ): Promise<VersionControlServiceResult<DocumentVersion>> {
    try {
      // Validate input
      const validated = CreateVersionInputSchema.parse(input)

      const supabase = await createClient()

      // Check if user has editor or owner permissions
      const { data: hasPermission } = await supabase
        .rpc('has_document_permission', {
          p_document_id: validated.documentId,
          p_user_id: validated.userId,
          p_required_role: 'editor'
        })

      if (!hasPermission) {
        return {
          success: false,
          error: 'Insufficient permissions to create version',
        }
      }

      // Get next version number
      const { data: nextVersionNumber, error: versionError } = await supabase
        .rpc('get_next_version_number', {
          p_document_id: validated.documentId
        })

      if (versionError || nextVersionNumber === null) {
        console.error('Failed to get next version number:', versionError)
        return {
          success: false,
          error: 'Failed to generate version number',
        }
      }

      // Generate changes summary if not provided
      const changesSummary = validated.changesSummary || this.generateChangesSummary(validated.content)

      // Create version
      const { data: version, error: createError } = await supabase
        .from('document_versions')
        .insert({
          document_id: validated.documentId,
          version_number: nextVersionNumber,
          content: validated.content,
          created_by: validated.userId,
          changes_summary: changesSummary,
          is_rollback: false,
        })
        .select()
        .single()

      if (createError || !version) {
        console.error('Failed to create version:', createError)
        return {
          success: false,
          error: `Failed to create version: ${createError?.message || 'Unknown error'}`,
        }
      }

      // Transform database response to DocumentVersion type
      const result: DocumentVersion = {
        id: version.id,
        documentId: version.document_id,
        versionNumber: version.version_number,
        content: version.content as JSONContent,
        createdBy: version.created_by,
        changesSummary: version.changes_summary,
        isRollback: version.is_rollback,
        rolledBackFrom: version.rolled_back_from,
        createdAt: version.created_at,
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

      console.error('Error in createVersion:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      }
    }
  }

  /**
   * Get version history for a document
   * Returns all versions ordered by version number (newest first)
   * 
   * @param documentId - Document ID
   * @param userId - User ID for permission check
   * @returns Array of versions or error
   */
  async getVersionHistory(
    documentId: string,
    userId: string
  ): Promise<VersionControlServiceResult<DocumentVersion[]>> {
    try {
      // Validate IDs
      z.string().uuid().parse(documentId)
      z.string().uuid().parse(userId)

      const supabase = await createClient()

      // Check if user has access to the document
      const { data: hasPermission } = await supabase
        .rpc('has_document_permission', {
          p_document_id: documentId,
          p_user_id: userId,
          p_required_role: 'viewer'
        })

      if (!hasPermission) {
        return {
          success: false,
          error: 'Insufficient permissions to view version history',
        }
      }

      // Get all versions for the document
      const { data: versions, error } = await supabase
        .from('document_versions')
        .select('*')
        .eq('document_id', documentId)
        .order('version_number', { ascending: false })

      if (error) {
        console.error('Failed to get version history:', error)
        return {
          success: false,
          error: error.message || 'Failed to retrieve version history',
        }
      }

      // Transform database response to DocumentVersion array
      const results: DocumentVersion[] = (versions || []).map(v => ({
        id: v.id,
        documentId: v.document_id,
        versionNumber: v.version_number,
        content: v.content as JSONContent,
        createdBy: v.created_by,
        changesSummary: v.changes_summary,
        isRollback: v.is_rollback,
        rolledBackFrom: v.rolled_back_from,
        createdAt: v.created_at,
      }))

      return {
        success: true,
        data: results,
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          success: false,
          error: 'Invalid document ID or user ID',
        }
      }

      console.error('Error in getVersionHistory:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      }
    }
  }

  /**
   * Get a specific version by ID
   * 
   * @param versionId - Version ID
   * @param userId - User ID for permission check
   * @returns Version or error
   */
  async getVersion(
    versionId: string,
    userId: string
  ): Promise<VersionControlServiceResult<DocumentVersion>> {
    try {
      // Validate IDs
      z.string().uuid().parse(versionId)
      z.string().uuid().parse(userId)

      const supabase = await createClient()

      // Get version
      const { data: version, error } = await supabase
        .from('document_versions')
        .select('*')
        .eq('id', versionId)
        .single()

      if (error || !version) {
        return {
          success: false,
          error: 'Version not found or access denied',
        }
      }

      // Check if user has access to the document
      const { data: hasPermission } = await supabase
        .rpc('has_document_permission', {
          p_document_id: version.document_id,
          p_user_id: userId,
          p_required_role: 'viewer'
        })

      if (!hasPermission) {
        return {
          success: false,
          error: 'Insufficient permissions to view version',
        }
      }

      // Transform database response to DocumentVersion type
      const result: DocumentVersion = {
        id: version.id,
        documentId: version.document_id,
        versionNumber: version.version_number,
        content: version.content as JSONContent,
        createdBy: version.created_by,
        changesSummary: version.changes_summary,
        isRollback: version.is_rollback,
        rolledBackFrom: version.rolled_back_from,
        createdAt: version.created_at,
      }

      return {
        success: true,
        data: result,
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          success: false,
          error: 'Invalid version ID or user ID',
        }
      }

      console.error('Error in getVersion:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      }
    }
  }

  /**
   * Rollback a document to a previous version
   * Creates a new version with content from the selected historical version
   * Preserves all version history
   * 
   * @param input - Rollback parameters
   * @returns Updated document or error
   */
  async rollbackToVersion(
    input: RollbackInput
  ): Promise<VersionControlServiceResult<Document>> {
    try {
      // Validate input
      const validated = RollbackInputSchema.parse(input)

      const supabase = await createClient()

      // Check if user has editor or owner permissions
      const { data: hasPermission } = await supabase
        .rpc('has_document_permission', {
          p_document_id: validated.documentId,
          p_user_id: validated.userId,
          p_required_role: 'editor'
        })

      if (!hasPermission) {
        return {
          success: false,
          error: 'Insufficient permissions to rollback document',
        }
      }

      // Get the version to rollback to
      const { data: targetVersion, error: versionError } = await supabase
        .from('document_versions')
        .select('*')
        .eq('id', validated.versionId)
        .eq('document_id', validated.documentId)
        .single()

      if (versionError || !targetVersion) {
        return {
          success: false,
          error: 'Version not found or does not belong to this document',
        }
      }

      // Update the document with the content from the target version
      const { data: updatedDocument, error: updateError } = await supabase
        .from('documents')
        .update({
          content: targetVersion.content,
          last_edited_by: validated.userId,
        })
        .eq('id', validated.documentId)
        .select()
        .single()

      if (updateError || !updatedDocument) {
        console.error('Failed to update document:', updateError)
        return {
          success: false,
          error: updateError?.message || 'Failed to rollback document',
        }
      }

      // Get next version number
      const { data: nextVersionNumber, error: nextVersionError } = await supabase
        .rpc('get_next_version_number', {
          p_document_id: validated.documentId
        })

      if (nextVersionError || nextVersionNumber === null) {
        console.error('Failed to get next version number:', nextVersionError)
        return {
          success: false,
          error: 'Failed to generate version number for rollback',
        }
      }

      // Create a new version marking this as a rollback
      const { error: createVersionError } = await supabase
        .from('document_versions')
        .insert({
          document_id: validated.documentId,
          version_number: nextVersionNumber,
          content: targetVersion.content,
          created_by: validated.userId,
          changes_summary: `Rolled back to version ${targetVersion.version_number}`,
          is_rollback: true,
          rolled_back_from: validated.versionId,
        })

      if (createVersionError) {
        console.error('Failed to create rollback version:', createVersionError)
        // Don't fail the operation if version creation fails
        // The document has already been updated
      }

      // Get user details for notification
      const { data: { user } } = await supabase.auth.admin.getUserById(validated.userId)
      const userName = user?.user_metadata?.full_name || user?.email || 'Unknown User'

      // Broadcast rollback notification via Realtime
      await broadcastRollbackNotification(
        validated.documentId,
        validated.versionId,
        targetVersion.version_number,
        validated.userId,
        userName
      )

      // Get document details for email
      const { data: document } = await supabase
        .from('documents')
        .select('title')
        .eq('id', validated.documentId)
        .single()

      // Send email notifications to all active collaborators
      if (document) {
        const { data: collaborators } = await supabase
          .from('document_collaborators')
          .select('user_id')
          .eq('document_id', validated.documentId)
          .neq('user_id', validated.userId) // Don't email the person who did the rollback

        if (collaborators && collaborators.length > 0) {
          const documentUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/editor/${validated.documentId}`

          // Send email to each collaborator
          for (const collaborator of collaborators) {
            const { data: { user: collabUser } } = await supabase.auth.admin.getUserById(collaborator.user_id)
            
            if (collabUser?.email) {
              const collabUserName = collabUser.user_metadata?.full_name || collabUser.email
              
              await sendRollbackNotificationEmail({
                userName: collabUserName,
                userEmail: collabUser.email,
                documentTitle: document.title,
                versionNumber: targetVersion.version_number,
                rolledBackBy: userName,
                documentUrl,
              }).catch(error => {
                // Log email errors but don't fail the rollback operation
                console.error('Failed to send rollback notification email:', error)
              })
            }
          }
        }
      }

      // Transform database response to Document type
      const result: Document = {
        id: updatedDocument.id,
        workspaceId: updatedDocument.workspace_id,
        title: updatedDocument.title,
        description: updatedDocument.description,
        content: updatedDocument.content as JSONContent,
        createdBy: updatedDocument.created_by,
        lastEditedBy: updatedDocument.last_edited_by,
        createdAt: updatedDocument.created_at,
        updatedAt: updatedDocument.updated_at,
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

      console.error('Error in rollbackToVersion:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      }
    }
  }

  /**
   * Compare two versions and return the differences
   * 
   * @param input - Comparison parameters
   * @returns Version diff or error
   */
  async compareVersions(
    input: CompareVersionsInput
  ): Promise<VersionControlServiceResult<VersionDiff>> {
    try {
      // Validate input
      const validated = CompareVersionsInputSchema.parse(input)

      const supabase = await createClient()

      // Get both versions
      const { data: versions, error } = await supabase
        .from('document_versions')
        .select('*')
        .in('id', [validated.versionId1, validated.versionId2])

      if (error || !versions || versions.length !== 2) {
        return {
          success: false,
          error: 'One or both versions not found',
        }
      }

      // Ensure versions belong to the same document
      if (versions[0].document_id !== versions[1].document_id) {
        return {
          success: false,
          error: 'Versions belong to different documents',
        }
      }

      // Find which version is older
      const [olderVersion, newerVersion] = versions[0].version_number < versions[1].version_number
        ? [versions[0], versions[1]]
        : [versions[1], versions[0]]

      // Calculate diff
      const diff = this.calculateDiff(
        olderVersion.content as JSONContent,
        newerVersion.content as JSONContent
      )

      return {
        success: true,
        data: diff,
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return {
          success: false,
          error: error.issues.map((e: z.ZodIssue) => e.message).join(', '),
        }
      }

      console.error('Error in compareVersions:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      }
    }
  }

  /**
   * Generate a summary of changes from document content
   * This is a simple implementation that counts content nodes
   * 
   * @param content - Document content
   * @returns Changes summary string
   */
  private generateChangesSummary(content: JSONContent): string {
    const nodeCount = this.countNodes(content)
    const textLength = this.countTextLength(content)
    
    return `Document updated: ${nodeCount} nodes, ${textLength} characters`
  }

  /**
   * Count total nodes in JSONContent
   */
  private countNodes(content: JSONContent): number {
    let count = 1 // Count current node
    
    if (content.content && Array.isArray(content.content)) {
      for (const child of content.content) {
        count += this.countNodes(child)
      }
    }
    
    return count
  }

  /**
   * Count total text length in JSONContent
   */
  private countTextLength(content: JSONContent): number {
    let length = 0
    
    if (content.text) {
      length += content.text.length
    }
    
    if (content.content && Array.isArray(content.content)) {
      for (const child of content.content) {
        length += this.countTextLength(child)
      }
    }
    
    return length
  }

  /**
   * Calculate differences between two JSONContent objects
   * This is a simplified implementation
   * 
   * @param oldContent - Old version content
   * @param newContent - New version content
   * @returns Version diff
   */
  private calculateDiff(oldContent: JSONContent, newContent: JSONContent): VersionDiff {
    const changes: DiffChange[] = []
    let additions = 0
    let deletions = 0

    // Simple comparison at root level
    const oldStr = JSON.stringify(oldContent)
    const newStr = JSON.stringify(newContent)

    if (oldStr !== newStr) {
      const oldLength = this.countTextLength(oldContent)
      const newLength = this.countTextLength(newContent)

      if (newLength > oldLength) {
        additions = newLength - oldLength
        changes.push({
          path: 'content',
          type: 'added',
          newValue: `${additions} characters added`,
        })
      } else if (newLength < oldLength) {
        deletions = oldLength - newLength
        changes.push({
          path: 'content',
          type: 'removed',
          oldValue: `${deletions} characters removed`,
        })
      } else {
        changes.push({
          path: 'content',
          type: 'modified',
          oldValue: 'Content modified',
          newValue: 'Content modified',
        })
      }
    }

    return {
      additions,
      deletions,
      changes,
    }
  }
}