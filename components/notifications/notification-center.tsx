/**
 * NotificationCenter Component
 * 
 * Main notification component that integrates:
 * - NotificationBell with unread badge
 * - NotificationDropdown with notification list
 * - Real-time notification subscription
 * - Toast notifications for new notifications
 * - Browser notifications for high-priority events
 * 
 * Requirements:
 * - 1.2: Display unread notification count in header
 * - 1.3: Display dropdown list of recent notifications
 * - 1.4: Mark notification as read and navigate
 * - 1.5: Display visual indicator (badge) on notification bell
 * - 3.1: Establish Realtime subscription when user is logged in
 * - 3.2: Receive new notifications immediately
 * - 3.3: Display toast notification
 * - 3.4: Automatically reconnect and sync missed notifications
 * - 3.5: Unsubscribe when component unmounts
 * - 16.1: Request browser notification permission on first login
 * - 16.2: Display browser notifications for high-priority notifications
 * - 16.3: Include notification title and body in browser notifications
 * - 16.4: Handle browser notification clicks
 * - 16.5: Gracefully degrade for unsupported browsers
 */

'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Notification, NotificationService, NotificationPriority } from '@/lib/notification-service'
import { useRealtimeNotifications } from '@/hooks/use-realtime-notifications'
import { useBrowserNotifications } from '@/hooks/use-browser-notifications'
import { NotificationBell } from './notification-bell'
import { NotificationDropdown } from './notification-dropdown'
import { NotificationToast } from './notification-toast'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

interface NotificationCenterProps {
  userId: string
  className?: string
  /**
   * Whether to enable browser notifications
   * Requirement 16.1: Request permission on first login
   */
  enableBrowserNotifications?: boolean
}

export function NotificationCenter({
  userId,
  className,
  enableBrowserNotifications = true,
}: NotificationCenterProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [newNotification, setNewNotification] = useState<Notification | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Requirement 16.1, 16.2, 16.3, 16.4, 16.5: Browser notification integration
  const {
    isSupported: browserNotificationsSupported,
    permission: browserNotificationPermission,
    showNotificationForEvent,
  } = useBrowserNotifications({
    autoRequestPermission: enableBrowserNotifications,
    enabled: enableBrowserNotifications,
  })

  // Load initial notifications
  const loadNotifications = useCallback(async () => {
    try {
      const [notifs, count] = await Promise.all([
        NotificationService.getNotifications(userId, { limit: 50 }),
        NotificationService.getUnreadCount(userId),
      ])
      
      setNotifications(notifs)
      setUnreadCount(count)
    } catch (error) {
      console.error('Error loading notifications:', error)
    } finally {
      setIsLoading(false)
    }
  }, [userId])

  // Initial load
  useEffect(() => {
    loadNotifications()
  }, [loadNotifications])

  // Helper to determine notification priority
  const getNotificationPriority = useCallback((notification: Notification): NotificationPriority => {
    // Critical notifications
    if (
      notification.type === 'account_suspended' ||
      notification.type === 'verification_rejected'
    ) {
      return NotificationPriority.CRITICAL
    }

    // High priority notifications
    if (
      notification.type === 'proposal_accepted' ||
      notification.type === 'proposal_rejected' ||
      notification.type === 'project_deadline_approaching' ||
      notification.type === 'ready_for_delivery' ||
      notification.type === 'revision_requested' ||
      notification.type === 'verification_approved'
    ) {
      return NotificationPriority.HIGH
    }

    // Medium priority by default
    return NotificationPriority.MEDIUM
  }, [])

  // Requirement 3.1, 3.2, 3.4, 3.5: Subscribe to real-time notifications
  const {
    connectionStatus,
    isSubscribed,
    missedNotifications,
  } = useRealtimeNotifications({
    userId,
    enabled: true,
    onNewNotification: (notification) => {
      // Requirement 3.2: Receive new notifications immediately
      setNotifications((prev) => [notification, ...prev])
      setUnreadCount((prev) => prev + 1)
      
      // Requirement 3.3: Show toast notification
      setNewNotification(notification)

      // Requirement 16.2: Show browser notification for high-priority notifications
      if (enableBrowserNotifications && browserNotificationsSupported) {
        const priority = getNotificationPriority(notification)
        showNotificationForEvent(notification, priority).catch((error) => {
          console.error('Error showing browser notification:', error)
        })
      }
    },
    onNotificationRead: (notificationId) => {
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notificationId ? { ...n, read: true } : n
        )
      )
      setUnreadCount((prev) => Math.max(0, prev - 1))
    },
    onNotificationDeleted: (notificationId) => {
      setNotifications((prev) => {
        const notification = prev.find((n) => n.id === notificationId)
        const wasUnread = notification && !notification.read
        
        if (wasUnread) {
          setUnreadCount((count) => Math.max(0, count - 1))
        }
        
        return prev.filter((n) => n.id !== notificationId)
      })
    },
  })

  // Requirement 3.4: Handle missed notifications after reconnection
  useEffect(() => {
    if (missedNotifications.length > 0) {
      setNotifications((prev) => {
        const existingIds = new Set(prev.map((n) => n.id))
        const newNotifs = missedNotifications.filter((n) => !existingIds.has(n.id))
        return [...newNotifs, ...prev]
      })
      
      const unreadMissed = missedNotifications.filter((n) => !n.read).length
      setUnreadCount((prev) => prev + unreadMissed)
    }
  }, [missedNotifications])

  const handleNotificationsChange = useCallback(() => {
    loadNotifications()
  }, [loadNotifications])

  return (
    <>
      <div className={cn('relative', className)}>
        <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
          <DropdownMenuTrigger asChild>
            <div>
              <NotificationBell
                unreadCount={unreadCount}
                onClick={() => setIsOpen(!isOpen)}
                isOpen={isOpen}
              />
            </div>
          </DropdownMenuTrigger>
          
          <DropdownMenuContent
            align="end"
            className="p-0 border-0 shadow-none bg-transparent"
            sideOffset={8}
          >
            <NotificationDropdown
              userId={userId}
              notifications={notifications}
              onNotificationsChange={handleNotificationsChange}
            />
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Connection status indicator (optional, for debugging) */}
        {process.env.NODE_ENV === 'development' && (
          <div className="absolute -bottom-1 -right-1">
            <div
              className={cn(
                'h-2 w-2 rounded-full',
                connectionStatus === 'connected' && 'bg-green-500',
                connectionStatus === 'connecting' && 'bg-yellow-400',
                connectionStatus === 'disconnected' && 'bg-red-500'
              )}
              title={`Connection: ${connectionStatus}`}
            />
          </div>
        )}
      </div>

      {/* Toast notifications for new notifications */}
      <NotificationToast
        notification={newNotification}
        onDismiss={() => setNewNotification(null)}
      />
    </>
  )
}
