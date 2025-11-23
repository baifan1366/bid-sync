/**
 * Section Lock Hook
 * 
 * React hook for managing section-based locking in collaborative documents.
 * Provides automatic lock acquisition/release and real-time lock status updates.
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4
 */

'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { getLockManager, LockStatus, LockChangeEvent } from '@/lib/section-lock-service'
import { useUser } from './use-user'

// ============================================================================
// Types
// ============================================================================

export interface UseSectionLockOptions {
  sectionId: string
  documentId: string
  enabled?: boolean
  autoAcquireOnFocus?: boolean
  autoReleaseOnBlur?: boolean
}

export interface SectionLockState {
  isLocked: boolean
  isLockedByMe: boolean
  lockedBy?: string
  lockedAt?: Date
  expiresAt?: Date
  isAcquiring: boolean
  isReleasing: boolean
  error?: string
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook for managing section locks
 * 
 * Features:
 * - Automatic lock acquisition on focus (optional)
 * - Automatic lock release on blur (optional)
 * - Real-time lock status updates via Supabase Realtime
 * - Lock heartbeat mechanism (every 10 seconds)
 * - Manual lock acquisition/release methods
 * 
 * Requirements:
 * - 1.1: Acquire lock when user begins editing
 * - 1.2: Prevent other users from editing locked sections
 * - 1.3: Release lock within 2 seconds when user stops editing
 * - 1.4: Release locks on disconnect (handled by service)
 */
export function useSectionLock(options: UseSectionLockOptions) {
  const {
    sectionId,
    documentId,
    enabled = true,
    autoAcquireOnFocus = true,
    autoReleaseOnBlur = true,
  } = options

  const { user } = useUser()
  const userId = user?.id

  const [lockState, setLockState] = useState<SectionLockState>({
    isLocked: false,
    isLockedByMe: false,
    isAcquiring: false,
    isReleasing: false,
  })

  const lockManagerRef = useRef(getLockManager())
  const isMountedRef = useRef(true)
  const lockIdRef = useRef<string | null>(null)

  // Initialize lock manager with user ID
  useEffect(() => {
    if (!userId || !enabled) return

    const lockManager = lockManagerRef.current
    lockManager.initialize(userId).catch((error) => {
      console.error('Failed to initialize lock manager:', error)
    })

    return () => {
      // Cleanup on unmount
      lockManager.cleanup()
    }
  }, [userId, enabled])

  // Fetch initial lock status
  useEffect(() => {
    if (!enabled || !sectionId) return

    const fetchLockStatus = async () => {
      try {
        const status = await lockManagerRef.current.getLockStatus(sectionId)
        
        if (isMountedRef.current) {
          setLockState((prev) => ({
            ...prev,
            isLocked: status.isLocked,
            isLockedByMe: status.lockedBy === userId,
            lockedBy: status.lockedBy,
            lockedAt: status.lockedAt,
            expiresAt: status.expiresAt,
          }))
        }
      } catch (error) {
        console.error('Failed to fetch lock status:', error)
      }
    }

    fetchLockStatus()
  }, [enabled, sectionId, userId])

  // Subscribe to lock changes
  useEffect(() => {
    if (!enabled || !sectionId) return

    const unsubscribe = lockManagerRef.current.onLockChange((event: LockChangeEvent) => {
      // Only update if this event is for our section
      if (event.sectionId !== sectionId) return

      if (isMountedRef.current) {
        if (event.action === 'acquired') {
          setLockState((prev) => ({
            ...prev,
            isLocked: true,
            isLockedByMe: event.userId === userId,
            lockedBy: event.userId,
            lockedAt: event.timestamp,
          }))
        } else if (event.action === 'released' || event.action === 'expired') {
          setLockState((prev) => ({
            ...prev,
            isLocked: false,
            isLockedByMe: false,
            lockedBy: undefined,
            lockedAt: undefined,
            expiresAt: undefined,
          }))
        }
      }
    })

    return () => {
      unsubscribe()
    }
  }, [enabled, sectionId, userId])

  // Acquire lock
  const acquireLock = useCallback(async () => {
    if (!enabled || !sectionId || !documentId || !userId) {
      return false
    }

    setLockState((prev) => ({ ...prev, isAcquiring: true, error: undefined }))

    try {
      const result = await lockManagerRef.current.acquireLock(sectionId, documentId)

      if (isMountedRef.current) {
        if (result.success) {
          lockIdRef.current = result.lockId || null
          setLockState((prev) => ({
            ...prev,
            isLocked: true,
            isLockedByMe: true,
            lockedBy: userId,
            expiresAt: result.expiresAt,
            isAcquiring: false,
          }))
          return true
        } else {
          setLockState((prev) => ({
            ...prev,
            isAcquiring: false,
            error: result.lockedBy
              ? `Section is locked by another user`
              : 'Failed to acquire lock',
          }))
          return false
        }
      }

      return result.success
    } catch (error) {
      console.error('Failed to acquire lock:', error)
      
      if (isMountedRef.current) {
        setLockState((prev) => ({
          ...prev,
          isAcquiring: false,
          error: 'Failed to acquire lock',
        }))
      }
      
      return false
    }
  }, [enabled, sectionId, documentId, userId])

  // Release lock
  const releaseLock = useCallback(async () => {
    if (!enabled || !sectionId || !userId) {
      return
    }

    setLockState((prev) => ({ ...prev, isReleasing: true, error: undefined }))

    try {
      await lockManagerRef.current.releaseLock(sectionId)

      if (isMountedRef.current) {
        lockIdRef.current = null
        setLockState((prev) => ({
          ...prev,
          isLocked: false,
          isLockedByMe: false,
          lockedBy: undefined,
          lockedAt: undefined,
          expiresAt: undefined,
          isReleasing: false,
        }))
      }
    } catch (error) {
      console.error('Failed to release lock:', error)
      
      if (isMountedRef.current) {
        setLockState((prev) => ({
          ...prev,
          isReleasing: false,
          error: 'Failed to release lock',
        }))
      }
    }
  }, [enabled, sectionId, userId])

  // Auto-acquire on focus
  const handleFocus = useCallback(() => {
    if (autoAcquireOnFocus && !lockState.isLockedByMe) {
      acquireLock()
    }
  }, [autoAcquireOnFocus, lockState.isLockedByMe, acquireLock])

  // Auto-release on blur (with 2 second delay to meet requirement 1.3)
  const handleBlur = useCallback(() => {
    if (autoReleaseOnBlur && lockState.isLockedByMe) {
      // Delay release by 2 seconds to meet requirement 1.3
      setTimeout(() => {
        if (isMountedRef.current) {
          releaseLock()
        }
      }, 2000)
    }
  }, [autoReleaseOnBlur, lockState.isLockedByMe, releaseLock])

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true

    return () => {
      isMountedRef.current = false
      
      // Release lock if we hold it
      if (lockState.isLockedByMe) {
        releaseLock()
      }
    }
  }, [lockState.isLockedByMe, releaseLock])

  return {
    // Lock state
    ...lockState,
    
    // Methods
    acquireLock,
    releaseLock,
    
    // Event handlers for auto-acquire/release
    handleFocus,
    handleBlur,
  }
}

/**
 * Hook for checking if a section is locked (read-only)
 * Useful for displaying lock status without managing locks
 */
export function useSectionLockStatus(sectionId: string, options?: { enabled?: boolean }) {
  const { enabled = true } = options || {}
  const [status, setStatus] = useState<LockStatus>({ isLocked: false })

  useEffect(() => {
    if (!enabled || !sectionId) return

    const lockManager = getLockManager()

    const fetchStatus = async () => {
      try {
        const lockStatus = await lockManager.getLockStatus(sectionId)
        setStatus(lockStatus)
      } catch (error) {
        console.error('Failed to fetch lock status:', error)
      }
    }

    // Initial fetch
    fetchStatus()

    // Subscribe to changes
    const unsubscribe = lockManager.onLockChange((event: LockChangeEvent) => {
      if (event.sectionId === sectionId) {
        fetchStatus()
      }
    })

    // Poll every 10 seconds as backup
    const interval = setInterval(fetchStatus, 10000)

    return () => {
      unsubscribe()
      clearInterval(interval)
    }
  }, [enabled, sectionId])

  return status
}
