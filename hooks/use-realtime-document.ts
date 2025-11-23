/**
 * Custom hook for Realtime document collaboration
 * 
 * Provides real-time synchronization for document updates, presence tracking,
 * and cursor positions using Supabase Realtime.
 * 
 * Requirements: 3.1, 3.2, 3.4, 9.1, 9.2
 */

'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import {
  realtimeDocumentService,
  DocumentRealtimeHandlers,
  DocumentUpdatePayload,
  CursorPositionPayload,
  PresencePayload,
  UserJoinedPayload,
  UserLeftPayload,
  RollbackNotificationPayload,
} from '@/lib/realtime-document-service'

export interface UseRealtimeDocumentOptions {
  documentId: string
  userId: string
  userName: string
  userColor: string
  enabled?: boolean
  onDocumentUpdate?: (payload: DocumentUpdatePayload) => void
  onCursorMove?: (payload: CursorPositionPayload) => void
  onPresenceChange?: (payload: PresencePayload) => void
  onUserJoined?: (payload: UserJoinedPayload) => void
  onUserLeft?: (payload: UserLeftPayload) => void
  onRollback?: (payload: RollbackNotificationPayload) => void
}

export interface RealtimeDocumentState {
  connectionStatus: 'connected' | 'connecting' | 'disconnected'
  activeUsers: Map<string, {
    userId: string
    userName: string
    userColor: string
    status: 'active' | 'idle' | 'away'
    cursorPosition?: { from: number; to: number }
  }>
  broadcastUpdate: (content: any) => Promise<void>
  broadcastCursor: (position: { from: number; to: number }) => Promise<void>
  broadcastPresence: (status: 'active' | 'idle' | 'away') => Promise<void>
  reconnect: () => void
}

/**
 * Hook for managing real-time document collaboration
 * 
 * Features:
 * - Subscribes to document updates, presence, and cursor channels
 * - Tracks active users and their presence status
 * - Provides methods to broadcast updates, cursor positions, and presence
 * - Handles connection status and automatic reconnection
 * - Manages cleanup on unmount
 * 
 * @param options Configuration options
 * @returns Realtime document state and utilities
 */
