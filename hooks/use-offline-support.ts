/**
 * Custom hooks for offline support
 * 
 * Provides hooks for connection status monitoring and offline synchronization.
 * 
 * Requirements: 10.1, 10.2, 10.4
 */

'use client'

import { useCallback } from 'react'
import { useConnectionStatus, useSyncService } from './use-sync-service'
import type {
  ConnectionStatus,
  SyncConflict,
  QueuedChange,
  JSONContent,
} from '@/types/document'

// Re-export the connection status hook for convenience
export { useConnectionStatus }

// ============================================================================
// Offline Sync Hooks
// ============================================================================

export interface UseOfflineSyncOptions {
  documentId: string
  enabled?: boolean
  autoSync?: boolean
  syncInterval?: number
}

/**
 * Hook for managing offline synchronization
 * 
 * Requirements:
 * - 10.1: Offline changes cached
 * - 10.2: Cached changes sync on reconnect
 * - 10.4: Connection status indicator
 */
export function useOfflineSync(options: UseOfflineSyncOptions) {
  const syncService = useSyncService(options)

  return {
    // Connection status
    connectionStatus: syncService.connectionStatus,
    isOnline: syncService.connectionStatus === 'connected',
    isOffline: syncService.connectionStatus === 'disconnected',
    isSyncing: syncService.connectionStatus === 'syncing',
    isReconnecting: syncService.connectionStatus === 'reconnecting',

    // Sync status
    hasPendingChanges: syncService.hasPendingChanges,
    isSynced: syncService.isSynced,
    conflicts: syncService.conflicts,
    isInitialized: syncService.isInitialized,

    // Operations
    cacheDocument: syncService.cacheDocument,
    getCachedDocument: syncService.getCachedDocument,
    queueChange: syncService.queueChange,
    sync: syncService.sync,
    detectConflict: syncService.detectConflict,
    resolveConflict: syncService.resolveConflict,
    clearCache: syncService.clearCache,
  }
}

/**
 * Hook for monitoring connection status with callbacks
 * Requirement 10.4: Connection status indicator
 */
export function useConnectionMonitor(callbacks?: {
  onConnect?: () => void
  onDisconnect?: () => void
  onReconnecting?: () => void
  onSyncing?: () => void
}) {
  const { connectionStatus, isInitialized, setConnectionStatus } = useConnectionStatus()

  // Track previous status to detect changes
  const [previousStatus, setPreviousStatus] = React.useState<ConnectionStatus>(connectionStatus)

  React.useEffect(() => {
    if (!isInitialized) return

    // Detect status changes and call appropriate callbacks
    if (connectionStatus !== previousStatus) {
      switch (connectionStatus) {
        case 'connected':
          callbacks?.onConnect?.()
          break
        case 'disconnected':
          callbacks?.onDisconnect?.()
          break
        case 'reconnecting':
          callbacks?.onReconnecting?.()
          break
        case 'syncing':
          callbacks?.onSyncing?.()
          break
      }

      setPreviousStatus(connectionStatus)
    }
  }, [connectionStatus, previousStatus, isInitialized, callbacks])

  return {
    connectionStatus,
    isOnline: connectionStatus === 'connected',
    isOffline: connectionStatus === 'disconnected',
    isSyncing: connectionStatus === 'syncing',
    isReconnecting: connectionStatus === 'reconnecting',
    isInitialized,
    setConnectionStatus,
  }
}

// Add React import for useState
import React from 'react'

/**
 * Hook for managing offline editing with warnings
 * Requirement 10.5: Offline editing allowed with warning
 */
export function useOfflineEditing(documentId: string) {
  const { connectionStatus, hasPendingChanges, queueChange, cacheDocument } = useOfflineSync({
    documentId,
  })

  const [showOfflineWarning, setShowOfflineWarning] = React.useState(false)

  // Show warning when offline
  React.useEffect(() => {
    if (connectionStatus === 'disconnected') {
      setShowOfflineWarning(true)
    } else {
      setShowOfflineWarning(false)
    }
  }, [connectionStatus])

  /**
   * Make an edit (works offline or online)
   */
  const makeEdit = useCallback(
    async (content: JSONContent, changeType: string = 'edit') => {
      // If offline, queue the change
      if (connectionStatus === 'disconnected') {
        await queueChange({
          changeType: changeType as any, // Allow any string for flexibility
          content,
          timestamp: new Date().toISOString(),
        } as any)

        // Cache the document
        await cacheDocument(content)

        return {
          success: true,
          offline: true,
        }
      }

      // If online, return success (actual save handled by caller)
      return {
        success: true,
        offline: false,
      }
    },
    [connectionStatus, queueChange, cacheDocument]
  )

  return {
    // Status
    isOffline: connectionStatus === 'disconnected',
    showOfflineWarning,
    hasPendingChanges,

    // Operations
    makeEdit,
    dismissWarning: () => setShowOfflineWarning(false),
  }
}

/**
 * Hook for conflict resolution UI
 * Requirement 10.3: Conflict resolution presents both versions
 */
