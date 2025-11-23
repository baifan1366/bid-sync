/**
 * Auto-save Service
 * 
 * Provides enhanced auto-save functionality with:
 * - Debounced save operations
 * - Retry logic with exponential backoff
 * - Offline queue management with IndexedDB
 * - Save status tracking
 * - Automatic sync when connectivity restored
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
 */

import { JSONContent } from '@/types/document'
import { openDB, DBSchema, IDBPDatabase } from 'idb'

// ============================================================================
// Types
// ============================================================================

export type SaveStatus = 'saved' | 'saving' | 'pending' | 'error' | 'offline'

export interface SaveResult {
  success: boolean
  savedAt?: Date
  error?: string
}

export interface QueuedSave {
  id: string
  documentId: string
  content: JSONContent
  timestamp: Date
  attemptCount: number
  lastAttempt?: Date
}

export interface AutoSaveConfig {
  debounceDelay: number // milliseconds
  maxRetries: number
  retryDelays: number[] // milliseconds for each retry attempt
  onSaveStatusChange?: (status: SaveStatus) => void
  onSaveSuccess?: (result: SaveResult) => void
  onSaveError?: (error: string) => void
}

// IndexedDB Schema
interface AutoSaveDB extends DBSchema {
  'queued-saves': {
    key: string
    value: QueuedSave
    indexes: { 'by-document': string; 'by-timestamp': Date }
  }
}

// ============================================================================
// Auto-save Service Class
// ============================================================================

export class AutoSaveService {
  private documentId: string
  private getContent: () => JSONContent
  private saveFunction: (content: JSONContent) => Promise<void>
  private config: AutoSaveConfig
  
  private status: SaveStatus = 'saved'
  private debounceTimer: NodeJS.Timeout | null = null
  private retryTimer: NodeJS.Timeout | null = null
  private currentRetryCount = 0
  private lastSavedContent: string | null = null
  private isOnline = true
  private db: IDBPDatabase<AutoSaveDB> | null = null
  private syncInProgress = false

  // Default configuration
  private static readonly DEFAULT_CONFIG: AutoSaveConfig = {
    debounceDelay: 2000, // 2 seconds
    maxRetries: 3,
    retryDelays: [1000, 2000, 4000], // 1s, 2s, 4s exponential backoff
  }

  constructor(
    documentId: string,
    getContent: () => JSONContent,
    saveFunction: (content: JSONContent) => Promise<void>,
    config?: Partial<AutoSaveConfig>
  ) {
    this.documentId = documentId
    this.getContent = getContent
    this.saveFunction = saveFunction
    this.config = { ...AutoSaveService.DEFAULT_CONFIG, ...config }

    // Initialize IndexedDB
    this.initDB()

    // Set up online/offline listeners
    this.setupConnectivityListeners()
  }

  /**
   * Initialize IndexedDB for offline queue
   * Requirement 4.4: Store changes locally when save fails
   */
  private async initDB(): Promise<void> {
    try {
      this.db = await openDB<AutoSaveDB>('auto-save-db', 1, {
        upgrade(db) {
          const store = db.createObjectStore('queued-saves', { keyPath: 'id' })
          store.createIndex('by-document', 'documentId')
          store.createIndex('by-timestamp', 'timestamp')
        },
      })

      // Try to sync any pending saves from previous session
      await this.syncPendingSaves()
    } catch (error) {
      console.error('Failed to initialize IndexedDB:', error)
    }
  }

  /**
   * Set up connectivity listeners
   * Requirement 4.5: Sync when connectivity restored
   */
  private setupConnectivityListeners(): void {
    if (typeof window === 'undefined') return

    window.addEventListener('online', () => {
      this.isOnline = true
      this.syncPendingSaves()
    })

    window.addEventListener('offline', () => {
      this.isOnline = false
      this.updateStatus('offline')
    })

    // Initialize online status
    this.isOnline = navigator.onLine
  }

  /**
   * Start auto-save
   * Requirement 4.1: Persist changes within 3 seconds
   */
  start(): void {
    // Initial status
    this.updateStatus('saved')
  }

  /**
   * Stop auto-save and cleanup
   */
  stop(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }

