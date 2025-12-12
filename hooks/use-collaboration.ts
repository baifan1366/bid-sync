/**
 * Custom hooks for collaboration features
 * 
 * Provides hooks for real-time collaboration, presence tracking, and cursor positions.
 * Now uses Supabase Realtime exclusively (no more Yjs WebSocket dependency).
 * 
 * Requirements: 3.1, 3.4, 9.1, 9.3, 9.4
 */

'use client'

import { useCallback, useEffect, useState } from 'react'
import { useGraphQLQuery, useGraphQLMutation } from './use-graphql'
import { useRealtimeDocument } from './use-realtime-document'
import { useSupabaseCollaboration, useProviderCursors, useBroadcastCursor } from './use-supabase-collaboration'
import {
  GET_ACTIVE_SESSIONS,
} from '@/lib/graphql/queries'
import {
  JOIN_SESSION,
  LEAVE_SESSION,
  UPDATE_CURSOR_POSITION,
  UPDATE_PRESENCE,
  UPDATE_CURRENT_SECTION,
} from '@/lib/graphql/mutations'
import type {
  CollaborationSession,
  CursorPosition,
  SessionResponse,
} from '@/types/document'

// ============================================================================
// Collaboration Hooks
// ============================================================================

export interface UseCollaborationOptions {
  documentId: string
  userId: string
  userName: string
  userColor: string
  enabled?: boolean
  websocketUrl?: string // Kept for backward compatibility, but ignored
}

/**
 * Hook for managing real-time collaboration
 * Uses Supabase Realtime for all collaboration features
 * 
 * Requirements:
 * - 3.1: Real-time synchronization
 * - 3.4: Cursor position tracking
 * - 9.1: Active collaborator presence
 */
export function useCollaboration(options: UseCollaborationOptions) {
  const {
    documentId,
    userId,
    userName,
    userColor,
    enabled = true,
    // websocketUrl is ignored - using Supabase Realtime
  } = options

  // Supabase Realtime for document synchronization
  const collaborationState = useSupabaseCollaboration({
    documentId,
    userId,
    userName,
    userColor,
    enabled,
  })

  // Supabase Realtime for presence and cursor tracking
  const realtimeState = useRealtimeDocument({
    documentId,
    userId,
    userName,
    userColor,
    enabled,
  })

  // Combine active users from both sources (deduplicated)
  const activeUsersMap = new Map<string, any>()
  
  // Add users from collaboration state
  collaborationState.activeUsers.forEach((user) => {
    activeUsersMap.set(user.id, {
      userId: user.id,
      userName: user.name,
      userColor: user.color,
      status: 'active',
      cursorPosition: user.cursor,
    })
  })
  
  // Add/update users from realtime state
  realtimeState.activeUsers.forEach((value, key) => {
    if (!activeUsersMap.has(key)) {
      activeUsersMap.set(key, value)
    }
  })

  const activeUsers = Array.from(activeUsersMap.values())

  return {
    // No longer using Yjs
    ydoc: null,
    provider: collaborationState.provider,
    synced: collaborationState.synced,
    
    // Connection status
    connectionStatus: collaborationState.connectionStatus,
    
    // Active users and presence
    activeUsers,
    
    // Broadcast methods
    broadcastUpdate: collaborationState.broadcastUpdate,
    broadcastCursor: collaborationState.broadcastCursor,
    broadcastPresence: realtimeState.broadcastPresence,
    
    // Reconnect
    reconnect: realtimeState.reconnect,
  }
}

/**
 * Hook for tracking active users/presence
 * Requirement 9.1: Active collaborator presence
 * Requirement 9.3: Presence metadata completeness
 */
export function usePresence(documentId: string | null, options?: { enabled?: boolean }) {
  const { data, isLoading, error, refetch } = useGraphQLQuery<{
    activeSessions: CollaborationSession[]
  }>(
    ['activeSessions', documentId || ''],
    GET_ACTIVE_SESSIONS,
    { documentId },
    {
      enabled: options?.enabled !== false && !!documentId,
      staleTime: 5000, // 5 seconds - presence data should be fresh
    }
  )

  const activeSessions = data?.activeSessions || []

  // Transform sessions into a more usable format
  const activeUsers = activeSessions.map(session => ({
    userId: session.userId,
    userName: session.userName,
    userColor: session.userColor,
    status: session.presenceStatus,
    cursorPosition: session.cursorPosition,
    lastActive: session.lastActivity,
  }))

  return {
    activeUsers,
    activeSessions,
    isLoading,
    error,
    refetch,
  }
}

