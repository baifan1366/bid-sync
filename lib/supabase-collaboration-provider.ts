/**
 * Supabase Collaboration Provider
 * 
 * Replaces Yjs WebSocket provider with Supabase Realtime for collaborative editing.
 * Uses Supabase Broadcast channels for document synchronization.
 * 
 * Requirements: 3.1, 3.3, 3.5
 */

import { createClient } from '@/lib/supabase/client'
import { RealtimeChannel, RealtimeChannelSendResponse } from '@supabase/supabase-js'

export interface CollaborationUser {
  id: string
  name: string
  color: string
  cursor?: { from: number; to: number }
}

export interface DocumentUpdate {
  userId: string
  userName: string
  content: any
  timestamp: string
}

export interface CollaborationProviderConfig {
  documentId: string
  userId: string
  userName: string
  userColor: string
  onSync?: (synced: boolean) => void
  onConnectionStatus?: (status: 'connected' | 'disconnected' | 'reconnecting') => void
  onDocumentUpdate?: (update: DocumentUpdate) => void
  onUserJoined?: (user: CollaborationUser) => void
  onUserLeft?: (userId: string) => void
  onCursorUpdate?: (userId: string, cursor: { from: number; to: number } | null) => void
  onPresenceChange?: (users: CollaborationUser[]) => void
}

/**
 * Supabase Collaboration Provider
 * 
 * Manages real-time collaboration using Supabase Realtime channels.
 */
export class SupabaseCollaborationProvider {
  private documentId: string
  private userId: string
  private userName: string
  private userColor: string
  private channel: RealtimeChannel | null = null
  private presenceChannel: RealtimeChannel | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectTimeout: NodeJS.Timeout | null = null
  private synced = false
  private connected = false
  
  // Callbacks
  private onSync?: (synced: boolean) => void
  private onConnectionStatus?: (status: 'connected' | 'disconnected' | 'reconnecting') => void
  private onDocumentUpdate?: (update: DocumentUpdate) => void
  private onUserJoined?: (user: CollaborationUser) => void
  private onUserLeft?: (userId: string) => void
  private onCursorUpdate?: (userId: string, cursor: { from: number; to: number } | null) => void
  private onPresenceChange?: (users: CollaborationUser[]) => void

  // Active users tracking
  private activeUsers: Map<string, CollaborationUser> = new Map()

  constructor(config: CollaborationProviderConfig) {
    this.documentId = config.documentId
    this.userId = config.userId
    this.userName = config.userName
    this.userColor = config.userColor
    this.onSync = config.onSync
    this.onConnectionStatus = config.onConnectionStatus
    this.onDocumentUpdate = config.onDocumentUpdate
    this.onUserJoined = config.onUserJoined
    this.onUserLeft = config.onUserLeft
    this.onCursorUpdate = config.onCursorUpdate
    this.onPresenceChange = config.onPresenceChange
  }