    if (this.retryTimer) {
      clearTimeout(this.retryTimer)
      this.retryTimer = null
    }
  }

  /**
   * Trigger a save operation
   * Requirement 4.2: Batch changes while typing (2 second debounce)
   */
  save(): void {
    // Clear existing debounce timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
    }

    // Update status to pending
    this.updateStatus('pending')

    // Set new debounce timer
    this.debounceTimer = setTimeout(() => {
      this.executeSave()
    }, this.config.debounceDelay)
  }

  /**
   * Force immediate save without debouncing
   */
  async forceSave(): Promise<SaveResult> {
    // Clear debounce timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }

    return this.executeSave()
  }

  /**
   * Execute the actual save operation
   * Requirement 4.3: Retry up to 3 times with exponential backoff
   */
  private async executeSave(): Promise<SaveResult> {
    const content = this.getContent()
    const contentString = JSON.stringify(content)

    // Check if content has changed
    if (contentString === this.lastSavedContent) {
      this.updateStatus('saved')
      return { success: true, savedAt: new Date() }
    }

    // Update status to saving
    this.updateStatus('saving')

    // Check if online
    if (!this.isOnline) {
      await this.queueSave(content)
      this.updateStatus('offline')
      return {
        success: false,
        error: 'Offline - changes queued for sync',
      }
    }

    try {
      // Attempt to save
      await this.saveFunction(content)

      // Success
      this.lastSavedContent = contentString
      this.currentRetryCount = 0
      this.updateStatus('saved')

      const result: SaveResult = {
        success: true,
        savedAt: new Date(),
      }

      if (this.config.onSaveSuccess) {
        this.config.onSaveSuccess(result)
      }

      return result
    } catch (error) {
      console.error('Save failed:', error)

      // Retry logic
      if (this.currentRetryCount < this.config.maxRetries) {
        return this.scheduleRetry(content)
      } else {
        // All retries exhausted - queue for later
        await this.queueSave(content)
        this.updateStatus('error')

        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        
        if (this.config.onSaveError) {
          this.config.onSaveError(errorMessage)
        }

        return {
          success: false,
          error: errorMessage,
        }
      }
    }
  }

  /**
   * Schedule a retry with exponential backoff
   * Requirement 4.3: Exponential backoff (1s, 2s, 4s)
   */
  private scheduleRetry(content: JSONContent): Promise<SaveResult> {
    return new Promise((resolve) => {
      const delay = this.config.retryDelays[this.currentRetryCount] || 4000
      this.currentRetryCount++

      this.retryTimer = setTimeout(async () => {
        const result = await this.executeSave()
        resolve(result)
      }, delay)
    })
  }

  /**
   * Queue a save for later when offline or after retries exhausted
   * Requirement 4.4: Store changes locally
   */
  private async queueSave(content: JSONContent): Promise<void> {
    if (!this.db) return

    const queuedSave: QueuedSave = {
      id: `${this.documentId}-${Date.now()}`,
      documentId: this.documentId,
      content,
      timestamp: new Date(),
      attemptCount: 0,
    }

    try {
      await this.db.add('queued-saves', queuedSave)
    } catch (error) {
      console.error('Failed to queue save:', error)
    }
  }

  /**
   * Sync all pending saves
   * Requirement 4.5: Synchronize pending changes when connectivity restored
   */
  private async syncPendingSaves(): Promise<void> {
    if (!this.db || this.syncInProgress || !this.isOnline) return

    this.syncInProgress = true

    try {
      const tx = this.db.transaction('queued-saves', 'readonly')
      const index = tx.store.index('by-document')
      const saves = await index.getAll(this.documentId)

      if (saves.length === 0) {
        this.syncInProgress = false
        return
      }

      // Sort by timestamp (oldest first)
      saves.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())

      // Process each queued save
      for (const save of saves) {
        try {
          await this.saveFunction(save.content)
          
          // Remove from queue on success
          await this.db.delete('queued-saves', save.id)
          
          this.lastSavedContent = JSON.stringify(save.content)
        } catch (error) {
          console.error('Failed to sync queued save:', error)
          
          // Update attempt count
          save.attemptCount++
          save.lastAttempt = new Date()
          
          // If too many attempts, remove from queue
          if (save.attemptCount >= this.config.maxRetries) {
            await this.db.delete('queued-saves', save.id)
          } else {
            await this.db.put('queued-saves', save)
          }
        }
      }

      this.updateStatus('saved')
    } catch (error) {
      console.error('Failed to sync pending saves:', error)
    } finally {
      this.syncInProgress = false
    }
  }

  /**
   * Get current save status
   */
  getSaveStatus(): SaveStatus {
    return this.status
  }

  /**
   * Get count of pending saves in queue
   */
  async getPendingCount(): Promise<number> {
    if (!this.db) return 0

    try {
      const tx = this.db.transaction('queued-saves', 'readonly')
      const index = tx.store.index('by-document')
      const saves = await index.getAll(this.documentId)
      return saves.length
    } catch (error) {
      console.error('Failed to get pending count:', error)
      return 0
    }
  }

  /**
   * Update status and notify listeners
   */
  private updateStatus(status: SaveStatus): void {
    this.status = status

    if (this.config.onSaveStatusChange) {
      this.config.onSaveStatusChange(status)
    }
  }

  /**
   * Cleanup resources
   */
  async destroy(): Promise<void> {
    this.stop()

    if (this.db) {
      this.db.close()
      this.db = null
    }
  }
}
