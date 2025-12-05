/**
 * Browser Notification Service
 * 
 * Manages browser (system) notifications for the BidSync platform.
 * Handles permission requests, notification display, click handling,
 * and graceful degradation for unsupported browsers.
 * 
 * Requirements:
 * - 16.1: Request browser notification permission on first login
 * - 16.2: Display browser notifications for high-priority notifications
 * - 16.3: Include notification title and body in browser notifications
 * - 16.4: Handle browser notification clicks (focus app and navigate)
 * - 16.5: Gracefully degrade for unsupported browsers
 */

import type { Notification as BidSyncNotification } from './notification-types'
import { NotificationPriority } from './notification-types'

export type BrowserNotificationPermission = 'granted' | 'denied' | 'default'

export interface BrowserNotificationOptions {
  title: string
  body?: string
  icon?: string
  badge?: string
  tag?: string
  data?: any
  requireInteraction?: boolean
}

export interface BrowserNotificationResult {
  success: boolean
  permission?: BrowserNotificationPermission
  error?: string
  notificationInstance?: globalThis.Notification
}

/**
 * Browser Notification Service
 * 
 * Provides methods for:
 * - Checking browser notification support
 * - Requesting notification permissions
 * - Displaying browser notifications
 * - Handling notification clicks
 * - Managing notification lifecycle
 * 
 * Requirements:
 * - 16.1: Permission request on first login
 * - 16.2: Display for high-priority notifications
 * - 16.3: Include title and body
 * - 16.4: Handle clicks to focus app
 * - 16.5: Graceful degradation
 */
export class BrowserNotificationService {
  private static instance: BrowserNotificationService
  private permissionRequested = false
  private activeNotifications: Map<string, globalThis.Notification> = new Map()

  private constructor() {
    // Private constructor for singleton
    this.setupNotificationClickHandler()
  }

  /**
   * Get singleton instance
   */
  static getInstance(): BrowserNotificationService {
    if (!BrowserNotificationService.instance) {
      BrowserNotificationService.instance = new BrowserNotificationService()
    }
    return BrowserNotificationService.instance
  }

  /**
   * Check if browser notifications are supported
   * 
   * Requirement 16.5: Gracefully degrade for unsupported browsers
   * 
   * @returns Whether browser notifications are supported
   */
  isSupported(): boolean {
    return typeof window !== 'undefined' && 'Notification' in window
  }

  /**
   * Get current notification permission status
   * 
   * @returns Current permission status or 'denied' if not supported
   */
  getPermission(): BrowserNotificationPermission {
    if (!this.isSupported()) {
      return 'denied'
    }
    return Notification.permission as BrowserNotificationPermission
  }

  /**
   * Check if permission has been requested before
   * 
   * @returns Whether permission has been requested
   */
  hasRequestedPermission(): boolean {
    return this.permissionRequested || this.getPermission() !== 'default'
  }

  /**
   * Request browser notification permission
   * 
   * Requirement 16.1: Request permission on first login
   * 
   * Should be called when:
   * - User logs in for the first time
   * - User explicitly enables browser notifications in settings
   * 
   * @returns Promise resolving to permission status
   */
  async requestPermission(): Promise<BrowserNotificationPermission> {
    // Requirement 16.5: Check support first
    if (!this.isSupported()) {
      console.warn('Browser notifications are not supported')
      return 'denied'
    }

    // Check if already granted or denied
    const currentPermission = this.getPermission()
    if (currentPermission !== 'default') {
      return currentPermission
    }

    try {
      this.permissionRequested = true
      const permission = await Notification.requestPermission()
      return permission as BrowserNotificationPermission
    } catch (error) {
      console.error('Error requesting notification permission:', error)
      return 'denied'
    }
  }

