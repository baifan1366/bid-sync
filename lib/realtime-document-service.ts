/**
 * Realtime Document Service
 * 
 * Manages Supabase Realtime channels for document collaboration.
 * Handles document updates, presence tracking, and cursor positions.
 * 
 * Requirements: 3.1, 3.2, 3.4, 9.1, 9.2
 */

import { createClient } from '@/lib/supabase/client'
import { RealtimeChannel, RealtimeChannelSendResponse } from '@supabase/supabase-js'

/**
 * Document update event payload
 */
export interface DocumentUpdatePayload {
  documentId: string
  userId: string
  userName: string
  content: any
  timestamp: string
}

/**
 * Cursor position event payload
 */
export interface CursorPositionPayload {
  documentId: string
  userId: string
  userName: string
  userColor: string
  position: {
    from: number
    to: number
  }
}

/**
 * Presence event payload
 */
export interface PresencePayload {
  documentId: string
  userId: string
  userName: string
  userColor: string
  status: 'active' | 'idle' | 'away'
}

/**
 * User joined event payload
 */
export interface UserJoinedPayload {
  documentId: string
  userId: string
  userName: string
  userColor: string
}

/**
 * User left event payload
 */
export interface UserLeftPayload {
  documentId: string
  userId: string
}

/**
 * Rollback notification payload
 */
export interface RollbackNotificationPayload {
  documentId: string
  versionId: string
  versionNumber: number
  performedBy: string
  performedByName: string
  timestamp: string
}

/**
 * Event handlers for document collaboration
 */
export interface DocumentRealtimeHandlers {
  onDocumentUpdate?: (payload: DocumentUpdatePayload) => void
  onCursorMove?: (payload: CursorPositionPayload) => void
  onPresenceChange?: (payload: PresencePayload) => void
  onUserJoined?: (payload: UserJoinedPayload) => void
  onUserLeft?: (payload: UserLeftPayload) => void
  onRollback?: (payload: RollbackNotificationPayload) => void
  onConnectionStatusChange?: (status: 'connected' | 'connecting' | 'disconnected') => void
}

/**
 * Realtime Document Service
 * 
 * Provides methods for:
 * - Creating and managing Realtime channels
 * - Broadcasting document updates
 * - Broadcasting cursor positions
 * - Broadcasting presence status
 * - Handling connection status
 */
export class RealtimeDocumentService {
  private channels: Map<string, RealtimeChannel> = new Map()
  private reconnectAttempts: Map<string, number> = new Map()
  private reconnectTimeouts: Map<string, NodeJS.Timeout> = new Map()
  private readonly maxReconnectAttempts = 5

  /**
   * Subscribe to document collaboration events
   * 
   * Creates three channels:
   * 1. Document updates channel - for content changes
   * 2. Presence channel - for user presence tracking
   * 3. Cursor channel - for cursor position updates
   * 
   * @param documentId - Document ID to subscribe to
   * @param handlers - Event handlers
   * @returns Cleanup function
   */
  subscribeToDocument(
    documentId: string,
    handlers: DocumentRealtimeHandlers
  ): () => void {
    const supabase = createClient()

    // Create main document channel for updates and events
    const documentChannelName = `document:${documentId}`
    const documentChannel = supabase.channel(documentChannelName)

    // Set up document update listener
    if (handlers.onDocumentUpdate) {
      documentChannel.on(
        'broadcast',
        { event: 'document_update' },
        (payload) => {
          handlers.onDocumentUpdate?.(payload.payload as DocumentUpdatePayload)
        }
      )
    }

    // Set up user joined listener
    if (handlers.onUserJoined) {
      documentChannel.on(
        'broadcast',
        { event: 'user_joined' },
        (payload) => {
          handlers.onUserJoined?.(payload.payload as UserJoinedPayload)
        }
      )
    }

    // Set up user left listener
    if (handlers.onUserLeft) {
      documentChannel.on(
        'broadcast',
        { event: 'user_left' },
        (payload) => {
          handlers.onUserLeft?.(payload.payload as UserLeftPayload)
        }
      )
    }

    // Set up rollback notification listener
    if (handlers.onRollback) {
      documentChannel.on(
        'broadcast',
        { event: 'rollback' },
        (payload) => {
          handlers.onRollback?.(payload.payload as RollbackNotificationPayload)
        }
      )
    }

    // Subscribe to document channel
    documentChannel.subscribe((status) => {
      this.handleSubscriptionStatus(
        documentId,
        'document',
        status,
        handlers.onConnectionStatusChange,
        () => this.subscribeToDocument(documentId, handlers)
      )
    })

    this.channels.set(`${documentId}:document`, documentChannel)

    // Create presence channel for user presence tracking
    const presenceChannelName = `presence:${documentId}`
    const presenceChannel = supabase.channel(presenceChannelName)

    // Set up presence change listener
    if (handlers.onPresenceChange) {
      presenceChannel.on(
        'broadcast',
        { event: 'presence_changed' },
        (payload) => {
          handlers.onPresenceChange?.(payload.payload as PresencePayload)
        }
      )
    }

    // Subscribe to presence channel
    presenceChannel.subscribe((status) => {
      this.handleSubscriptionStatus(
        documentId,
        'presence',
        status,
        handlers.onConnectionStatusChange,
        () => this.subscribeToDocument(documentId, handlers)
      )
    })

    this.channels.set(`${documentId}:presence`, presenceChannel)

    // Create cursor channel for cursor position updates
    const cursorChannelName = `cursor:${documentId}`
    const cursorChannel = supabase.channel(cursorChannelName)

    // Set up cursor move listener
    if (handlers.onCursorMove) {
      cursorChannel.on(
        'broadcast',
        { event: 'cursor_moved' },
        (payload) => {
          handlers.onCursorMove?.(payload.payload as CursorPositionPayload)
        }
      )
    }

    // Subscribe to cursor channel
    cursorChannel.subscribe((status) => {
      this.handleSubscriptionStatus(
        documentId,
        'cursor',
        status,
        handlers.onConnectionStatusChange,
        () => this.subscribeToDocument(documentId, handlers)
      )
    })

    this.channels.set(`${documentId}:cursor`, cursorChannel)

    // Return cleanup function
    return () => {
      this.unsubscribeFromDocument(documentId)
    }
  }