  /**
   * Connect to the collaboration channel
   */
  async connect(): Promise<void> {
    const supabase = createClient()

    // Create main document channel
    const channelName = `collab:${this.documentId}`
    this.channel = supabase.channel(channelName)

    // Listen for document updates
    this.channel.on('broadcast', { event: 'document_update' }, (payload) => {
      const update = payload.payload as DocumentUpdate
      // Don't process our own updates
      if (update.userId !== this.userId) {
        this.onDocumentUpdate?.(update)
      }
    })

    // Listen for cursor updates
    this.channel.on('broadcast', { event: 'cursor_update' }, (payload) => {
      const { userId, cursor } = payload.payload as { userId: string; cursor: { from: number; to: number } | null }
      if (userId !== this.userId) {
        this.onCursorUpdate?.(userId, cursor)
        // Update active user cursor
        const user = this.activeUsers.get(userId)
        if (user) {
          user.cursor = cursor || undefined
          this.activeUsers.set(userId, user)
        }
      }
    })

    // Subscribe to channel
    this.channel.subscribe((status) => {
      this.handleSubscriptionStatus(status)
    })

    // Create presence channel for user tracking
    const presenceChannelName = `presence:${this.documentId}`
    this.presenceChannel = supabase.channel(presenceChannelName, {
      config: {
        presence: {
          key: this.userId,
        },
      },
    })

    // Track presence sync
    this.presenceChannel.on('presence', { event: 'sync' }, () => {
      const state = this.presenceChannel?.presenceState() || {}
      this.updateActiveUsers(state)
    })

    // Track user joins
    this.presenceChannel.on('presence', { event: 'join' }, ({ key, newPresences }) => {
      const presence = newPresences[0] as any
      if (presence && key !== this.userId) {
        const user: CollaborationUser = {
          id: key,
          name: presence.userName || 'Anonymous',
          color: presence.userColor || '#000000',
        }
        this.activeUsers.set(key, user)
        this.onUserJoined?.(user)
        this.notifyPresenceChange()
      }
    })

    // Track user leaves
    this.presenceChannel.on('presence', { event: 'leave' }, ({ key }) => {
      if (key !== this.userId) {
        this.activeUsers.delete(key)
        this.onUserLeft?.(key)
        this.notifyPresenceChange()
      }
    })

    // Subscribe to presence channel and track our presence
    this.presenceChannel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await this.presenceChannel?.track({
          userId: this.userId,
          userName: this.userName,
          userColor: this.userColor,
          online_at: new Date().toISOString(),
        })
      }
    })
  }

  /**
   * Disconnect from the collaboration channel
   */
  async disconnect(): Promise<void> {
    // Clear reconnect timeout
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
      this.reconnectTimeout = null
    }

    // Untrack presence
    if (this.presenceChannel) {
      await this.presenceChannel.untrack()
      this.presenceChannel.unsubscribe()
      this.presenceChannel = null
    }

    // Unsubscribe from main channel
    if (this.channel) {
      this.channel.unsubscribe()
      this.channel = null
    }

    this.connected = false
    this.synced = false
    this.activeUsers.clear()
  }

  /**
   * Broadcast document update to all collaborators
   */
  async broadcastUpdate(content: any): Promise<RealtimeChannelSendResponse | null> {
    if (!this.channel || !this.connected) {
      return null
    }

    const update: DocumentUpdate = {
      userId: this.userId,
      userName: this.userName,
      content,
      timestamp: new Date().toISOString(),
    }

    return this.channel.send({
      type: 'broadcast',
      event: 'document_update',
      payload: update,
    })
  }

  /**
   * Broadcast cursor position to all collaborators
   */
  async broadcastCursor(cursor: { from: number; to: number } | null): Promise<RealtimeChannelSendResponse | null> {
    if (!this.channel || !this.connected) {
      return null
    }

    return this.channel.send({
      type: 'broadcast',
      event: 'cursor_update',
      payload: {
        userId: this.userId,
        cursor,
      },
    })
  }

  /**
   * Get active users
   */
  getActiveUsers(): CollaborationUser[] {
    return Array.from(this.activeUsers.values())
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected
  }

  /**
   * Check if synced
   */
  isSynced(): boolean {
    return this.synced
  }

  /**
   * Handle subscription status changes
   */
  private handleSubscriptionStatus(status: string): void {
    if (status === 'SUBSCRIBED') {
      this.connected = true
      this.synced = true
      this.reconnectAttempts = 0
      this.onConnectionStatus?.('connected')
      this.onSync?.(true)
    } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
      this.connected = false
      this.synced = false
      this.onConnectionStatus?.('disconnected')
      this.onSync?.(false)
      this.attemptReconnect()
    } else if (status === 'SUBSCRIBING') {
      this.onConnectionStatus?.('reconnecting')
    }
  }

  /**
   * Attempt to reconnect with exponential backoff
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached')
      return
    }

    const backoffTime = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 16000)
    this.reconnectAttempts++

    this.onConnectionStatus?.('reconnecting')

    this.reconnectTimeout = setTimeout(() => {
      this.connect()
    }, backoffTime)
  }

  /**
   * Update active users from presence state
   */
  private updateActiveUsers(state: Record<string, any[]>): void {
    this.activeUsers.clear()

    Object.entries(state).forEach(([key, presences]) => {
      if (key !== this.userId && presences.length > 0) {
        const presence = presences[0] as any
        this.activeUsers.set(key, {
          id: key,
          name: presence.userName || 'Anonymous',
          color: presence.userColor || '#000000',
        })
      }
    })

    this.notifyPresenceChange()
  }

  /**
   * Notify presence change
   */
  private notifyPresenceChange(): void {
    this.onPresenceChange?.(this.getActiveUsers())
  }
}

/**
 * Create a Supabase collaboration provider
 */
export function createCollaborationProvider(
  config: CollaborationProviderConfig
): SupabaseCollaborationProvider {
  return new SupabaseCollaborationProvider(config)
}
