/**
 * Custom hook for Browser Notifications
 * 
 * Provides browser notification functionality with permission management,
 * display logic, and graceful degradation.
 * 
 * Requirements: 16.1, 16.2, 16.3, 16.4, 16.5
 */

import { useEffect, useState, useCallback } from 'react'
import {
  browserNotificationService,
  BrowserNotificationPermission,
  BrowserNotificationOptions,
} from '@/lib/browser-notification-service'
import { Notification, NotificationPriority } from '@/lib/notification-service'

export interface UseBrowserNotificationsOptions {
  /**
   * Whether to automatically request permission on mount
   * Requirement 16.1: Request permission on first login
   */
  autoRequestPermission?: boolean

  /**
   * Whether browser notifications are enabled
   */
  enabled?: boolean
}

export interface BrowserNotificationsState {
  /**
   * Whether browser notifications are supported
   * Requirement 16.5: Check support for graceful degradation
   */
  isSupported: boolean

  /**
   * Current permission status
   */
  permission: BrowserNotificationPermission

  /**
   * Whether permission has been requested
   */
  hasRequestedPermission: boolean

  /**
   * Request notification permission
   * Requirement 16.1: Request permission
   */
  requestPermission: () => Promise<BrowserNotificationPermission>

  /**
   * Show a browser notification
   * Requirements 16.2, 16.3: Display notification with title and body
   */
  showNotification: (options: BrowserNotificationOptions) => Promise<void>

  /**
   * Show notification for a BidSync notification event
   * Requirement 16.2: Display for high-priority notifications
   */
  showNotificationForEvent: (
    notification: Notification,
    priority?: NotificationPriority
  ) => Promise<void>

  /**
   * Close a specific notification
   */
  closeNotification: (tag: string) => void

  /**
   * Close all notifications
   */
  closeAllNotifications: () => void
}

/**
 * Hook for managing browser notifications
 * 
 * Features:
 * - Check browser notification support
 * - Request notification permissions
 * - Display browser notifications
 * - Handle notification clicks (automatic via service)
 * - Graceful degradation for unsupported browsers
 * 
 * Requirements:
 * - 16.1: Request permission on first login
 * - 16.2: Display for high-priority notifications
 * - 16.3: Include title and body
 * - 16.4: Handle clicks (automatic)
 * - 16.5: Graceful degradation
 * 
 * @param options Configuration options
 * @returns Browser notifications state and utilities
 */
export function useBrowserNotifications(
  options: UseBrowserNotificationsOptions = {}
): BrowserNotificationsState {
  const { autoRequestPermission = false, enabled = true } = options

  const [isSupported, setIsSupported] = useState(false)
  const [permission, setPermission] = useState<BrowserNotificationPermission>('default')
  const [hasRequestedPermission, setHasRequestedPermission] = useState(false)

  // Initialize support and permission state
  useEffect(() => {
    // Requirement 16.5: Check if browser notifications are supported
    const supported = browserNotificationService.isSupported()
    setIsSupported(supported)

    if (supported) {
      const currentPermission = browserNotificationService.getPermission()
      setPermission(currentPermission)
      setHasRequestedPermission(
        browserNotificationService.hasRequestedPermission()
      )
    }
  }, [])

  // Auto-request permission if enabled
  // Requirement 16.1: Request permission on first login
  useEffect(() => {
    if (
      autoRequestPermission &&
      enabled &&
      isSupported &&
      !hasRequestedPermission &&
      permission === 'default'
    ) {
      requestPermission()
    }
  }, [autoRequestPermission, enabled, isSupported, hasRequestedPermission, permission])

  /**
   * Request notification permission
   * 
   * Requirement 16.1: Request permission from user
   */
  const requestPermission = useCallback(async (): Promise<BrowserNotificationPermission> => {
    if (!isSupported) {
      return 'denied'
    }

    const newPermission = await browserNotificationService.requestPermission()
    setPermission(newPermission)
    setHasRequestedPermission(true)
    return newPermission
  }, [isSupported])

  /**
   * Show a browser notification
   * 
   * Requirements:
   * - 16.2: Display notification
   * - 16.3: Include title and body
   */
  const showNotification = useCallback(
    async (notificationOptions: BrowserNotificationOptions): Promise<void> => {
      if (!enabled || !isSupported) {
        return
      }

      const result = await browserNotificationService.showNotification(
        notificationOptions
      )

      if (!result.success) {
        console.warn('Failed to show browser notification:', result.error)
      }
    },
    [enabled, isSupported]
  )

  /**
   * Show notification for a BidSync notification event
   * 
   * Requirement 16.2: Display browser notifications for high-priority notifications
   */
  const showNotificationForEvent = useCallback(
    async (
      notification: Notification,
      priority: NotificationPriority = NotificationPriority.MEDIUM
    ): Promise<void> => {
      if (!enabled || !isSupported) {
        return
      }

      const result = await browserNotificationService.showNotificationForEvent(
        notification,
        priority
      )

      if (!result.success && result.error) {
        // Only log if it's an actual error (not just low priority)
        if (!result.error.includes('priority')) {
          console.warn('Failed to show browser notification:', result.error)
        }
      }
    },
    [enabled, isSupported]
  )

  /**
   * Close a specific notification
   */
  const closeNotification = useCallback((tag: string): void => {
    browserNotificationService.closeNotification(tag)
  }, [])

  /**
   * Close all notifications
   */
  const closeAllNotifications = useCallback((): void => {
    browserNotificationService.closeAllNotifications()
  }, [])

  return {
    isSupported,
    permission,
    hasRequestedPermission,
    requestPermission,
    showNotification,
    showNotificationForEvent,
    closeNotification,
    closeAllNotifications,
  }
}