  /**
   * Unsubscribe from document collaboration events
   * 
   * @param documentId - Document ID to unsubscribe from
   */
  unsubscribeFromDocument(documentId: string): void {
    // Clean up all channels for this document
    const channelKeys = [
      `${documentId}:document`,
      `${documentId}:presence`,
      `${documentId}:cursor`,
    ]

    channelKeys.forEach((key) => {
      const channel = this.channels.get(key)
      if (channel) {
        channel.unsubscribe()
        this.channels.delete(key)
      }
    })

    // Clean up reconnect state
    this.reconnectAttempts.delete(documentId)
    const timeout = this.reconnectTimeouts.get(documentId)
    if (timeout) {
      clearTimeout(timeout)
      this.reconnectTimeouts.delete(documentId)
    }
  }

  /**
   * Broadcast document update to all collaborators
   * 
   * @param documentId - Document ID
   * @param userId - User ID performing the update
   * @param userName - User name
   * @param content - Updated content
   * @returns Promise resolving to broadcast response
   */
  async broadcastDocumentUpdate(
    documentId: string,
    userId: string,
    userName: string,
    content: any
  ): Promise<RealtimeChannelSendResponse> {
    const channel = this.channels.get(`${documentId}:document`)
    
    if (!channel) {
      throw new Error('Document channel not found. Subscribe first.')
    }

    const payload: DocumentUpdatePayload = {
      documentId,
      userId,
      userName,
      content,
      timestamp: new Date().toISOString(),
    }

    return channel.send({
      type: 'broadcast',
      event: 'document_update',
      payload,
    })
  }

  /**
   * Broadcast cursor position to all collaborators
   * 
   * @param documentId - Document ID
   * @param userId - User ID
   * @param userName - User name
   * @param userColor - User color
   * @param position - Cursor position
   * @returns Promise resolving to broadcast response
   */
  async broadcastCursorPosition(
    documentId: string,
    userId: string,
    userName: string,
    userColor: string,
    position: { from: number; to: number }
  ): Promise<RealtimeChannelSendResponse> {
    const channel = this.channels.get(`${documentId}:cursor`)
    
    if (!channel) {
      throw new Error('Cursor channel not found. Subscribe first.')
    }

    const payload: CursorPositionPayload = {
      documentId,
      userId,
      userName,
      userColor,
      position,
    }

    return channel.send({
      type: 'broadcast',
      event: 'cursor_moved',
      payload,
    })
  }

  /**
   * Broadcast presence status to all collaborators
   * 
   * @param documentId - Document ID
   * @param userId - User ID
   * @param userName - User name
   * @param userColor - User color
   * @param status - Presence status
   * @returns Promise resolving to broadcast response
   */
  async broadcastPresence(
    documentId: string,
    userId: string,
    userName: string,
    userColor: string,
    status: 'active' | 'idle' | 'away'
  ): Promise<RealtimeChannelSendResponse> {
    const channel = this.channels.get(`${documentId}:presence`)
    
    if (!channel) {
      throw new Error('Presence channel not found. Subscribe first.')
    }

    const payload: PresencePayload = {
      documentId,
      userId,
      userName,
      userColor,
      status,
    }

    return channel.send({
      type: 'broadcast',
      event: 'presence_changed',
      payload,
    })
  }

