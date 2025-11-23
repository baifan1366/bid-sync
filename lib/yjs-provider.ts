/**
 * Yjs Provider Service
 * 
 * Handles CRDT synchronization for collaborative editing using Yjs.
 * Integrates with Supabase Realtime for WebSocket-based synchronization.
 * 
 * Requirements: 3.1, 3.3, 3.5
 */

import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import { getPerformanceOptimizer } from './performance-optimizer'

export interface YjsProviderConfig {
  documentId: string
  userId: string
  userName: string
  userColor: string
  websocketUrl?: string
  onSync?: (synced: boolean) => void
  onConnectionStatus?: (status: 'connected' | 'disconnected' | 'reconnecting') => void
}

/**
 * Creates and configures a Yjs document with WebSocket provider
 * 
 * This function:
 * 1. Creates a new Yjs document (CRDT)
 * 2. Sets up WebSocket provider for real-time sync
 * 3. Configures awareness for presence tracking
 * 4. Handles connection status and sync events
 * 
 * @param config Configuration for the Yjs provider
 * @returns Object containing the Yjs document and provider
 */
export async function createYjsProvider(config: YjsProviderConfig) {
  const {
    documentId,
    userId,
    userName,
    userColor,
    websocketUrl = getWebSocketUrl(),
    onSync,
    onConnectionStatus,
  } = config

  // Create Yjs document (CRDT)
  const ydoc = new Y.Doc()

  // Get performance optimizer for connection pooling and adaptive sync
  const optimizer = getPerformanceOptimizer()
  
  // Generate connection ID
  const connectionId = `${userId}:${documentId}`
  
  // Check connection pool availability (Requirement 10.1)
  const canConnect = await optimizer.acquireConnection(connectionId)
  
  if (!canConnect) {
    throw new Error('Connection pool at capacity. Please try again later.')
  }

  // Get adaptive sync interval based on current load (Requirement 10.4)
  const baseSyncInterval = 1000 // 1 second
  const syncInterval = optimizer.getRecommendedSyncInterval(baseSyncInterval)

  // Create WebSocket provider for synchronization
  // The provider handles:
  // - Initial sync when connecting
  // - Broadcasting local changes to other clients
  // - Receiving and applying remote changes
  // - Automatic reconnection on connection loss
  const provider = new WebsocketProvider(
    websocketUrl,
    documentId,
    ydoc,
    {
      // WebSocket connection options
      connect: true,
      // Adaptive sync interval based on load (Requirement 10.4)
      params: {
        // Note: syncInterval may not be supported by y-websocket
        // This is a placeholder for future optimization
      }
    }
  )

  // Set user info in awareness after provider is created
  provider.awareness.setLocalStateField('user', {
    id: userId,
    name: userName,
    color: userColor,
  })

  // Track connection in pool
  provider.on('status', (event: { status: string }) => {
    if (event.status === 'disconnected') {
      optimizer.releaseConnection(connectionId)
    }
  })

  // Handle sync status
  provider.on('sync', (synced: boolean) => {
    if (onSync) {
      onSync(synced)
    }
  })

  // Handle connection status changes
  provider.on('status', (event: { status: string }) => {
    if (onConnectionStatus) {
      const status = event.status as 'connected' | 'disconnected' | 'reconnecting'
      onConnectionStatus(status)
    }
  })

  // Handle connection errors
  provider.on('connection-error', (event: Event) => {
    console.error('Yjs WebSocket connection error:', event)
    if (onConnectionStatus) {
      onConnectionStatus('disconnected')
    }
  })

  return {
    ydoc,
    provider,
    awareness: provider.awareness,
  }
}

/**
 * Destroys a Yjs provider and cleans up resources
 * 
 * @param provider The WebSocket provider to destroy
 */
export function destroyYjsProvider(provider: WebsocketProvider) {
  // Release connection from pool
  const optimizer = getPerformanceOptimizer()
  const awareness = provider.awareness
  const localState = awareness.getLocalState()
  
  if (localState && localState.user) {
    const user = localState.user as { id: string }
    const connectionId = `${user.id}:${provider.roomname}`
    optimizer.releaseConnection(connectionId)
  }
  
  provider.disconnect()
  provider.destroy()
}

/**
 * Gets the WebSocket URL for Yjs synchronization
 * 
 * In production, this should point to a Supabase Realtime WebSocket endpoint
 * or a dedicated Yjs WebSocket server.
 * 
 * For development, we can use a local y-websocket server.
 */
function getWebSocketUrl(): string {
  // Check if we have a custom WebSocket URL in environment
  if (process.env.NEXT_PUBLIC_YJS_WEBSOCKET_URL) {
    return process.env.NEXT_PUBLIC_YJS_WEBSOCKET_URL
  }

  // Default to local development server
  // In production, this should be replaced with Supabase Realtime or dedicated server
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const host = process.env.NODE_ENV === 'production' 
    ? window.location.host 
    : 'localhost:1234'
  
  return `${protocol}//${host}`
}

/**
 * Encodes Yjs document state as a binary update
 * Useful for persisting document state to database
 * 
 * @param ydoc The Yjs document
 * @returns Binary update as Uint8Array
 */
export function encodeYjsState(ydoc: Y.Doc): Uint8Array {
  return Y.encodeStateAsUpdate(ydoc)
}

/**
 * Applies a binary update to a Yjs document
 * Useful for loading persisted document state from database
 * 
 * @param ydoc The Yjs document
 * @param update Binary update as Uint8Array
 */
export function applyYjsUpdate(ydoc: Y.Doc, update: Uint8Array): void {
  Y.applyUpdate(ydoc, update)
}

/**
 * Gets the shared type from a Yjs document
 * For TipTap integration, we use a Y.XmlFragment
 * 
 * @param ydoc The Yjs document
 * @param name The name of the shared type (default: 'default')
 * @returns The shared XML fragment
 */
export function getYjsFragment(ydoc: Y.Doc, name: string = 'default'): Y.XmlFragment {
  return ydoc.getXmlFragment(name)
}
