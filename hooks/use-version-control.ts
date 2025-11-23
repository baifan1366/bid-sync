/**
 * Custom hooks for version control
 * 
 * Provides hooks for version history and rollback functionality.
 * 
 * Requirements: 5.2, 6.2
 */

'use client'

import { useCallback } from 'react'
import { useGraphQLQuery, useGraphQLMutation } from './use-graphql'
import {
  GET_VERSION_HISTORY,
  GET_VERSION,
} from '@/lib/graphql/queries'
import {
  CREATE_VERSION,
  ROLLBACK_TO_VERSION,
} from '@/lib/graphql/mutations'
import type {
  DocumentVersion,
  VersionResult,
  DocumentResponse,
} from '@/types/document'

// ============================================================================
// Version History Hooks
// ============================================================================

/**
 * Hook for fetching version history
 * Requirement 5.2: Version history display with timestamps and authors
 */
export function useVersionHistory(
  documentId: string | null,
  options?: { enabled?: boolean }
) {
  return useGraphQLQuery<{ documentVersionHistory: DocumentVersion[] }>(
    ['versionHistory', documentId || ''],
    GET_VERSION_HISTORY,
    { documentId },
    {
      enabled: options?.enabled !== false && !!documentId,
      staleTime: 30000, // 30 seconds
    }
  )
}

/**
 * Hook for fetching a specific version
 */
export function useVersion(
  versionId: string | null,
  options?: { enabled?: boolean }
) {
  return useGraphQLQuery<{ documentVersion: DocumentVersion }>(
    ['version', versionId || ''],
    GET_VERSION,
    { versionId },
    {
      enabled: options?.enabled !== false && !!versionId,
      staleTime: 60000, // 1 minute - versions don't change
    }
  )
}

/**
 * Hook for creating a new version
 */
export function useCreateVersion() {
  return useGraphQLMutation<
    { createVersion: VersionResult },
    { documentId: string; changesSummary?: string }
  >(
    CREATE_VERSION,
    [['versionHistory'], ['document']] // Invalidate version history and document
  )
}

/**
 * Hook for rolling back to a previous version
 * Requirement 6.2: Rollback creates new version
 */
export function useVersionRollback() {
  return useGraphQLMutation<
    { rollbackToVersion: DocumentResponse },
    { documentId: string; versionId: string }
  >(
    ROLLBACK_TO_VERSION,
    [['versionHistory'], ['document']] // Invalidate version history and document
  )
}

// ============================================================================
// Composite Hooks
// ============================================================================

/**
 * Hook for managing version history with rollback
 * Provides a complete interface for version control
 */
export function useVersionManager(documentId: string | null) {
  const {
    data: historyData,
    isLoading,
    error,
    refetch,
  } = useVersionHistory(documentId)

  const createMutation = useCreateVersion()
  const rollbackMutation = useVersionRollback()

  const versions = historyData?.documentVersionHistory || []

  /**
   * Create a new version
   */
  const createVersion = useCallback(
    async (changesSummary?: string) => {
      if (!documentId) {
        throw new Error('Document ID is required')
      }

      const result = await createMutation.mutateAsync({
        documentId,
        changesSummary,
      })

      if (!result.createVersion.success) {
        throw new Error(result.createVersion.error || 'Failed to create version')
      }

      return result.createVersion.version
    },
    [documentId, createMutation]
  )

  /**
   * Rollback to a specific version
   * Requirement 6.2: Rollback creates new version with content from selected version
   */
  const rollbackToVersion = useCallback(
    async (versionId: string) => {
      if (!documentId) {
        throw new Error('Document ID is required')
      }

      const result = await rollbackMutation.mutateAsync({
        documentId,
        versionId,
      })

      if (!result.rollbackToVersion.success) {
        throw new Error(
          result.rollbackToVersion.error || 'Failed to rollback to version'
        )
      }

      return result.rollbackToVersion.document
    },
    [documentId, rollbackMutation]
  )

  /**
   * Get the latest version
   */
  const latestVersion = versions.length > 0 ? versions[0] : null

  /**
   * Get a specific version by number
   */
  const getVersionByNumber = useCallback(
    (versionNumber: number) => {
      return versions.find(v => v.versionNumber === versionNumber) || null
    },
    [versions]
  )

  /**
   * Compare two versions
   */
  const compareVersions = useCallback(
    (versionNumber1: number, versionNumber2: number) => {
      const version1 = getVersionByNumber(versionNumber1)
      const version2 = getVersionByNumber(versionNumber2)

      if (!version1 || !version2) {
        return null
      }

      return {
        version1,
        version2,
        // Simple comparison - in a real app, you'd use a diff library
        isDifferent: JSON.stringify(version1.content) !== JSON.stringify(version2.content),
      }
    },
    [getVersionByNumber]
  )

  return {
    // Version history
    versions,
    latestVersion,
    isLoading,
    error,
    refetch,

    // Operations
    createVersion,
    rollbackToVersion,
    getVersionByNumber,
    compareVersions,

    // Status
    isCreating: createMutation.isPending,
    isRollingBack: rollbackMutation.isPending,
  }
}