  /**
   * Broadcast user joined event
   * 
   * @param documentId - Document ID
   * @param userId - User ID
   * @param userName - User name
   * @param userColor - User color
   * @returns Promise resolving to broadcast response
   */
  async broadcastUserJoined(
    documentId: string,
    userId: string,
    userName: string,
    userColor: string
  ): Promise<RealtimeChannelSendResponse> {
    const channel = this.channels.get(`${documentId}:document`)
    
    if (!channel) {
      throw new Error('Document channel not found. Subscribe first.')
    }

    const payload: UserJoinedPayload = {
      documentId,
      userId,
      userName,
      userColor,
    }

    return channel.send({
      type: 'broadcast',
      event: 'user_joined',
      payload,
    })
  }

  /**
   * Broadcast user left event
   * 
   * @param documentId - Document ID
   * @param userId - User ID
   * @returns Promise resolving to broadcast response
   */
  async broadcastUserLeft(
    documentId: string,
    userId: string
  ): Promise<RealtimeChannelSendResponse> {
    const channel = this.channels.get(`${documentId}:document`)
    
    if (!channel) {
      throw new Error('Document channel not found. Subscribe first.')
    }

    const payload: UserLeftPayload = {
      documentId,
      userId,
    }

    return channel.send({
      type: 'broadcast',
      event: 'user_left',
      payload,
    })
  }

  /**
   * Broadcast rollback notification
   * 
   * @param documentId - Document ID
   * @param versionId - Version ID that was restored
   * @param versionNumber - Version number
   * @param performedBy - User ID who performed the rollback
   * @param performedByName - User name
   * @returns Promise resolving to broadcast response
   */
  async broadcastRollback(
    documentId: string,
    versionId: string,
    versionNumber: number,
    performedBy: string,
    performedByName: string
  ): Promise<RealtimeChannelSendResponse> {
    const channel = this.channels.get(`${documentId}:document`)
    
    if (!channel) {
      throw new Error('Document channel not found. Subscribe first.')
    }

    const payload: RollbackNotificationPayload = {
      documentId,
      versionId,
      versionNumber,
      performedBy,
      performedByName,
      timestamp: new Date().toISOString(),
    }

    return channel.send({
      type: 'broadcast',
      event: 'rollback',
      payload,
    })
  }

  /**
   * Get connection status for a document
   * 
   * @param documentId - Document ID
   * @returns Connection status
   */
  getConnectionStatus(documentId: string): 'connected' | 'connecting' | 'disconnected' {
    const documentChannel = this.channels.get(`${documentId}:document`)
    
    if (!documentChannel) {
      return 'disconnected'
    }

    // Check channel state
    const state = documentChannel.state
    
    if (state === 'joined') {
      return 'connected'
    } else if (state === 'joining') {
      return 'connecting'
    } else {
      return 'disconnected'
    }
  }

  /**
   * Handle subscription status changes
   * Implements exponential backoff for reconnection
   * 
   * @param documentId - Document ID
   * @param channelType - Type of channel (document, presence, cursor)
   * @param status - Subscription status
   * @param onStatusChange - Status change callback
   * @param reconnectFn - Function to call for reconnection
   */
  private handleSubscriptionStatus(
    documentId: string,
    channelType: string,
    status: string,
    onStatusChange?: (status: 'connected' | 'connecting' | 'disconnected') => void,
    reconnectFn?: () => void
  ): void {
    if (status === 'SUBSCRIBED') {
      onStatusChange?.('connected')
      this.reconnectAttempts.set(documentId, 0)
    } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
      onStatusChange?.('disconnected')
      this.attemptReconnect(documentId, reconnectFn)
    } else if (status === 'SUBSCRIBING') {
      onStatusChange?.('connecting')
    }
  }

  /**
   * Attempt to reconnect with exponential backoff
   * 
   * @param documentId - Document ID
   * @param reconnectFn - Function to call for reconnection
   */
  private attemptReconnect(documentId: string, reconnectFn?: () => void): void {
    const attempts = this.reconnectAttempts.get(documentId) || 0

    if (attempts >= this.maxReconnectAttempts) {
      console.error(`Max reconnection attempts reached for document ${documentId}`)
      return
    }

    // Calculate exponential backoff: 1s, 2s, 4s, 8s, 16s
    const backoffTime = Math.min(1000 * Math.pow(2, attempts), 16000)
    this.reconnectAttempts.set(documentId, attempts + 1)

    // Clear existing timeout
    const existingTimeout = this.reconnectTimeouts.get(documentId)
    if (existingTimeout) {
      clearTimeout(existingTimeout)
    }

    // Set new timeout for reconnection
    const timeout = setTimeout(() => {
      if (reconnectFn) {
        reconnectFn()
      }
    }, backoffTime)

    this.reconnectTimeouts.set(documentId, timeout)
  }

  /**
   * Manually trigger reconnection for a document
   * Resets reconnection attempts counter
   * 
   * @param documentId - Document ID
   * @param handlers - Event handlers
   */
  reconnect(documentId: string, handlers: DocumentRealtimeHandlers): void {
    this.reconnectAttempts.set(documentId, 0)
    this.unsubscribeFromDocument(documentId)
    this.subscribeToDocument(documentId, handlers)
  }
}

// Export singleton instance
export const realtimeDocumentService = new RealtimeDocumentService()
