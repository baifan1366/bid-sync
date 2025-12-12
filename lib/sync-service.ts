/**
 * Sync Service
 * 
 * Manages offline support and synchronization for collaborative documents.
 * Handles local caching using IndexedDB, change queuing, and conflict resolution.
 * 
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb'
import { JSONContent } from '@/types/document'

/**
 * IndexedDB Schema
 */
interface SyncDB extends DBSchema {
  documents: {
    key: string
    value: CachedDocument
    indexes: { 'by-timestamp': string }
  }
  changes: {
    key: string
    value: QueuedChange
    indexes: { 'by-document': string; 'by-timestamp': string }
  }
  conflicts: {
    key: string
    value: SyncConflict
    indexes: { 'by-document': string }
  }
}

/**
 * Cached document structure
 */
export interface CachedDocument {
  documentId: string
  content: JSONContent
  /** @deprecated No longer using Yjs - kept for backward compatibility */
  yjsState?: Uint8Array
  lastModified: string
  syncedAt?: string
}

/**
 * Queued change structure
 */
export interface QueuedChange {
  id: string
  documentId: string
  userId: string
  changeType: 'content' | 'cursor' | 'presence'
  data: any
  timestamp: string
  retryCount: number
}

/**
 * Sync conflict structure
 */
export interface SyncConflict {
  id: string
  documentId: string
  localVersion: JSONContent
  serverVersion: JSONContent
  timestamp: string
  resolved: boolean
}

/**
 * Sync result
 */
export interface SyncResult {
  success: boolean
  conflicts: SyncConflict[]
  syncedAt: string
  error?: string
}

/**
 * Connection status type
 */
export type ConnectionStatus = 'connected' | 'disconnected' | 'reconnecting' | 'syncing'

/**
 * Sync Service Class
 * 
 * Provides offline support with:
 * - Local caching using IndexedDB
 * - Change queue for offline edits
 * - Automatic sync when connection restored
 * - Conflict detection and resolution
 * - Connection status tracking
 */
export class SyncService {
  private db: IDBPDatabase<SyncDB> | null = null
  private connectionStatus: ConnectionStatus = 'disconnected'
  private syncInProgress = false
  private statusListeners: Set<(status: ConnectionStatus) => void> = new Set()
  private readonly DB_NAME = 'collaborative-editor-sync'
  private readonly DB_VERSION = 1

  /**
   * Initialize the sync service and open IndexedDB
   */
  async initialize(): Promise<void> {
    if (this.db) {
      return
    }

    try {
      this.db = await openDB<SyncDB>(this.DB_NAME, this.DB_VERSION, {
        upgrade(db) {
          // Create documents store
          if (!db.objectStoreNames.contains('documents')) {
            const documentsStore = db.createObjectStore('documents', {
              keyPath: 'documentId',
            })
            documentsStore.createIndex('by-timestamp', 'lastModified')
          }

          // Create changes queue store
          if (!db.objectStoreNames.contains('changes')) {
            const changesStore = db.createObjectStore('changes', {
              keyPath: 'id',
            })
            changesStore.createIndex('by-document', 'documentId')
            changesStore.createIndex('by-timestamp', 'timestamp')
          }

          // Create conflicts store
          if (!db.objectStoreNames.contains('conflicts')) {
            const conflictsStore = db.createObjectStore('conflicts', {
              keyPath: 'id',
            })
            conflictsStore.createIndex('by-document', 'documentId')
          }
        },
      })
    } catch (error) {
      console.error('Failed to initialize IndexedDB:', error)
      throw new Error('Failed to initialize offline storage')
    }
  }

  /**
   * Cache document content locally
   * Requirement 10.1: Offline changes cached
   * 
   * @param documentId - Document ID
   * @param content - Document content
   * @param yjsState - Optional Yjs document state
   */
  async cacheDocument(
    documentId: string,
    content: JSONContent,
    yjsState?: Uint8Array
  ): Promise<void> {
    await this.ensureInitialized()

    const cachedDoc: CachedDocument = {
      documentId,
      content,
      yjsState,
      lastModified: new Date().toISOString(),
      syncedAt: this.connectionStatus === 'connected' ? new Date().toISOString() : undefined,
    }

    await this.db!.put('documents', cachedDoc)
  }

  /**
   * Get cached document
   * 
   * @param documentId - Document ID
   * @returns Cached document or null
   */
  async getCachedDocument(documentId: string): Promise<CachedDocument | null> {
    await this.ensureInitialized()
    const doc = await this.db!.get('documents', documentId)
    return doc || null
  }

