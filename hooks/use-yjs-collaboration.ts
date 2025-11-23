/**
 * Custom hook for Yjs collaborative editing
 * 
 * Integrates Yjs CRDT with TipTap editor for real-time collaboration.
 * Handles document synchronization, presence tracking, and connection status.
 * 
 * Requirements: 3.1, 3.3, 3.5
 */

'use client'

import { useEffect, useState, useCallback } from 'react'
import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import { createYjsProvider, destroyYjsProvider } from '@/lib/yjs-provider'

export interface UseYjsCollaborationOptions {
  documentId: string
  userId: string
  userName: string
  userColor: string
  enabled?: boolean
  websocketUrl?: string
}

export interface YjsCollaborationState {
  ydoc: Y.Doc | null
  provider: WebsocketProvider | null
  synced: boolean
  connectionStatus: 'connected' | 'disconnected' | 'reconnecting'
  activeUsers: Array<{
    id: string
    name: string
    color: string
  }>
}

/**
 * Hook for managing Yjs collaborative editing
 * 
 * Features:
 * - Creates and manages Yjs document (CRDT)
 * - Sets up WebSocket provider for real-time sync
 * - Tracks connection status and sync state
 * - Manages user presence and awareness
 * - Handles cleanup on unmount
 * 
 * @param options Configuration options
 * @returns Yjs collaboration state and utilities
 */
export function useYjsCollaboration(
  options: UseYjsCollaborationOptions
): YjsCollaborationState {
  const {
    documentId,
    userId,
    userName,
    userColor,
    enabled = true,
    websocketUrl,
  } = options

  const [ydoc, setYdoc] = useState<Y.Doc | null>(null)
  const [provider, setProvider] = useState<WebsocketProvider | null>(null)
  const [synced, setSynced] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<
    'connected' | 'disconnected' | 'reconnecting'
  >('disconnected')
  const [activeUsers, setActiveUsers] = useState<
    Array<{ id: string; name: string; color: string }>
  >([])

  // Initialize Yjs provider
  useEffect(() => {
    if (!enabled || !documentId || !userId) {
      return
    }

    let mounted = true

    const initProvider = async () => {
      try {
        const { ydoc: doc, provider: prov, awareness } = await createYjsProvider({
          documentId,
          userId,
          userName,
          userColor,
          websocketUrl,
          onSync: setSynced,
          onConnectionStatus: setConnectionStatus,
        })

        if (!mounted) {
          // Component unmounted before provider was created
          destroyYjsProvider(prov)
          return
        }

        setYdoc(doc)
        setProvider(prov)

        // Track active users through awareness
        const updateActiveUsers = () => {
          const states = Array.from(awareness.getStates().entries())
          const users = states
            .map(([clientId, state]) => {
              const user = state.user as { id: string; name: string; color: string } | undefined
              if (!user) return null
              return {
                id: user.id,
                name: user.name,
                color: user.color,
              }
            })
            .filter((user): user is { id: string; name: string; color: string } => user !== null)
          
          setActiveUsers(users)
        }

        // Listen for awareness changes
        awareness.on('change', updateActiveUsers)
        updateActiveUsers()

        // Cleanup on unmount
        return () => {
          mounted = false
          awareness.off('change', updateActiveUsers)
          destroyYjsProvider(prov)
        }
      } catch (error) {
        console.error('Failed to initialize Yjs provider:', error)
        setConnectionStatus('disconnected')
      }
    }

    initProvider()

    return () => {
      mounted = false
    }
  }, [enabled, documentId, userId, userName, userColor, websocketUrl])

  return {
    ydoc,
    provider,
    synced,
    connectionStatus,
    activeUsers,
  }
}

/**
 * Hook for tracking cursor positions of collaborators
 * 
 * @param provider The WebSocket provider
 * @returns Map of user IDs to cursor positions
 */
export function useYjsCursors(provider: WebsocketProvider | null) {
  const [cursors, setCursors] = useState<
    Map<string, { from: number; to: number }>
  >(new Map())

  useEffect(() => {
    if (!provider) return

    const awareness = provider.awareness

    const updateCursors = () => {
      const states = Array.from(awareness.getStates().entries())
      const newCursors = new Map<string, { from: number; to: number }>()

      states.forEach(([clientId, state]) => {
        const user = state.user as { id: string } | undefined
        const cursor = state.cursor as { from: number; to: number } | undefined
        
        if (user && cursor) {
          newCursors.set(user.id, cursor)
        }
      })

      setCursors(newCursors)
    }

    awareness.on('change', updateCursors)
    updateCursors()

    return () => {
      awareness.off('change', updateCursors)
    }
  }, [provider])

  return cursors
}

/**
 * Hook for broadcasting cursor position
 * 
 * @param provider The WebSocket provider
 * @returns Function to update cursor position
 */
export function useYjsBroadcastCursor(provider: WebsocketProvider | null) {
  const updateCursor = useCallback(
    (position: { from: number; to: number } | null) => {
      if (!provider) return

      const awareness = provider.awareness
      const currentState = awareness.getLocalState() || {}

      awareness.setLocalState({
        ...currentState,
        cursor: position,
      })
    },
    [provider]
  )

  return updateCursor
}
