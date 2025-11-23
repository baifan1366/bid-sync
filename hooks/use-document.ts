/**
 * Custom hooks for document operations
 * 
 * Provides hooks for fetching, updating, and managing documents.
 * 
 * Requirements: 1.2, 1.5, 7.1, 7.5
 */

'use client'

import { useCallback } from 'react'
import { useGraphQLQuery, useGraphQLMutation } from './use-graphql'
import {
  GET_DOCUMENT,
  LIST_DOCUMENTS,
  SEARCH_DOCUMENTS,
  GET_WORKSPACE,
  GET_WORKSPACE_BY_PROJECT,
} from '@/lib/graphql/queries'
import {
  CREATE_WORKSPACE,
  CREATE_DOCUMENT,
  UPDATE_DOCUMENT,
  DELETE_DOCUMENT,
} from '@/lib/graphql/mutations'
import type {
  Document,
  Workspace,
  CreateDocumentInput,
  UpdateDocumentInput,
  CreateWorkspaceInput,
  DocumentResponse,
  WorkspaceResponse,
} from '@/types/document'

// ============================================================================
// Document Hooks
// ============================================================================

/**
 * Hook for fetching a single document
 * Requirement 1.2: Document retrieval
 */
export function useDocument(documentId: string | null, options?: { enabled?: boolean }) {
  return useGraphQLQuery<{ document: Document }>(
    ['document', documentId || ''],
    GET_DOCUMENT,
    { id: documentId },
    {
      enabled: options?.enabled !== false && !!documentId,
      staleTime: 30000, // 30 seconds
    }
  )
}

/**
 * Hook for listing documents in a workspace
 * Requirement 7.1: Workspace document listing
 */
export function useDocuments(workspaceId: string | null, options?: { enabled?: boolean }) {
  return useGraphQLQuery<{ listDocuments: Document[] }>(
    ['documents', workspaceId || ''],
    LIST_DOCUMENTS,
    { workspaceId },
    {
      enabled: options?.enabled !== false && !!workspaceId,
      staleTime: 60000, // 1 minute
    }
  )
}

/**
 * Hook for searching documents
 * Requirement 7.5: Document search
 */
export function useDocumentSearch(
  workspaceId: string | null,
  query: string,
  options?: { enabled?: boolean }
) {
  return useGraphQLQuery<{ searchDocuments: Document[] }>(
    ['documents', 'search', workspaceId || '', query],
    SEARCH_DOCUMENTS,
    { workspaceId, query },
    {
      enabled: options?.enabled !== false && !!workspaceId && query.length > 0,
      staleTime: 30000, // 30 seconds
    }
  )
}

/**
 * Hook for creating a document
 * Requirement 1.2: Document creation
 */
export function useCreateDocument() {
  return useGraphQLMutation<
    { createDocument: DocumentResponse },
    { input: CreateDocumentInput }
  >(
    CREATE_DOCUMENT,
    [['documents']] // Invalidate all document queries
  )
}

/**
 * Hook for updating a document
 * Requirement 1.5: Document updates
 */
export function useUpdateDocument() {
  return useGraphQLMutation<
    { updateDocument: DocumentResponse },
    { documentId: string; input: UpdateDocumentInput }
  >(
    UPDATE_DOCUMENT,
    [['documents'], ['document']] // Invalidate document queries
  )
}

/**
 * Hook for deleting a document
 */
export function useDeleteDocument() {
  return useGraphQLMutation<
    { deleteDocument: boolean },
    { documentId: string }
  >(
    DELETE_DOCUMENT,
    [['documents']] // Invalidate all document queries
  )
}

// ============================================================================
// Workspace Hooks
// ============================================================================

/**
 * Hook for fetching a workspace
 */
export function useWorkspace(workspaceId: string | null, options?: { enabled?: boolean }) {
  return useGraphQLQuery<{ workspace: Workspace }>(
    ['workspace', workspaceId || ''],
    GET_WORKSPACE,
    { id: workspaceId },
    {
      enabled: options?.enabled !== false && !!workspaceId,
      staleTime: 60000, // 1 minute
    }
  )
}

/**
 * Hook for fetching a workspace by project ID
 * Requirement 7.1: Workspace access
 */
export function useWorkspaceByProject(projectId: string | null, options?: { enabled?: boolean }) {
  return useGraphQLQuery<{ workspaceByProject: Workspace }>(
    ['workspace', 'project', projectId || ''],
    GET_WORKSPACE_BY_PROJECT,
    { projectId },
    {
      enabled: options?.enabled !== false && !!projectId,
      staleTime: 60000, // 1 minute
    }
  )
}

/**
 * Hook for creating a workspace
 */
export function useCreateWorkspace() {
  return useGraphQLMutation<
    { createWorkspace: Workspace },
    { input: CreateWorkspaceInput }
  >(
    CREATE_WORKSPACE,
    [['workspace']] // Invalidate workspace queries
  )
}

// ============================================================================
// Composite Hooks
// ============================================================================

/**
 * Hook for managing a document with all operations
 * Provides a complete interface for document management
 */
export function useDocumentManager(documentId: string | null) {
  const { data: documentData, isLoading, error, refetch } = useDocument(documentId)
  const updateMutation = useUpdateDocument()
  const deleteMutation = useDeleteDocument()

  const document = documentData?.document

  const updateDocument = useCallback(
    async (input: UpdateDocumentInput) => {
      if (!documentId) {
        throw new Error('Document ID is required')
      }

      const result = await updateMutation.mutateAsync({
        documentId,
        input,
      })

      if (!result.updateDocument.success) {
        throw new Error(result.updateDocument.error || 'Failed to update document')
      }

      return result.updateDocument.document
    },
    [documentId, updateMutation]
  )

  const deleteDocument = useCallback(async () => {
    if (!documentId) {
      throw new Error('Document ID is required')
    }

    await deleteMutation.mutateAsync({ documentId })
  }, [documentId, deleteMutation])

  return {
    document,
    isLoading,
    error,
    refetch,
    updateDocument,
    deleteDocument,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  }
}

/**
 * Hook for managing workspace documents
 * Provides search and list functionality
 */
export function useWorkspaceDocuments(workspaceId: string | null) {
  const { data: documentsData, isLoading, error, refetch } = useDocuments(workspaceId)
  const createMutation = useCreateDocument()

  const documents = documentsData?.listDocuments || []

  const createDocument = useCallback(
    async (input: Omit<CreateDocumentInput, 'workspaceId'>) => {
      if (!workspaceId) {
        throw new Error('Workspace ID is required')
      }

      const result = await createMutation.mutateAsync({
        input: {
          ...input,
          workspaceId,
        },
      })

      if (!result.createDocument.success) {
        throw new Error(result.createDocument.error || 'Failed to create document')
      }

      return result.createDocument.document
    },
    [workspaceId, createMutation]
  )

  return {
    documents,
    isLoading,
    error,
    refetch,
    createDocument,
    isCreating: createMutation.isPending,
  }
}
