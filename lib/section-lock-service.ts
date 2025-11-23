/**
 * Section Lock Service
 * 
 * Provides distributed locking for document sections using Supabase database.
 * Implements TTL-based locks with heartbeat mechanism and automatic cleanup.
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5
 */

import { createClient } from '@/lib/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { getPerformanceOptimizer, measureOperation } from './performance-optimizer';

// ============================================================
// TYPES
// ============================================================

export interface LockResult {
  success: boolean;
  lockId?: string;
  lockedBy?: string;
  expiresAt?: Date;
}

export interface LockStatus {
  isLocked: boolean;
  lockedBy?: string;
  lockedAt?: Date;
  expiresAt?: Date;
}

export interface LockChangeEvent {
  sectionId: string;
  action: 'acquired' | 'released' | 'expired';
  userId: string;
  timestamp: Date;
}

export type LockChangeCallback = (event: LockChangeEvent) => void;

// ============================================================
// SECTION LOCK MANAGER CLASS
// ============================================================

export class SectionLockManager {
  private supabase = createClient();
  private heartbeatIntervals: Map<string, NodeJS.Timeout> = new Map();
  private lockChangeCallbacks: Set<LockChangeCallback> = new Set();
  private realtimeChannel: RealtimeChannel | null = null;
  private currentUserId: string | null = null;

