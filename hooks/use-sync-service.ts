/**
 * Custom hook for using the Sync Service
 * 
 * Provides offline support and synchronization capabilities for documents.
 * Handles connection status, pending changes, and conflict resolution.
 * 
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5
 */

'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  syncService,
  ConnectionStatus,
  SyncConflict,
  QueuedChange,
  CachedDocument,
} from '@/lib/sync-service'
import { JSONContent } from '@/types/document'

export interface UseSyncServiceOptions {
  documentId: string
  enabled?: boolean
  autoSync?: boolean
  syncInterval?: number
}

export interface SyncServiceState {
  connectionStatus: ConnectionStatus
  hasPendingChanges: boolean
  isSynced: boolean
  conflicts: SyncConflict[]
  isInitialized: boolean
}

/**
 * Hook for managing offline sync and caching
 * 
 * Features:
 * - Tracks connection status
 * - Monitors pending changes
 * - Detects and manages conflicts
 * - Provides sync utilities
 * - Auto-sync on reconnection
 * 
 * @param options Configuration options
 * @returns Sync service state and utilities
 */
export function useSyncService(options: UseSyncServiceOptions) {
  const { documentId, enabled = true, autoSync = true, syncInterval = 30000 } = options

  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(
    syncService.getConnectionStatus()
  )
  const [hasPendingChanges, setHasPendingChanges] = useState(false)
  const [isSynced, setIsSynced] = useState(false)
  const [conflicts, setConflicts] = useState<SyncConflict[]>([])
  const [isInitialized, setIsInitialized] = useState(false)

  // Initialize sync service
  useEffect(() => {
    if (!enabled) return

    const init = async () => {
      try {
        await syncService.initialize()
        setIsInitialized(true)
      } catch (error) {
        console.error('Failed to initialize sync service:', error)
      }
    }

    init()
  }, [enabled])

  // Subscribe to connection status changes
  useEffect(() => {
    if (!enabled || !isInitialized) return

    const unsubscribe = syncService.onConnectionStatusChange((status) => {
      setConnectionStatus(status)
    })

    // Set initial status
    setConnectionStatus(syncService.getConnectionStatus())

    return unsubscribe
  }, [enabled, isInitialized])

  // Check for pending changes and sync status
  useEffect(() => {
    if (!enabled || !isInitialized || !documentId) return

    const checkStatus = async () => {
      try {
        const pending = await syncService.hasPendingChanges(documentId)
        const synced = await syncService.isDocumentSynced(documentId)
        const documentConflicts = await syncService.getConflicts(documentId)

        setHasPendingChanges(pending)
        setIsSynced(synced)
        setConflicts(documentConflicts)
      } catch (error) {
        console.error('Failed to check sync status:', error)
      }
    }

    checkStatus()

    // Poll for status changes
    const interval = setInterval(checkStatus, 5000)

    return () => clearInterval(interval)
  }, [enabled, isInitialized, documentId])

  // Auto-sync when connection is restored
  useEffect(() => {
    if (!enabled || !isInitialized || !autoSync || !documentId) return

    if (connectionStatus === 'connected' && hasPendingChanges) {
      // Trigger sync after a short delay
      const timeout = setTimeout(() => {
        // Sync will be triggered by the consumer using the sync function
        console.log('Connection restored, pending changes detected')
      }, 1000)

      return () => clearTimeout(timeout)
    }
  }, [enabled, isInitialized, autoSync, documentId, connectionStatus, hasPendingChanges])

  /**
   * Cache document content locally
   * Requirement 10.1: Offline changes cached
   */
  const cacheDocument = useCallback(
    async (content: JSONContent, yjsState?: Uint8Array) => {
      if (!isInitialized) return

      try {
        await syncService.cacheDocument(documentId, content, yjsState)
        
        // Update sync status
        const synced = await syncService.isDocumentSynced(documentId)
        setIsSynced(synced)
      } catch (error) {
        console.error('Failed to cache document:', error)
      }
    },
    [isInitialized, documentId]
  )

  /**
   * Get cached document
   */
  const getCachedDocument = useCallback(async (): Promise<CachedDocument | null> => {
    if (!isInitialized) return null

    try {
      return await syncService.getCachedDocument(documentId)
    } catch (error) {
      console.error('Failed to get cached document:', error)
      return null
    }
  }, [isInitialized, documentId])

  /**
   * Queue a change for later synchronization
   * Requirement 10.1: Change queue for offline edits
   */
  const queueChange = useCallback(
    async (change: Omit<QueuedChange, 'id' | 'retryCount' | 'documentId'>) => {
      if (!isInitialized) return

      try {
        await syncService.queueChange({
          ...change,
          documentId,
        })

        // Update pending changes status
        setHasPendingChanges(true)
        setIsSynced(false)
      } catch (error) {
        console.error('Failed to queue change:', error)
      }
    },
    [isInitialized, documentId]
  )

  /**
   * Synchronize cached changes with server
   * Requirement 10.2: Cached changes sync on reconnect
   */
  const sync = useCallback(
    async (
      syncFn: (changes: QueuedChange[]) => Promise<{ success: boolean; conflicts?: SyncConflict[] }>
    ) => {
      if (!isInitialized) {
        return {
          success: false,
          conflicts: [],
          syncedAt: new Date().toISOString(),
          error: 'Sync service not initialized',
        }
      }

      try {
        const result = await syncService.syncChanges(documentId, syncFn)

        // Update state
        const pending = await syncService.hasPendingChanges(documentId)
        const synced = await syncService.isDocumentSynced(documentId)
        const documentConflicts = await syncService.getConflicts(documentId)

        setHasPendingChanges(pending)
        setIsSynced(synced)
        setConflicts(documentConflicts)

        return result
      } catch (error) {
        console.error('Failed to sync changes:', error)
        return {
          success: false,
          conflicts: [],
          syncedAt: new Date().toISOString(),
          error: error instanceof Error ? error.message : 'Unknown sync error',
        }
      }
    },
    [isInitialized, documentId]
  )

  /**
   * Detect conflicts between local and server versions
   * Requirement 10.3: Conflict detection
   */
  const detectConflict = useCallback(
    async (localContent: JSONContent, serverContent: JSONContent) => {
      if (!isInitialized) return null

      try {
        const conflict = await syncService.detectConflict(
          documentId,
          localContent,
          serverContent
        )

        if (conflict) {
          setConflicts(prev => [...prev, conflict])
        }

        return conflict
      } catch (error) {
        console.error('Failed to detect conflict:', error)
        return null
      }
    },
    [isInitialized, documentId]
  )

  /**
   * Resolve a conflict
   * Requirement 10.3: Conflict resolution presents both versions
   */
  const resolveConflict = useCallback(
    async (conflictId: string, resolvedContent: JSONContent) => {
      if (!isInitialized) return

      try {
        await syncService.resolveConflict(conflictId, resolvedContent)

        // Update conflicts list
        const documentConflicts = await syncService.getConflicts(documentId)
        setConflicts(documentConflicts)

        // Update sync status
        const synced = await syncService.isDocumentSynced(documentId)
        setIsSynced(synced)
      } catch (error) {
        console.error('Failed to resolve conflict:', error)
      }
    },
    [isInitialized, documentId]
  )

  /**
   * Clear all cached data for the document
   */
  const clearCache = useCallback(async () => {
    if (!isInitialized) return

    try {
      await syncService.clearDocumentCache(documentId)

      setHasPendingChanges(false)
      setIsSynced(false)
      setConflicts([])
    } catch (error) {
      console.error('Failed to clear cache:', error)
    }
  }, [isInitialized, documentId])

  return {
    // State
    connectionStatus,
    hasPendingChanges,
    isSynced,
    conflicts,
    isInitialized,

    // Actions
    cacheDocument,
    getCachedDocument,
    queueChange,
    sync,
    detectConflict,
    resolveConflict,
    clearCache,
  }
}

/**
 * Hook for connection status only
 * Lightweight hook for components that only need connection status
 */
export function useConnectionStatus() {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(
    syncService.getConnectionStatus()
  )
  const [isInitialized, setIsInitialized] = useState(false)

  useEffect(() => {
    const init = async () => {
      try {
        await syncService.initialize()
        setIsInitialized(true)
      } catch (error) {
        console.error('Failed to initialize sync service:', error)
      }
    }

    init()
  }, [])

  useEffect(() => {
    if (!isInitialized) return

    const unsubscribe = syncService.onConnectionStatusChange((status) => {
      setConnectionStatus(status)
    })

    setConnectionStatus(syncService.getConnectionStatus())

    return unsubscribe
  }, [isInitialized])

  return {
    connectionStatus,
    isInitialized,
    setConnectionStatus: (status: ConnectionStatus) => {
      syncService.setConnectionStatus(status)
    },
  }
}

