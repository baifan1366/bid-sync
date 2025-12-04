/**
 * Custom hook for Realtime notification updates
 * 
 * Provides real-time synchronization for notification updates using Supabase Realtime.
 * 
 * Requirements: 3.1, 3.2, 3.4, 3.5
 */

import { useEffect, useState, useCallback, useRef } from 'react'
import {
  realtimeNotificationService,
  NotificationRealtimeHandlers,
  NewNotificationPayload,
  NotificationReadPayload,
  NotificationDeletedPayload,
} from '@/lib/realtime-notification-service'
import { Notification } from '@/lib/notification-service'

export interface UseRealtimeNotificationsOptions {
  userId: string
  enabled?: boolean
  onNewNotification?: (notification: Notification) => void
  onNotificationRead?: (notificationId: string) => void
  onNotificationDeleted?: (notificationId: string) => void
}

export interface RealtimeNotificationsState {
  connectionStatus: 'connected' | 'connecting' | 'disconnected'
  isSubscribed: boolean
  missedNotifications: Notification[]
  reconnect: () => void
}

/**
 * Hook for managing real-time notification updates
 * 
 * Features:
 * - Subscribes to user's notification channel
 * - Receives new notifications in real-time
 * - Tracks connection status
 * - Automatically reconnects on connection loss
 * - Syncs missed notifications after reconnection
 * - Unsubscribes on unmount or when disabled
 * 
 * Requirements:
 * - 3.1: Establish Realtime subscription when user is logged in
 * - 3.2: Receive new notifications immediately
 * - 3.4: Automatically reconnect and sync missed notifications
 * - 3.5: Unsubscribe when component unmounts or user logs out
 * 
 * @param options Configuration options
 * @returns Realtime notifications state and utilities
 */
export function useRealtimeNotifications(
  options: UseRealtimeNotificationsOptions
): RealtimeNotificationsState {
  const {
    userId,
    enabled = true,
    onNewNotification,
    onNotificationRead,
    onNotificationDeleted,
  } = options

  const [connectionStatus, setConnectionStatus] = useState<
    'connected' | 'connecting' | 'disconnected'
  >('disconnected')

  const [missedNotifications, setMissedNotifications] = useState<Notification[]>([])

  const handlersRef = useRef<NotificationRealtimeHandlers>({})

  // Update handlers when callbacks change
  useEffect(() => {
    handlersRef.current = {
      onNewNotification: (payload: NewNotificationPayload) => {
        onNewNotification?.(payload.notification)
      },
      onNotificationRead: (payload: NotificationReadPayload) => {
        onNotificationRead?.(payload.notificationId)
      },
      onNotificationDeleted: (payload: NotificationDeletedPayload) => {
        onNotificationDeleted?.(payload.notificationId)
      },
      onConnectionStatusChange: (status: 'connected' | 'connecting' | 'disconnected') => {
        setConnectionStatus(status)

        // Sync missed notifications when reconnected
        if (status === 'connected') {
          realtimeNotificationService
            .syncMissedNotifications(userId)
            .then((notifications) => {
              if (notifications.length > 0) {
                setMissedNotifications(notifications)
                // Notify about each missed notification
                notifications.forEach((notification) => {
                  onNewNotification?.(notification)
                })
              }
            })
            .catch((error) => {
              console.error('Error syncing missed notifications:', error)
            })
        }
      },
    }
  }, [userId, onNewNotification, onNotificationRead, onNotificationDeleted])

  // Subscribe to notification channel
  // Requirement 3.1: Establish subscription when user is logged in
  useEffect(() => {
    if (!enabled || !userId) {
      return
    }

    setConnectionStatus('connecting')

    const cleanup = realtimeNotificationService.subscribeToNotifications(
      userId,
      handlersRef.current
    )

    // Requirement 3.5: Unsubscribe on cleanup
    return () => {
      cleanup()
      setConnectionStatus('disconnected')
    }
  }, [enabled, userId])

  // Reconnect function
  const reconnect = useCallback(() => {
    if (!userId) {
      return
    }

    realtimeNotificationService.reconnect(userId, handlersRef.current)
  }, [userId])

  // Check subscription status
  const isSubscribed = realtimeNotificationService.isSubscribed(userId)

  return {
    connectionStatus,
    isSubscribed,
    missedNotifications,
    reconnect,
  }
}