  /**
   * Display a browser notification
   * 
   * Requirements:
   * - 16.2: Display for high-priority notifications
   * - 16.3: Include title and body
   * 
   * @param options - Notification options
   * @returns Result with notification instance
   */
  async showNotification(
    options: BrowserNotificationOptions
  ): Promise<BrowserNotificationResult> {
    // Requirement 16.5: Check support
    if (!this.isSupported()) {
      return {
        success: false,
        error: 'Browser notifications not supported',
      }
    }

    // Check permission
    const permission = this.getPermission()
    if (permission !== 'granted') {
      return {
        success: false,
        permission,
        error: `Notification permission is ${permission}`,
      }
    }

    try {
      // Requirement 16.3: Include title and body
      const notification = new Notification(options.title, {
        body: options.body,
        icon: options.icon || '/favicon.ico',
        badge: options.badge || '/favicon.ico',
        tag: options.tag,
        data: options.data,
        requireInteraction: options.requireInteraction || false,
      })

      // Store notification instance
      if (options.tag) {
        this.activeNotifications.set(options.tag, notification)
      }

      // Requirement 16.4: Handle notification click
      notification.onclick = (event) => {
        event.preventDefault()
        this.handleNotificationClick(options.data)
      }

      // Clean up when notification is closed
      notification.onclose = () => {
        if (options.tag) {
          this.activeNotifications.delete(options.tag)
        }
      }

      return {
        success: true,
        permission: 'granted',
        notificationInstance: notification,
      }
    } catch (error) {
      console.error('Error showing browser notification:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Show notification for a BidSync notification
   * 
   * Requirement 16.2: Display browser notifications for high-priority notifications
   * 
   * @param notification - BidSync notification object
   * @param priority - Notification priority
   * @returns Result with notification instance
   */
  async showNotificationForEvent(
    notification: BidSyncNotification,
    priority: NotificationPriority = NotificationPriority.MEDIUM
  ): Promise<BrowserNotificationResult> {
    // Requirement 16.2: Only show for high-priority notifications
    if (
      priority !== NotificationPriority.HIGH &&
      priority !== NotificationPriority.CRITICAL
    ) {
      return {
        success: false,
        error: 'Notification priority is not high enough for browser notification',
      }
    }

    // Requirement 16.3: Include title and body
    return this.showNotification({
      title: notification.title,
      body: notification.body,
      tag: notification.id,
      data: {
        notificationId: notification.id,
        type: notification.type,
        ...notification.data,
      },
      requireInteraction: priority === NotificationPriority.CRITICAL,
    })
  }

  /**
   * Handle notification click
   * 
   * Requirement 16.4: Focus application tab and navigate to relevant page
   * 
   * @param data - Notification data
   */
  private handleNotificationClick(data: any): void {
    // Focus the window
    if (typeof window !== 'undefined') {
      window.focus()
    }

    // Navigate to relevant page based on notification type and data
    if (data && typeof window !== 'undefined') {
      const url = this.getNavigationUrl(data)
      if (url) {
        window.location.href = url
      }
    }
  }

  /**
   * Get navigation URL based on notification data
   * 
   * @param data - Notification data
   * @returns URL to navigate to
   */
  private getNavigationUrl(data: any): string | null {
    const { type, projectId, proposalId, documentId, notificationId } = data

    // Project-related notifications
    if (type?.startsWith('project_') && projectId) {
      return `/client-projects/${projectId}`
    }

    // Proposal-related notifications
    if (type?.startsWith('proposal_') && proposalId) {
      return `/lead/proposals/${proposalId}`
    }

    // Document-related notifications
    if (type?.startsWith('document_') || type?.startsWith('section_')) {
      if (documentId) {
        return `/editor/${documentId}`
      }
    }

    // Team-related notifications
    if (type?.startsWith('team_') && projectId) {
      return `/workspace/${projectId}`
    }

    // Delivery-related notifications
    if (
      type === 'ready_for_delivery' ||
      type === 'completion_accepted' ||
      type === 'revision_requested'
    ) {
      if (projectId) {
        return `/client-projects/${projectId}`
      }
    }

    // Admin notifications
    if (type?.startsWith('admin_') || type?.startsWith('verification_')) {
      return '/admin'
    }

    // Default: go to notifications page or home
    return '/'
  }

  /**
   * Setup global notification click handler
   * 
   * Handles clicks on notifications when app is in background
   */
  private setupNotificationClickHandler(): void {
    if (typeof window === 'undefined') {
      return
    }

    // Listen for service worker notification clicks (if using service worker)
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'notification-click') {
          this.handleNotificationClick(event.data.data)
        }
      })
    }
  }

  /**
   * Close a specific notification
   * 
   * @param tag - Notification tag
   */
  closeNotification(tag: string): void {
    const notification = this.activeNotifications.get(tag)
    if (notification) {
      notification.close()
      this.activeNotifications.delete(tag)
    }
  }

  /**
   * Close all active notifications
   */
  closeAllNotifications(): void {
    this.activeNotifications.forEach((notification) => {
      notification.close()
    })
    this.activeNotifications.clear()
  }

  /**
   * Check if should show browser notification based on user preferences
   * 
   * @param priority - Notification priority
   * @param userPreferences - User notification preferences
   * @returns Whether to show browser notification
   */
  shouldShowBrowserNotification(
    priority: NotificationPriority,
    userPreferences?: { browserNotifications?: boolean }
  ): boolean {
    // Check if browser notifications are enabled in user preferences
    if (userPreferences && userPreferences.browserNotifications === false) {
      return false
    }

    // Only show for high and critical priority
    return (
      priority === NotificationPriority.HIGH ||
      priority === NotificationPriority.CRITICAL
    )
  }
}

// Export singleton instance
export const browserNotificationService = BrowserNotificationService.getInstance()
