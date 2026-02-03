/**
 * Realtime Notification Service
 * 
 * Manages Supabase Realtime channels for instant notification delivery.
 * Handles notification subscriptions, connection recovery, and sync logic.
 * 
 * Requirements: 3.1, 3.2, 3.4, 3.5
 */

import { createClient } from '@/lib/supabase/client'
import { RealtimeChannel, RealtimeChannelSendResponse } from '@supabase/supabase-js'
import { Notification } from './notification-service'

/**
 * New notification event payload
 */
export interface NewNotificationPayload {
  notification: Notification
}

/**
 * Notification read event payload
 */
export interface NotificationReadPayload {
  notificationId: string
  userId: string
  readAt: string
}

/**
 * Notification deleted event payload
 */
export interface NotificationDeletedPayload {
  notificationId: string
  userId: string
}

/**
 * Event handlers for notification realtime updates
 */
export interface NotificationRealtimeHandlers {
  onNewNotification?: (payload: NewNotificationPayload) => void
  onNotificationRead?: (payload: NotificationReadPayload) => void
  onNotificationDeleted?: (payload: NotificationDeletedPayload) => void
  onConnectionStatusChange?: (status: 'connected' | 'connecting' | 'disconnected') => void
}

/**
 * Realtime Notification Service
 * 
 * Provides methods for:
 * - Creating and managing Realtime notification channels
 * - Subscribing to user-specific notification updates
 * - Broadcasting notification events
 * - Handling connection recovery with exponential backoff
 * - Syncing missed notifications after reconnection
 * 
 * Requirements:
 * - 3.1: Establish Supabase Realtime subscription for notifications
 * - 3.2: Push new notifications to active sessions immediately
 * - 3.4: Automatically reconnect and sync missed notifications
 * - 3.5: Unsubscribe on logout
 */
export class RealtimeNotificationService {
  private channels: Map<string, RealtimeChannel> = new Map()
  private reconnectAttempts: Map<string, number> = new Map()
  private reconnectTimeouts: Map<string, NodeJS.Timeout> = new Map()
  private readonly maxReconnectAttempts = 5
  private lastSyncTimestamp: Map<string, string> = new Map()