/**
 * Hook for managing cursor positions
 * Requirement 3.4: Cursor position tracking
 * Requirement 9.4: Cursor highlighting
 */
export function useCursors(
  provider: any | null,
  options?: {
    enabled?: boolean
    throttleMs?: number
  }
) {
  const { enabled = true, throttleMs = 100 } = options || {}
  
  // Get cursors from Supabase provider
  const providerCursors = useProviderCursors(provider)
  const broadcastCursor = useBroadcastCursor(provider)

  // Throttle cursor updates
  const [lastUpdate, setLastUpdate] = useState(0)

  const updateCursor = useCallback(
    (position: CursorPosition | null) => {
      if (!enabled) return

      const now = Date.now()
      if (now - lastUpdate < throttleMs) {
        return
      }

      setLastUpdate(now)
      broadcastCursor(position)
    },
    [enabled, throttleMs, lastUpdate, broadcastCursor]
  )

  // Convert Map to array for easier consumption
  const cursors = Array.from(providerCursors.entries()).map(([oderId, position]) => ({
    userId: oderId,
    position,
  }))

  return {
    cursors,
    updateCursor,
  }
}

/**
 * Hook for joining/leaving collaboration sessions
 */
export function useCollaborationSession(documentId: string | null) {
  const joinMutation = useGraphQLMutation<
    { joinSession: SessionResponse },
    { input: { documentId: string; userColor: string } }
  >(JOIN_SESSION, [['activeSessions']])

  const leaveMutation = useGraphQLMutation<
    { leaveSession: boolean },
    { sessionId: string }
  >(LEAVE_SESSION, [['activeSessions']])

  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)

  const joinSession = useCallback(
    async (userColor: string) => {
      if (!documentId) {
        throw new Error('Document ID is required')
      }

      const result = await joinMutation.mutateAsync({
        input: {
          documentId,
          userColor,
        },
      })

      if (!result.joinSession.success) {
        throw new Error(result.joinSession.error || 'Failed to join session')
      }

      setCurrentSessionId(result.joinSession.session?.id || null)
      return result.joinSession.session
    },
    [documentId, joinMutation]
  )

  const leaveSession = useCallback(async () => {
    if (!currentSessionId) {
      return
    }

    await leaveMutation.mutateAsync({ sessionId: currentSessionId })
    setCurrentSessionId(null)
  }, [currentSessionId, leaveMutation])

  // Auto-leave on unmount
  useEffect(() => {
    return () => {
      if (currentSessionId) {
        leaveMutation.mutate({ sessionId: currentSessionId })
      }
    }
  }, [currentSessionId, leaveMutation])

  return {
    joinSession,
    leaveSession,
    currentSessionId,
    isJoining: joinMutation.isPending,
    isLeaving: leaveMutation.isPending,
  }
}

/**
 * Hook for updating presence status
 * Requirement 9.3: Presence metadata
 */