  /**
   * Queue a change for later synchronization
   * Requirement 10.1: Change queue for offline edits
   * 
   * @param change - Change to queue
   */
  async queueChange(change: Omit<QueuedChange, 'id' | 'retryCount'>): Promise<void> {
    await this.ensureInitialized()

    const queuedChange: QueuedChange = {
      ...change,
      id: `${change.documentId}-${Date.now()}-${Math.random()}`,
      retryCount: 0,
    }

    await this.db!.add('changes', queuedChange)
  }

  /**
   * Get all queued changes for a document
   * 
   * @param documentId - Document ID
   * @returns Array of queued changes
   */
  async getQueuedChanges(documentId: string): Promise<QueuedChange[]> {
    await this.ensureInitialized()
    const index = this.db!.transaction('changes').store.index('by-document')
    return await index.getAll(documentId)
  }

  /**
   * Clear queued changes for a document
   * 
   * @param documentId - Document ID
   */
  async clearQueuedChanges(documentId: string): Promise<void> {
    await this.ensureInitialized()
    const changes = await this.getQueuedChanges(documentId)
    const tx = this.db!.transaction('changes', 'readwrite')
    
    await Promise.all([
      ...changes.map(change => tx.store.delete(change.id)),
      tx.done,
    ])
  }

  /**
   * Synchronize cached changes with server
   * Requirement 10.2: Cached changes sync on reconnect
   * 
   * @param documentId - Document ID
   * @param syncFn - Function to sync changes to server
   * @returns Sync result
   */
  async syncChanges(
    documentId: string,
    syncFn: (changes: QueuedChange[]) => Promise<{ success: boolean; conflicts?: SyncConflict[] }>
  ): Promise<SyncResult> {
    await this.ensureInitialized()

    if (this.syncInProgress) {
      return {
        success: false,
        conflicts: [],
        syncedAt: new Date().toISOString(),
        error: 'Sync already in progress',
      }
    }

    this.syncInProgress = true
    this.setConnectionStatus('syncing')

    try {
      const changes = await this.getQueuedChanges(documentId)

      if (changes.length === 0) {
        this.syncInProgress = false
        this.setConnectionStatus('connected')
        return {
          success: true,
          conflicts: [],
          syncedAt: new Date().toISOString(),
        }
      }

      // Attempt to sync changes
      const result = await syncFn(changes)

      if (result.success) {
        // Clear synced changes
        await this.clearQueuedChanges(documentId)

        // Update cached document sync timestamp
        const cachedDoc = await this.getCachedDocument(documentId)
        if (cachedDoc) {
          cachedDoc.syncedAt = new Date().toISOString()
          await this.db!.put('documents', cachedDoc)
        }

        this.syncInProgress = false
        this.setConnectionStatus('connected')

        return {
          success: true,
          conflicts: result.conflicts || [],
          syncedAt: new Date().toISOString(),
        }
      } else {
        // Sync failed, keep changes in queue
        this.syncInProgress = false
        this.setConnectionStatus('disconnected')

        return {
          success: false,
          conflicts: result.conflicts || [],
          syncedAt: new Date().toISOString(),
          error: 'Failed to sync changes',
        }
      }
    } catch (error) {
      this.syncInProgress = false
      this.setConnectionStatus('disconnected')

      console.error('Error syncing changes:', error)
      return {
        success: false,
        conflicts: [],
        syncedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown sync error',
      }
    }
  }

  /**
   * Detect conflicts between local and server versions
   * Requirement 10.3: Conflict detection
   * 
   * @param documentId - Document ID
   * @param localContent - Local document content
   * @param serverContent - Server document content
   * @returns Conflict if detected, null otherwise
   */
  async detectConflict(
    documentId: string,
    localContent: JSONContent,
    serverContent: JSONContent
  ): Promise<SyncConflict | null> {
    await this.ensureInitialized()

    // Simple conflict detection: compare content
    const localStr = JSON.stringify(localContent)
    const serverStr = JSON.stringify(serverContent)

    if (localStr === serverStr) {
      return null
    }

    // Check if there's already a conflict for this document
    const existingConflicts = await this.getConflicts(documentId)
    if (existingConflicts.length > 0) {
      return existingConflicts[0]
    }

    // Create new conflict
    const conflict: SyncConflict = {
      id: `conflict-${documentId}-${Date.now()}`,
      documentId,
      localVersion: localContent,
      serverVersion: serverContent,
      timestamp: new Date().toISOString(),
      resolved: false,
    }

    await this.db!.add('conflicts', conflict)
    return conflict
  }

