/**
 * Custom hook for Supabase Realtime collaborative editing
 * 
 * Replaces Yjs WebSocket-based collaboration with Supabase Realtime.
 * Handles document synchronization, presence tracking, and connection status.
 * 
 * Requirements: 3.1, 3.3, 3.5
 */

'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import {
  SupabaseCollaborationProvider,
  createCollaborationProvider,
  CollaborationUser,
  DocumentUpdate,
} from '@/lib/supabase-collaboration-provider'

export interface UseSupabaseCollaborationOptions {
  documentId: string
  userId: string
  userName: string
  userColor: string
  enabled?: boolean
  onDocumentUpdate?: (update: DocumentUpdate) => void
}

export interface SupabaseCollaborationState {
  provider: SupabaseCollaborationProvider | null
  synced: boolean
  connectionStatus: 'connected' | 'disconnected' | 'reconnecting'
  activeUsers: CollaborationUser[]
  broadcastUpdate: (content: any) => Promise<void>
  broadcastCursor: (cursor: { from: number; to: number } | null) => Promise<void>
}

/**
 * Hook for managing Supabase Realtime collaborative editing
 * 
 * Features:
 * - Creates and manages Supabase Realtime channels
 * - Tracks connection status and sync state
 * - Manages user presence and awareness
 * - Handles cleanup on unmount
 * 
 * @param options Configuration options
 * @returns Collaboration state and utilities
 */
export function useSupabaseCollaboration(
  options: UseSupabaseCollaborationOptions
): SupabaseCollaborationState {
  const {
    documentId,
    userId,
    userName,
    userColor,
    enabled = true,
    onDocumentUpdate,
  } = options

  const [provider, setProvider] = useState<SupabaseCollaborationProvider | null>(null)
  const [synced, setSynced] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<
    'connected' | 'disconnected' | 'reconnecting'
  >('disconnected')
  const [activeUsers, setActiveUsers] = useState<CollaborationUser[]>([])
  
  const providerRef = useRef<SupabaseCollaborationProvider | null>(null)
  const onDocumentUpdateRef = useRef(onDocumentUpdate)

  // Keep callback ref updated
  useEffect(() => {
    onDocumentUpdateRef.current = onDocumentUpdate
  }, [onDocumentUpdate])

  // Initialize provider
  useEffect(() => {
    if (!enabled || !documentId || !userId) {
      return
    }

    const initProvider = async () => {
      // Create provider
      const newProvider = createCollaborationProvider({
        documentId,
        userId,
        userName,
        userColor,
        onSync: setSynced,
        onConnectionStatus: setConnectionStatus,
        onDocumentUpdate: (update) => {
          onDocumentUpdateRef.current?.(update)
        },
        onUserJoined: (user) => {
          setActiveUsers((prev) => {
            if (prev.find((u) => u.id === user.id)) {
              return prev
            }
            return [...prev, user]
          })
        },
        onUserLeft: (leftUserId) => {
          setActiveUsers((prev) => prev.filter((u) => u.id !== leftUserId))
        },
        onCursorUpdate: (cursorUserId, cursor) => {
          setActiveUsers((prev) =>
            prev.map((u) =>
              u.id === cursorUserId ? { ...u, cursor: cursor || undefined } : u
            )
          )
        },
        onPresenceChange: (users) => {
          setActiveUsers(users)
        },
      })

      providerRef.current = newProvider
      setProvider(newProvider)

      // Connect
      await newProvider.connect()
    }

    initProvider()

    // Cleanup on unmount
    return () => {
      if (providerRef.current) {
        providerRef.current.disconnect()
        providerRef.current = null
      }
    }
  }, [enabled, documentId, userId, userName, userColor])

  // Broadcast document update
  const broadcastUpdate = useCallback(async (content: any) => {
    if (providerRef.current) {
      await providerRef.current.broadcastUpdate(content)
    }
  }, [])

  // Broadcast cursor position
  const broadcastCursor = useCallback(async (cursor: { from: number; to: number } | null) => {
    if (providerRef.current) {
      await providerRef.current.broadcastCursor(cursor)
    }
  }, [])

  return {
    provider,
    synced,
    connectionStatus,
    activeUsers,
    broadcastUpdate,
    broadcastCursor,
  }
}

/**
 * Hook for tracking cursor positions of collaborators
 * 
 * @param activeUsers Active users from useSupabaseCollaboration
 * @returns Map of user IDs to cursor positions
 */
export function useCollaboratorCursors(activeUsers: CollaborationUser[]) {
  const cursors = new Map<string, { from: number; to: number }>()

  activeUsers.forEach((user) => {
    if (user.cursor) {
      cursors.set(user.id, user.cursor)
    }
  })

  return cursors
}

/**
 * Hook for tracking cursor positions from provider
 * 
 * @param provider The Supabase collaboration provider (or null)
 * @returns Map of user IDs to cursor positions
 */
export function useProviderCursors(provider: SupabaseCollaborationProvider | null) {
  const [cursors, setCursors] = useState<Map<string, { from: number; to: number }>>(new Map())

  useEffect(() => {
    if (!provider) {
      setCursors(new Map())
      return
    }

    const updateCursors = () => {
      const activeUsers = provider.getActiveUsers()
      const newCursors = new Map<string, { from: number; to: number }>()

      activeUsers.forEach((user) => {
        if (user.cursor) {
          newCursors.set(user.id, user.cursor)
        }
      })

      setCursors(newCursors)
    }

    // Poll for cursor updates
    const interval = setInterval(updateCursors, 500)
    updateCursors()

    return () => {
      clearInterval(interval)
    }
  }, [provider])

  return cursors
}

/**
 * Hook for broadcasting cursor position
 * 
 * @param provider The Supabase collaboration provider (or null)
 * @returns Function to update cursor position
 */
export function useBroadcastCursor(provider: SupabaseCollaborationProvider | null) {
  const updateCursor = useCallback(
    async (position: { from: number; to: number } | null) => {
      if (!provider) return
      await provider.broadcastCursor(position)
    },
    [provider]
  )

  return updateCursor
}