  /**
   * Initialize the lock manager with user context
   */
  async initialize(userId: string): Promise<void> {
    this.currentUserId = userId;
    
    // Set up realtime subscription for lock changes
    this.setupRealtimeSubscription();
    
    // Set up cleanup on window unload
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        this.releaseAllLocks();
      });
    }
  }

  /**
   * Acquire an exclusive lock on a section
   * Requirements: 1.1, 1.2, 10.2 (rate limiting)
   */
  async acquireLock(sectionId: string, documentId: string): Promise<LockResult> {
    if (!this.currentUserId) {
      throw new Error('Lock manager not initialized. Call initialize() first.');
    }

    // Check rate limit (Requirement 10.2: max 10 requests per second per user)
    const optimizer = getPerformanceOptimizer();
    const allowed = await optimizer.checkLockRateLimit(this.currentUserId);
    
    if (!allowed) {
      return {
        success: false,
        lockedBy: 'Rate limit exceeded'
      };
    }

    return measureOperation(
      'acquire_lock',
      async () => {
        try {
          // Call the database function to acquire lock
          const { data, error } = await this.supabase.rpc('acquire_section_lock', {
            p_section_id: sectionId,
            p_document_id: documentId,
            p_user_id: this.currentUserId,
            p_ttl_seconds: 30
          });

          if (error) {
            console.error('Error acquiring lock:', error);
            return { success: false };
          }

          if (!data || data.length === 0) {
            return { success: false };
          }

          const result = data[0];
          
          if (result.success) {
            // Start heartbeat for this lock
            this.startHeartbeat(result.lock_id, sectionId);
            
            // Broadcast lock acquisition
            this.broadcastLockChange({
              sectionId,
              action: 'acquired',
              userId: this.currentUserId!,
              timestamp: new Date()
            });
          }

          return {
            success: result.success,
            lockId: result.lock_id,
            lockedBy: result.locked_by,
            expiresAt: result.expires_at ? new Date(result.expires_at) : undefined
          };
        } catch (error) {
          console.error('Exception acquiring lock:', error);
          return { success: false };
        }
      },
      { userId: this.currentUserId, documentId }
    );
  }

  /**
   * Release a lock on a section
   * Requirements: 1.3
   */
  async releaseLock(sectionId: string): Promise<void> {
    if (!this.currentUserId) {
      throw new Error('Lock manager not initialized. Call initialize() first.');
    }

    try {
      // Stop heartbeat first
      this.stopHeartbeat(sectionId);

      // Call the database function to release lock
      const { data, error } = await this.supabase.rpc('release_section_lock', {
        p_section_id: sectionId,
        p_user_id: this.currentUserId
      });

      if (error) {
        console.error('Error releasing lock:', error);
        return;
      }

      if (data) {
        // Broadcast lock release
        this.broadcastLockChange({
          sectionId,
          action: 'released',
          userId: this.currentUserId,
          timestamp: new Date()
        });
      }
    } catch (error) {
      console.error('Exception releasing lock:', error);
    }
  }

  /**
   * Get the current lock status for a section
   */
  async getLockStatus(sectionId: string): Promise<LockStatus> {
    try {
      const { data, error } = await this.supabase.rpc('get_section_lock_status', {
        p_section_id: sectionId
      });

      if (error) {
        console.error('Error getting lock status:', error);
        return { isLocked: false };
      }

      if (!data || data.length === 0) {
        return { isLocked: false };
      }

      const status = data[0];
      return {
        isLocked: status.is_locked,
        lockedBy: status.locked_by,
        lockedAt: status.locked_at ? new Date(status.locked_at) : undefined,
        expiresAt: status.expires_at ? new Date(status.expires_at) : undefined
      };
    } catch (error) {
      console.error('Exception getting lock status:', error);
      return { isLocked: false };
    }
  }

  /**
   * Register a callback for lock change events
   * Requirements: 1.5
   */
  onLockChange(callback: LockChangeCallback): () => void {
    this.lockChangeCallbacks.add(callback);
    
    // Return unsubscribe function
    return () => {
      this.lockChangeCallbacks.delete(callback);
    };
  }

  /**
   * Send heartbeat to keep lock alive
   * Requirements: 1.4
   */
  async heartbeat(lockId: string): Promise<boolean> {
    if (!this.currentUserId) {
      return false;
    }

    try {
      const { data, error } = await this.supabase.rpc('update_lock_heartbeat', {
        p_lock_id: lockId,
        p_user_id: this.currentUserId
      });

      if (error) {
        console.error('Error updating heartbeat:', error);
        return false;
      }

      return data === true;
    } catch (error) {
      console.error('Exception updating heartbeat:', error);
      return false;
    }
  }

  /**
   * Release all locks held by the current user
   * Requirements: 1.4
   */
  async releaseAllLocks(): Promise<void> {
    if (!this.currentUserId) {
      return;
    }

    try {
      // Stop all heartbeats
      for (const interval of this.heartbeatIntervals.values()) {
        clearInterval(interval);
      }
      this.heartbeatIntervals.clear();

      // Release all locks in database
      await this.supabase.rpc('release_user_locks', {
        p_user_id: this.currentUserId
      });
    } catch (error) {
      console.error('Exception releasing all locks:', error);
    }
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    await this.releaseAllLocks();
    
    if (this.realtimeChannel) {
      await this.supabase.removeChannel(this.realtimeChannel);
      this.realtimeChannel = null;
    }
    
    this.lockChangeCallbacks.clear();
  }

  // ============================================================
  // PRIVATE METHODS
  // ============================================================

  /**
   * Start heartbeat interval for a lock
   * Heartbeat every 10 seconds to keep lock alive
   */
  private startHeartbeat(lockId: string, sectionId: string): void {
    // Clear existing heartbeat if any
    this.stopHeartbeat(sectionId);

    // Start new heartbeat interval (every 10 seconds)
    const interval = setInterval(async () => {
      const success = await this.heartbeat(lockId);
      
      if (!success) {
        // Heartbeat failed, stop the interval and notify
        this.stopHeartbeat(sectionId);
        this.broadcastLockChange({
          sectionId,
          action: 'expired',
          userId: this.currentUserId!,
          timestamp: new Date()
        });
      }
    }, 10000); // 10 seconds

    this.heartbeatIntervals.set(sectionId, interval);
  }

  /**
   * Stop heartbeat interval for a section
   */
  private stopHeartbeat(sectionId: string): void {
    const interval = this.heartbeatIntervals.get(sectionId);
    if (interval) {
      clearInterval(interval);
      this.heartbeatIntervals.delete(sectionId);
    }
  }

  /**
   * Set up Supabase Realtime subscription for lock changes
   * Requirements: 1.5
   */
  private setupRealtimeSubscription(): void {
    this.realtimeChannel = this.supabase
      .channel('section-locks')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'section_locks'
        },
        (payload) => {
          this.handleRealtimeLockChange(payload);
        }
      )
      .subscribe();
  }

  /**
   * Handle realtime lock change events from Supabase
   */
  private handleRealtimeLockChange(payload: any): void {
    const { eventType, new: newRecord, old: oldRecord } = payload;
    
    let action: 'acquired' | 'released' | 'expired';
    let sectionId: string;
    let userId: string;

    if (eventType === 'INSERT') {
      action = 'acquired';
      sectionId = newRecord.section_id;
      userId = newRecord.user_id;
    } else if (eventType === 'DELETE') {
      action = 'released';
      sectionId = oldRecord.section_id;
      userId = oldRecord.user_id;
    } else {
      // UPDATE events are heartbeats, we don't broadcast these
      return;
    }

    this.broadcastLockChange({
      sectionId,
      action,
      userId,
      timestamp: new Date()
    });
  }

  /**
   * Broadcast lock change event to all registered callbacks
   */
  private broadcastLockChange(event: LockChangeEvent): void {
    for (const callback of this.lockChangeCallbacks) {
      try {
        callback(event);
      } catch (error) {
        console.error('Error in lock change callback:', error);
      }
    }
  }
}

// ============================================================
// SINGLETON INSTANCE
// ============================================================

let lockManagerInstance: SectionLockManager | null = null;

/**
 * Get the singleton instance of the lock manager
 */
export function getLockManager(): SectionLockManager {
  if (!lockManagerInstance) {
    lockManagerInstance = new SectionLockManager();
  }
  return lockManagerInstance;
}

/**
 * Create a new lock manager instance (for testing or multiple contexts)
 */
export function createLockManager(): SectionLockManager {
  return new SectionLockManager();
}