  /**
   * Get all conflicts for a document
   * 
   * @param documentId - Document ID
   * @returns Array of conflicts
   */
  async getConflicts(documentId: string): Promise<SyncConflict[]> {
    await this.ensureInitialized()
    const index = this.db!.transaction('conflicts').store.index('by-document')
    const conflicts = await index.getAll(documentId)
    return conflicts.filter(c => !c.resolved)
  }

  /**
   * Resolve a conflict
   * Requirement 10.3: Conflict resolution presents both versions
   * 
   * @param conflictId - Conflict ID
   * @param resolvedContent - Resolved content chosen by user
   */
  async resolveConflict(
    conflictId: string,
    resolvedContent: JSONContent
  ): Promise<void> {
    await this.ensureInitialized()

    const conflict = await this.db!.get('conflicts', conflictId)
    if (!conflict) {
      throw new Error('Conflict not found')
    }

    // Mark conflict as resolved
    conflict.resolved = true
    await this.db!.put('conflicts', conflict)

    // Update cached document with resolved content
    await this.cacheDocument(conflict.documentId, resolvedContent)
  }

  /**
   * Get connection status
   * Requirement 10.4: Connection status indicator
   * 
   * @returns Current connection status
   */
  getConnectionStatus(): ConnectionStatus {
    return this.connectionStatus
  }

  /**
   * Set connection status and notify listeners
   * 
   * @param status - New connection status
   */
  setConnectionStatus(status: ConnectionStatus): void {
    if (this.connectionStatus !== status) {
      this.connectionStatus = status
      this.notifyStatusListeners(status)
    }
  }

  /**
   * Subscribe to connection status changes
   * 
   * @param listener - Status change listener
   * @returns Unsubscribe function
   */
  onConnectionStatusChange(listener: (status: ConnectionStatus) => void): () => void {
    this.statusListeners.add(listener)
    return () => {
      this.statusListeners.delete(listener)
    }
  }

  /**
   * Check if there are pending changes
   * 
   * @param documentId - Document ID
   * @returns True if there are pending changes
   */
  async hasPendingChanges(documentId: string): Promise<boolean> {
    await this.ensureInitialized()
    const changes = await this.getQueuedChanges(documentId)
    return changes.length > 0
  }

  /**
   * Check if document is synced
   * 
   * @param documentId - Document ID
   * @returns True if document is synced
   */
  async isDocumentSynced(documentId: string): Promise<boolean> {
    await this.ensureInitialized()
    const cachedDoc = await this.getCachedDocument(documentId)
    
    if (!cachedDoc) {
      return false
    }

    const hasPending = await this.hasPendingChanges(documentId)
    return !hasPending && cachedDoc.syncedAt !== undefined
  }

  /**
   * Clear all cached data for a document
   * 
   * @param documentId - Document ID
   */
  async clearDocumentCache(documentId: string): Promise<void> {
    await this.ensureInitialized()

    const tx = this.db!.transaction(['documents', 'changes', 'conflicts'], 'readwrite')

    await Promise.all([
      tx.objectStore('documents').delete(documentId),
      this.clearQueuedChanges(documentId),
      this.clearConflicts(documentId),
      tx.done,
    ])
  }

  /**
   * Clear all conflicts for a document
   * 
   * @param documentId - Document ID
   */
  private async clearConflicts(documentId: string): Promise<void> {
    const conflicts = await this.getConflicts(documentId)
    const tx = this.db!.transaction('conflicts', 'readwrite')
    
    await Promise.all([
      ...conflicts.map(conflict => tx.store.delete(conflict.id)),
      tx.done,
    ])
  }

  /**
   * Notify all status listeners
   * 
   * @param status - New connection status
   */
  private notifyStatusListeners(status: ConnectionStatus): void {
    this.statusListeners.forEach(listener => {
      try {
        listener(status)
      } catch (error) {
        console.error('Error in status listener:', error)
      }
    })
  }

  /**
   * Ensure database is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.db) {
      await this.initialize()
    }
  }

  /**
   * Close the database connection
   */
  async close(): Promise<void> {
    if (this.db) {
      this.db.close()
      this.db = null
    }
  }
}

// Export singleton instance
export const syncService = new SyncService()