export function useConflictResolution(documentId: string) {
  const { conflicts, resolveConflict, detectConflict } = useOfflineSync({
    documentId,
  })

  const [activeConflict, setActiveConflict] = React.useState<SyncConflict | null>(null)

  /**
   * Start resolving a conflict
   */
  const startResolution = useCallback(
    (conflict: SyncConflict) => {
      setActiveConflict(conflict)
    },
    []
  )

  /**
   * Resolve with local version
   */
  const resolveWithLocal = useCallback(async () => {
    if (!activeConflict) return

    await resolveConflict(activeConflict.id, activeConflict.localContent)
    setActiveConflict(null)
  }, [activeConflict, resolveConflict])

  /**
   * Resolve with server version
   */
  const resolveWithServer = useCallback(async () => {
    if (!activeConflict) return

    await resolveConflict(activeConflict.id, activeConflict.serverContent)
    setActiveConflict(null)
  }, [activeConflict, resolveConflict])

  /**
   * Resolve with custom merged version
   */
  const resolveWithMerged = useCallback(
    async (mergedContent: JSONContent) => {
      if (!activeConflict) return

      await resolveConflict(activeConflict.id, mergedContent)
      setActiveConflict(null)
    },
    [activeConflict, resolveConflict]
  )

  /**
   * Cancel resolution
   */
  const cancelResolution = useCallback(() => {
    setActiveConflict(null)
  }, [])

  return {
    // Conflicts
    conflicts,
    activeConflict,
    hasConflicts: conflicts.length > 0,

    // Operations
    startResolution,
    resolveWithLocal,
    resolveWithServer,
    resolveWithMerged,
    cancelResolution,
    detectConflict,
  }
}

/**
 * Hook for sync progress tracking
 * Provides detailed information about sync progress
 */
export function useSyncProgress(documentId: string) {
  const { hasPendingChanges, isSynced, connectionStatus, sync } = useOfflineSync({
    documentId,
  })

  const [syncProgress, setSyncProgress] = React.useState({
    total: 0,
    completed: 0,
    failed: 0,
  })

  const [isSyncInProgress, setIsSyncInProgress] = React.useState(false)

  /**
   * Perform sync with progress tracking
   */
  const syncWithProgress = useCallback(
    async (syncFn: (changes: QueuedChange[]) => Promise<{ success: boolean; conflicts?: SyncConflict[] }>) => {
      setIsSyncInProgress(true)
      setSyncProgress({ total: 0, completed: 0, failed: 0 })

      try {
        const result = await sync(syncFn)

        setSyncProgress({
          total: 1,
          completed: result.success ? 1 : 0,
          failed: result.success ? 0 : 1,
        })

        return result
      } finally {
        setIsSyncInProgress(false)
      }
    },
    [sync]
  )

  const syncPercentage = syncProgress.total > 0
    ? Math.round((syncProgress.completed / syncProgress.total) * 100)
    : 0

  return {
    // Status
    hasPendingChanges,
    isSynced,
    isSyncInProgress,
    connectionStatus,

    // Progress
    syncProgress,
    syncPercentage,

    // Operations
    syncWithProgress,
  }
}

/**
 * Composite hook for complete offline support
 * Combines all offline features into a single interface
 */
export function useOfflineManager(documentId: string) {
  const offlineSync = useOfflineSync({ documentId })
  const offlineEditing = useOfflineEditing(documentId)
  const conflictResolution = useConflictResolution(documentId)
  const syncProgress = useSyncProgress(documentId)

  return {
    // Connection status
    connectionStatus: offlineSync.connectionStatus,
    isOnline: offlineSync.isOnline,
    isOffline: offlineSync.isOffline,
    isSyncing: offlineSync.isSyncing,
    isReconnecting: offlineSync.isReconnecting,

    // Sync status
    hasPendingChanges: offlineSync.hasPendingChanges,
    isSynced: offlineSync.isSynced,
    isInitialized: offlineSync.isInitialized,

    // Offline editing
    showOfflineWarning: offlineEditing.showOfflineWarning,
    makeEdit: offlineEditing.makeEdit,
    dismissWarning: offlineEditing.dismissWarning,

    // Conflicts
    conflicts: conflictResolution.conflicts,
    activeConflict: conflictResolution.activeConflict,
    hasConflicts: conflictResolution.hasConflicts,
    startResolution: conflictResolution.startResolution,
    resolveWithLocal: conflictResolution.resolveWithLocal,
    resolveWithServer: conflictResolution.resolveWithServer,
    resolveWithMerged: conflictResolution.resolveWithMerged,
    cancelResolution: conflictResolution.cancelResolution,

    // Sync progress
    syncProgress: syncProgress.syncProgress,
    syncPercentage: syncProgress.syncPercentage,
    isSyncInProgress: syncProgress.isSyncInProgress,
    syncWithProgress: syncProgress.syncWithProgress,

    // Cache operations
    cacheDocument: offlineSync.cacheDocument,
    getCachedDocument: offlineSync.getCachedDocument,
    queueChange: offlineSync.queueChange,
    sync: offlineSync.sync,
    clearCache: offlineSync.clearCache,
  }
}