export function usePresenceUpdater(sessionId: string | null) {
  const updateMutation = useGraphQLMutation<
    { updatePresence: boolean },
    { input: { sessionId: string; status: 'ACTIVE' | 'IDLE' | 'AWAY' } }
  >(UPDATE_PRESENCE)

  const updatePresence = useCallback(
    async (status: 'active' | 'idle' | 'away') => {
      if (!sessionId) {
        return
      }

      // Convert to GraphQL enum format
      const gqlStatus = status.toUpperCase() as 'ACTIVE' | 'IDLE' | 'AWAY'

      await updateMutation.mutateAsync({
        input: {
          sessionId,
          status: gqlStatus,
        },
      })
    },
    [sessionId, updateMutation]
  )

  // Auto-detect idle/away status
  // Requirement 2.4: 5-minute idle timeout detection
  useEffect(() => {
    if (!sessionId) return

    let idleTimeout: NodeJS.Timeout
    let awayTimeout: NodeJS.Timeout

    const resetTimers = () => {
      clearTimeout(idleTimeout)
      clearTimeout(awayTimeout)

      // Set to active
      updatePresence('active')

      // Set to idle after 2 minutes of inactivity
      idleTimeout = setTimeout(() => {
        updatePresence('idle')
      }, 2 * 60 * 1000)

      // Set to away after 5 minutes of inactivity (Requirement 2.4)
      awayTimeout = setTimeout(() => {
        updatePresence('away')
      }, 5 * 60 * 1000)
    }

    // Listen for user activity
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart']
    events.forEach(event => {
      document.addEventListener(event, resetTimers)
    })

    // Initialize
    resetTimers()

    return () => {
      clearTimeout(idleTimeout)
      clearTimeout(awayTimeout)
      events.forEach(event => {
        document.removeEventListener(event, resetTimers)
      })
    }
  }, [sessionId, updatePresence])

  return {
    updatePresence,
    isUpdating: updateMutation.isPending,
  }
}

/**
 * Composite hook for complete collaboration management
 * Combines all collaboration features into a single interface
 */
export function useCollaborationManager(options: UseCollaborationOptions) {
  const collaboration = useCollaboration(options)
  const { activeUsers: presenceUsers } = usePresence(options.documentId)
  const { cursors, updateCursor } = useCursors(collaboration.provider)
  const session = useCollaborationSession(options.documentId)
  const presenceUpdater = usePresenceUpdater(session.currentSessionId)

  // Join session on mount
  useEffect(() => {
    if (options.enabled && options.documentId && !session.currentSessionId) {
      session.joinSession(options.userColor).catch(error => {
        console.error('Failed to join session:', error)
      })
    }
  }, [options.enabled, options.documentId, options.userColor, session])

  return {
    // Document sync
    ydoc: collaboration.ydoc,
    provider: collaboration.provider,
    synced: collaboration.synced,
    connectionStatus: collaboration.connectionStatus,
    
    // Active users
    activeUsers: collaboration.activeUsers,
    presenceUsers,
    
    // Cursors
    cursors,
    updateCursor,
    
    // Session
    sessionId: session.currentSessionId,
    joinSession: session.joinSession,
    leaveSession: session.leaveSession,
    
    // Presence
    updatePresence: presenceUpdater.updatePresence,
    
    // Broadcast
    broadcastUpdate: collaboration.broadcastUpdate,
    broadcastCursor: collaboration.broadcastCursor,
    broadcastPresence: collaboration.broadcastPresence,
    
    // Reconnect
    reconnect: collaboration.reconnect,
  }
}

/**
 * Hook for section-specific presence tracking
 * Shows which users are editing which sections
 * 
 * Requirements: 2.3 - Section-specific presence
 */
export function useSectionPresence(documentId: string, sectionId?: string) {
  const { activeUsers } = usePresence(documentId)
  
  // Filter users by section if sectionId is provided
  const sectionUsers = sectionId
    ? activeUsers.filter(user => {
        // This would need to be enhanced with actual section tracking
        // For now, we return all active users
        return true
      })
    : activeUsers

  return {
    sectionUsers,
    allUsers: activeUsers,
  }
}

/**
 * Hook for updating current section
 * Broadcasts which section the user is currently editing
 * 
 * Requirements: 2.3 - Section-specific presence
 */
export function useCurrentSection(sessionId: string | null) {
  const updateMutation = useGraphQLMutation<
    { updateCurrentSection: boolean },
    { input: { sessionId: string; sectionId?: string } }
  >(UPDATE_CURRENT_SECTION)

  const updateCurrentSection = useCallback(
    async (sectionId: string | null) => {
      if (!sessionId) {
        return
      }

      try {
        await updateMutation.mutateAsync({
          input: {
            sessionId,
            sectionId: sectionId || undefined,
          },
        })
      } catch (error) {
        console.error('Failed to update current section:', error)
      }
    },
    [sessionId, updateMutation]
  )

  return {
    updateCurrentSection,
    isUpdating: updateMutation.isPending,
  }
}