/**
 * Hook for auto-saving versions
 * Automatically creates versions at specified intervals or on specific triggers
 */
export function useAutoVersion(
  documentId: string | null,
  options?: {
    enabled?: boolean
    intervalMs?: number
    onSave?: () => string | undefined // Returns change summary
  }
) {
  const createMutation = useCreateVersion()

  const createVersion = useCallback(
    async (changesSummary?: string) => {
      if (!documentId) {
        return
      }

      try {
        const result = await createMutation.mutateAsync({
          documentId,
          changesSummary,
        })

        if (!result.createVersion.success) {
          console.error('Failed to auto-save version:', result.createVersion.error)
        }

        return result.createVersion.version
      } catch (error) {
        console.error('Failed to auto-save version:', error)
      }
    },
    [documentId, createMutation]
  )

  return {
    createVersion,
    isCreating: createMutation.isPending,
  }
}

/**
 * Hook for version comparison
 * Provides utilities for comparing different versions
 */
export function useVersionComparison(documentId: string | null) {
  const { data } = useVersionHistory(documentId)
  const versions = data?.documentVersionHistory || []

  /**
   * Get changes between two versions
   */
  const getChangesBetween = useCallback(
    (fromVersionNumber: number, toVersionNumber: number) => {
      const fromVersion = versions.find((v: DocumentVersion) => v.versionNumber === fromVersionNumber)
      const toVersion = versions.find((v: DocumentVersion) => v.versionNumber === toVersionNumber)

      if (!fromVersion || !toVersion) {
        return null
      }

      // Collect all change summaries between versions
      const changes = versions
        .filter(
          (v: DocumentVersion) =>
            v.versionNumber > fromVersionNumber &&
            v.versionNumber <= toVersionNumber
        )
        .map((v: DocumentVersion) => ({
          versionNumber: v.versionNumber,
          summary: v.changesSummary,
          author: v.createdByName,
          timestamp: v.createdAt,
          isRollback: v.isRollback,
        }))

      return {
        fromVersion,
        toVersion,
        changes,
      }
    },
    [versions]
  )

  /**
   * Get all rollback versions
   */
  const getRollbackVersions = useCallback(() => {
    return versions.filter((v: DocumentVersion) => v.isRollback)
  }, [versions])

  /**
   * Get version timeline
   */
  const getTimeline = useCallback(() => {
    return versions.map((v: DocumentVersion) => ({
      versionNumber: v.versionNumber,
      timestamp: v.createdAt,
      author: v.createdByName,
      summary: v.changesSummary,
      isRollback: v.isRollback,
      rolledBackFrom: v.rolledBackFrom,
    }))
  }, [versions])

  return {
    getChangesBetween,
    getRollbackVersions,
    getTimeline,
  }
}