  /**
   * Subscribe to user's notification updates
   * 
   * Requirement 3.1: Establish Realtime subscription when user is logged in
   * 
   * Creates a user-specific channel for:
   * 1. New notification events
   * 2. Notification read events
   * 3. Notification deleted events
   * 
   * @param userId - User ID to subscribe to
   * @param handlers - Event handlers
   * @returns Cleanup function
   */
  subscribeToNotifications(
    userId: string,
    handlers: NotificationRealtimeHandlers
  ): () => void {
    const supabase = createClient()

    // Create user-specific notification channel
    const channelName = `notifications:${userId}`
    const channel = supabase.channel(channelName)

    // Requirement 3.2: Listen for new notifications using postgres_changes
    if (handlers.onNewNotification) {
      channel.on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notification_queue',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          handlers.onNewNotification?.({
            notification: payload.new as any
          })
        }
      )
    }

    // Listen for notification read events (UPDATE with read=true)
    if (handlers.onNotificationRead) {
      channel.on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notification_queue',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          const newRecord = payload.new as any
          const oldRecord = payload.old as any
          
          // Only trigger if read status changed to true
          if (newRecord.read === true && oldRecord.read === false) {
            handlers.onNotificationRead?.({
              notificationId: newRecord.id,
              userId: newRecord.user_id,
              readAt: newRecord.read_at || new Date().toISOString()
            })
          }
        }
      )
    }

    // Listen for notification deleted events
    if (handlers.onNotificationDeleted) {
      channel.on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'notification_queue',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          const oldRecord = payload.old as any
          handlers.onNotificationDeleted?.({
            notificationId: oldRecord.id,
            userId: oldRecord.user_id
          })
        }
      )
    }

    // Subscribe to channel with connection status handling
    channel.subscribe((status) => {
      this.handleSubscriptionStatus(
        userId,
        status,
        handlers.onConnectionStatusChange,
        () => this.subscribeToNotifications(userId, handlers)
      )
    })

    this.channels.set(userId, channel)

    // Store current timestamp for sync purposes
    this.lastSyncTimestamp.set(userId, new Date().toISOString())

    // Requirement 3.5: Return cleanup function for unsubscribe
    return () => {
      this.unsubscribe(userId)
    }
  }

  /**
   * Unsubscribe from notification updates
   * 
   * Requirement 3.5: Unsubscribe when user logs out
   * 
   * @param userId - User ID to unsubscribe
   */
  unsubscribe(userId: string): void {
    const channel = this.channels.get(userId)
    if (channel) {
      channel.unsubscribe()
      this.channels.delete(userId)
    }

    // Clean up reconnect state
    this.reconnectAttempts.delete(userId)
    const timeout = this.reconnectTimeouts.get(userId)
    if (timeout) {
      clearTimeout(timeout)
      this.reconnectTimeouts.delete(userId)
    }

    // Clean up sync timestamp
    this.lastSyncTimestamp.delete(userId)
  }

  /**
   * @deprecated No longer needed - postgres_changes automatically broadcasts database changes
   * 
   * Broadcast new notification to user's active sessions
   * 
   * With postgres_changes, database INSERTs automatically trigger events.
   * This method is kept for backward compatibility but does nothing.
   * 
   * @param userId - User ID
   * @param notification - Notification object
   * @returns Promise resolving to broadcast response
   */
  async broadcastNewNotification(
    userId: string,
    notification: Notification
  ): Promise<RealtimeChannelSendResponse> {
    // No-op: postgres_changes handles this automatically
    console.warn('broadcastNewNotification is deprecated - postgres_changes handles this automatically')
    return { status: 'ok' } as unknown as RealtimeChannelSendResponse
  }

  /**
   * @deprecated No longer needed - postgres_changes automatically broadcasts database changes
   * 
   * Broadcast notification read event
   * 
   * With postgres_changes, database UPDATEs automatically trigger events.
   * This method is kept for backward compatibility but does nothing.
   * 
   * @param userId - User ID
   * @param notificationId - Notification ID that was read
   * @returns Promise resolving to broadcast response
   */
  async broadcastNotificationRead(
    userId: string,
    notificationId: string
  ): Promise<RealtimeChannelSendResponse> {
    // No-op: postgres_changes handles this automatically
    console.warn('broadcastNotificationRead is deprecated - postgres_changes handles this automatically')
    return { status: 'ok' } as unknown as RealtimeChannelSendResponse
  }

  /**
   * @deprecated No longer needed - postgres_changes automatically broadcasts database changes
   * 
   * Broadcast notification deleted event
   * 
   * With postgres_changes, database DELETEs automatically trigger events.
   * This method is kept for backward compatibility but does nothing.
   * 
   * @param userId - User ID
   * @param notificationId - Notification ID that was deleted
   * @returns Promise resolving to broadcast response
   */
  async broadcastNotificationDeleted(
    userId: string,
    notificationId: string
  ): Promise<RealtimeChannelSendResponse> {
    // No-op: postgres_changes handles this automatically
    console.warn('broadcastNotificationDeleted is deprecated - postgres_changes handles this automatically')
    return { status: 'ok' } as unknown as RealtimeChannelSendResponse
  }

  /**
   * Get connection status for a user's notification channel
   * 
   * @param userId - User ID
   * @returns Connection status
   */
  getConnectionStatus(userId: string): 'connected' | 'connecting' | 'disconnected' {
    const channel = this.channels.get(userId)
    
    if (!channel) {
      return 'disconnected'
    }

    // Check channel state
    const state = channel.state
    
    if (state === 'joined') {
      return 'connected'
    } else if (state === 'joining') {
      return 'connecting'
    } else {
      return 'disconnected'
    }
  }

  /**
   * Check if user is subscribed to notifications
   * 
   * @param userId - User ID
   * @returns Whether user is subscribed
   */
  isSubscribed(userId: string): boolean {
    return this.channels.has(userId)
  }

  /**
   * Sync missed notifications after reconnection
   * 
   * Requirement 3.4: Sync missed notifications when connection is restored
   * 
   * Fetches all notifications created since the last sync timestamp
   * and returns them for the client to process.
   * 
   * @param userId - User ID
   * @returns Promise resolving to array of missed notifications
   */
  async syncMissedNotifications(userId: string): Promise<Notification[]> {
    try {
      const supabase = createClient()
      const lastSync = this.lastSyncTimestamp.get(userId)

      if (!lastSync) {
        // No last sync timestamp, return empty array
        return []
      }

      // Fetch notifications created since last sync
      const { data: notifications, error } = await supabase
        .from('notification_queue')
        .select('*')
        .eq('user_id', userId)
        .gt('created_at', lastSync)
        .order('created_at', { ascending: true })

      if (error) {
        console.error('Error syncing missed notifications:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        })
        return []
      }

      // Update last sync timestamp
      this.lastSyncTimestamp.set(userId, new Date().toISOString())

      // Map database records to Notification objects
      return notifications ? notifications.map(this.mapNotification) : []
    } catch (error) {
      console.error('Unexpected error syncing missed notifications:', error instanceof Error ? error.message : String(error))
      return []
    }
  }

  /**
   * Handle subscription status changes
   * Implements exponential backoff for reconnection
   * 
   * Requirement 3.4: Automatically reconnect when connection is lost
   * 
   * @param userId - User ID
   * @param status - Subscription status
   * @param onStatusChange - Status change callback
   * @param reconnectFn - Function to call for reconnection
   */
  private handleSubscriptionStatus(
    userId: string,
    status: string,
    onStatusChange?: (status: 'connected' | 'connecting' | 'disconnected') => void,
    reconnectFn?: () => void
  ): void {
    if (status === 'SUBSCRIBED') {
      onStatusChange?.('connected')
      this.reconnectAttempts.set(userId, 0)
      
      // Sync missed notifications after successful reconnection
      this.syncMissedNotifications(userId).catch((error) => {
        console.error('Error syncing after reconnection:', error)
      })
    } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
      onStatusChange?.('disconnected')
      this.attemptReconnect(userId, reconnectFn)
    } else if (status === 'SUBSCRIBING') {
      onStatusChange?.('connecting')
    }
  }

  /**
   * Attempt to reconnect with exponential backoff
   * 
   * Requirement 3.4: Implement connection recovery logic
   * 
   * @param userId - User ID
   * @param reconnectFn - Function to call for reconnection
   */
  private attemptReconnect(userId: string, reconnectFn?: () => void): void {
    const attempts = this.reconnectAttempts.get(userId) || 0

    if (attempts >= this.maxReconnectAttempts) {
      console.error(`Max reconnection attempts reached for user ${userId}`)
      return
    }

    // Calculate exponential backoff: 1s, 2s, 4s, 8s, 16s
    const backoffTime = Math.min(1000 * Math.pow(2, attempts), 16000)
    this.reconnectAttempts.set(userId, attempts + 1)

    console.log(`Attempting reconnection for user ${userId} (attempt ${attempts + 1}/${this.maxReconnectAttempts}) in ${backoffTime}ms`)

    // Clear existing timeout
    const existingTimeout = this.reconnectTimeouts.get(userId)
    if (existingTimeout) {
      clearTimeout(existingTimeout)
    }

    // Set new timeout for reconnection
    const timeout = setTimeout(() => {
      if (reconnectFn) {
        reconnectFn()
      }
    }, backoffTime)

    this.reconnectTimeouts.set(userId, timeout)
  }

  /**
   * Manually trigger reconnection for a user
   * Resets reconnection attempts counter
   * 
   * @param userId - User ID
   * @param handlers - Event handlers
   */
  reconnect(userId: string, handlers: NotificationRealtimeHandlers): void {
    this.reconnectAttempts.set(userId, 0)
    this.unsubscribe(userId)
    this.subscribeToNotifications(userId, handlers)
  }

  /**
   * Maps database notification to Notification interface
   * 
   * @private
   */
  private mapNotification(notification: any): Notification {
    return {
      id: notification.id,
      userId: notification.user_id,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      data: notification.data || {},
      read: notification.read,
      readAt: notification.read_at ? new Date(notification.read_at) : undefined,
      sentViaEmail: notification.sent_via_email,
      legalHold: notification.legal_hold || false,
      createdAt: new Date(notification.created_at),
      updatedAt: new Date(notification.updated_at),
    }
  }
}

// Export singleton instance
export const realtimeNotificationService = new RealtimeNotificationService()