export function useRealtimeDocument(
  options: UseRealtimeDocumentOptions
): RealtimeDocumentState {
  const {
    documentId,
    userId,
    userName,
    userColor,
    enabled = true,
    onDocumentUpdate,
    onCursorMove,
    onPresenceChange,
    onUserJoined,
    onUserLeft,
    onRollback,
  } = options

  const [connectionStatus, setConnectionStatus] = useState<
    'connected' | 'connecting' | 'disconnected'
  >('disconnected')

  // Requirement 2.1, 2.2, 2.3: Track active users with presence status
  const [activeUsers, setActiveUsers] = useState<
    Map<string, {
      userId: string
      userName: string
      userColor: string
      status: 'active' | 'idle' | 'away'
      cursorPosition?: { from: number; to: number }
      currentSection?: string
    }>
  >(new Map())

  const handlersRef = useRef<DocumentRealtimeHandlers>({})

  // Update active users when user joins
  const handleUserJoined = useCallback((payload: UserJoinedPayload) => {
    setActiveUsers((prev) => {
      const next = new Map(prev)
      next.set(payload.userId, {
        userId: payload.userId,
        userName: payload.userName,
        userColor: payload.userColor,
        status: 'active',
      })
      return next
    })
    onUserJoined?.(payload)
  }, [onUserJoined])

  // Update active users when user leaves
  const handleUserLeft = useCallback((payload: UserLeftPayload) => {
    setActiveUsers((prev) => {
      const next = new Map(prev)
      next.delete(payload.userId)
      return next
    })
    onUserLeft?.(payload)
  }, [onUserLeft])

  // Update cursor position for user
  const handleCursorMove = useCallback((payload: CursorPositionPayload) => {
    setActiveUsers((prev) => {
      const next = new Map(prev)
      const user = next.get(payload.userId)
      if (user) {
        next.set(payload.userId, {
          ...user,
          cursorPosition: payload.position,
        })
      }
      return next
    })
    onCursorMove?.(payload)
  }, [onCursorMove])

  // Update presence status for user
  const handlePresenceChange = useCallback((payload: PresencePayload) => {
    setActiveUsers((prev) => {
      const next = new Map(prev)
      const user = next.get(payload.userId)
      if (user) {
        next.set(payload.userId, {
          ...user,
          status: payload.status,
        })
      } else {
        // User not in map yet, add them
        next.set(payload.userId, {
          userId: payload.userId,
          userName: payload.userName,
          userColor: payload.userColor,
          status: payload.status,
        })
      }
      return next
    })
    onPresenceChange?.(payload)
  }, [onPresenceChange])

  // Update handlers ref when callbacks change
  useEffect(() => {
    handlersRef.current = {
      onDocumentUpdate,
      onCursorMove: handleCursorMove,
      onPresenceChange: handlePresenceChange,
      onUserJoined: handleUserJoined,
      onUserLeft: handleUserLeft,
      onRollback,
      onConnectionStatusChange: setConnectionStatus,
    }
  }, [
    onDocumentUpdate,
    handleCursorMove,
    handlePresenceChange,
    handleUserJoined,
    handleUserLeft,
    onRollback,
  ])

  // Subscribe to document channels
  useEffect(() => {
    if (!enabled || !documentId || !userId) {
      return
    }

    setConnectionStatus('connecting')

    const cleanup = realtimeDocumentService.subscribeToDocument(
      documentId,
      handlersRef.current
    )

    // Broadcast that we joined
    realtimeDocumentService
      .broadcastUserJoined(documentId, userId, userName, userColor)
      .catch((error) => {
        console.error('Failed to broadcast user joined:', error)
      })

    // Cleanup on unmount
    return () => {
      // Broadcast that we're leaving
      realtimeDocumentService
        .broadcastUserLeft(documentId, userId)
        .catch((error) => {
          console.error('Failed to broadcast user left:', error)
        })
        .finally(() => {
          cleanup()
        })
    }
  }, [enabled, documentId, userId, userName, userColor])

  // Broadcast document update
  const broadcastUpdate = useCallback(
    async (content: any) => {
      if (!documentId || !userId) {
        throw new Error('Document ID and User ID are required')
      }

      try {
        await realtimeDocumentService.broadcastDocumentUpdate(
          documentId,
          userId,
          userName,
          content
        )
      } catch (error) {
        console.error('Failed to broadcast document update:', error)
        throw error
      }
    },
    [documentId, userId, userName]
  )

  // Broadcast cursor position
  const broadcastCursor = useCallback(
    async (position: { from: number; to: number }) => {
      if (!documentId || !userId) {
        throw new Error('Document ID and User ID are required')
      }

      try {
        await realtimeDocumentService.broadcastCursorPosition(
          documentId,
          userId,
          userName,
          userColor,
          position
        )
      } catch (error) {
        console.error('Failed to broadcast cursor position:', error)
        throw error
      }
    },
    [documentId, userId, userName, userColor]
  )

  // Broadcast presence status
  const broadcastPresence = useCallback(
    async (status: 'active' | 'idle' | 'away') => {
      if (!documentId || !userId) {
        throw new Error('Document ID and User ID are required')
      }

      try {
        await realtimeDocumentService.broadcastPresence(
          documentId,
          userId,
          userName,
          userColor,
          status
        )
      } catch (error) {
        console.error('Failed to broadcast presence:', error)
        throw error
      }
    },
    [documentId, userId, userName, userColor]
  )

  // Manually reconnect
  const reconnect = useCallback(() => {
    if (!documentId) {
      return
    }

    realtimeDocumentService.reconnect(documentId, handlersRef.current)
  }, [documentId])

  return {
    connectionStatus,
    activeUsers,
    broadcastUpdate,
    broadcastCursor,
    broadcastPresence,
    reconnect,
  }
}

/**
 * Hook for monitoring connection status
 * 
 * @param documentId - Document ID
 * @returns Connection status
 */
export function useDocumentConnectionStatus(documentId: string) {
  const [status, setStatus] = useState<'connected' | 'connecting' | 'disconnected'>('disconnected')

  useEffect(() => {
    if (!documentId) {
      return
    }

    // Poll connection status every second
    const interval = setInterval(() => {
      const currentStatus = realtimeDocumentService.getConnectionStatus(documentId)
      setStatus(currentStatus)
    }, 1000)

    return () => {
      clearInterval(interval)
    }
  }, [documentId])

  return status
}
