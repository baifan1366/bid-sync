/**
 * Tests for useRealtimeNotifications hook
 * 
 * Tests React hook for real-time notification subscription
 * 
 * Requirements: 3.1, 3.2, 3.4, 3.5
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useRealtimeNotifications } from '../use-realtime-notifications'
import type { Notification } from '@/lib/notification-service'

// Mock the realtime notification service
vi.mock('@/lib/realtime-notification-service', () => {
  const mockSubscribe = vi.fn()
  const mockUnsubscribe = vi.fn()
  const mockIsSubscribed = vi.fn()
  const mockGetConnectionStatus = vi.fn()
  const mockSyncMissedNotifications = vi.fn()
  const mockReconnect = vi.fn()

  return {
    realtimeNotificationService: {
      subscribeToNotifications: mockSubscribe,
      unsubscribe: mockUnsubscribe,
      isSubscribed: mockIsSubscribed,
      getConnectionStatus: mockGetConnectionStatus,
      syncMissedNotifications: mockSyncMissedNotifications,
      reconnect: mockReconnect,
    },
  }
})

describe('useRealtimeNotifications', () => {
  let mockService: any

  beforeEach(async () => {
    vi.clearAllMocks()
    const module = await import('@/lib/realtime-notification-service')
    mockService = module.realtimeNotificationService
    
    vi.mocked(mockService.subscribeToNotifications).mockReturnValue(() => {})
    vi.mocked(mockService.isSubscribed).mockReturnValue(true)
    vi.mocked(mockService.getConnectionStatus).mockReturnValue('connected')
    vi.mocked(mockService.syncMissedNotifications).mockResolvedValue([])
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('subscription management', () => {
    it('should subscribe when enabled', () => {
      // Requirement 3.1: Establish subscription when enabled
      renderHook(() =>
        useRealtimeNotifications({
          userId: 'test-user-id',
          enabled: true,
        })
      )

      expect(mockService.subscribeToNotifications).toHaveBeenCalledWith(
        'test-user-id',
        expect.any(Object)
      )
    })

    it('should not subscribe when disabled', () => {
      renderHook(() =>
        useRealtimeNotifications({
          userId: 'test-user-id',
          enabled: false,
        })
      )

      expect(mockService.subscribeToNotifications).not.toHaveBeenCalled()
    })

    it('should not subscribe when userId is empty', () => {
      renderHook(() =>
        useRealtimeNotifications({
          userId: '',
          enabled: true,
        })
      )

      expect(mockService.subscribeToNotifications).not.toHaveBeenCalled()
    })

    it('should unsubscribe on unmount', () => {
      // Requirement 3.5: Unsubscribe on cleanup
      const mockCleanup = vi.fn()
      vi.mocked(mockService.subscribeToNotifications).mockReturnValue(mockCleanup)

      const { unmount } = renderHook(() =>
        useRealtimeNotifications({
          userId: 'test-user-id',
          enabled: true,
        })
      )

      unmount()

      expect(mockCleanup).toHaveBeenCalled()
    })

    it('should resubscribe when userId changes', () => {
      const { rerender } = renderHook(
        ({ userId }) =>
          useRealtimeNotifications({
            userId,
            enabled: true,
          }),
        {
          initialProps: { userId: 'user-1' },
        }
      )

      expect(mockService.subscribeToNotifications).toHaveBeenCalledWith('user-1', expect.any(Object))

      rerender({ userId: 'user-2' })

      expect(mockService.subscribeToNotifications).toHaveBeenCalledWith('user-2', expect.any(Object))
    })
  })

  describe('event handlers', () => {
    it('should call onNewNotification when notification received', async () => {
      // Requirement 3.2: Receive notifications immediately
      const onNewNotification = vi.fn()
      let capturedHandlers: any

      vi.mocked(mockService.subscribeToNotifications).mockImplementation((userId, handlers) => {
        capturedHandlers = handlers
        return () => {}
      })

      renderHook(() =>
        useRealtimeNotifications({
          userId: 'test-user-id',
          enabled: true,
          onNewNotification,
        })
      )

      const notification: Notification = {
        id: 'notif-123',
        userId: 'test-user-id',
        type: 'project_created',
        title: 'Test Notification',
        body: 'Test body',
        data: {},
        read: false,
        sentViaEmail: false,
        legalHold: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      // Simulate receiving a notification
      capturedHandlers.onNewNotification({ notification })

      await waitFor(() => {
        expect(onNewNotification).toHaveBeenCalledWith(notification)
      })
    })

    it('should call onNotificationRead when notification read', async () => {
      const onNotificationRead = vi.fn()
      let capturedHandlers: any

      vi.mocked(mockService.subscribeToNotifications).mockImplementation((userId, handlers) => {
        capturedHandlers = handlers
        return () => {}
      })

      renderHook(() =>
        useRealtimeNotifications({
          userId: 'test-user-id',
          enabled: true,
          onNotificationRead,
        })
      )

      // Simulate notification read event
      capturedHandlers.onNotificationRead({
        notificationId: 'notif-123',
        userId: 'test-user-id',
        readAt: new Date().toISOString(),
      })

      await waitFor(() => {
        expect(onNotificationRead).toHaveBeenCalledWith('notif-123')
      })
    })

    it('should call onNotificationDeleted when notification deleted', async () => {
      const onNotificationDeleted = vi.fn()
      let capturedHandlers: any

      vi.mocked(mockService.subscribeToNotifications).mockImplementation((userId, handlers) => {
        capturedHandlers = handlers
        return () => {}
      })

      renderHook(() =>
        useRealtimeNotifications({
          userId: 'test-user-id',
          enabled: true,
          onNotificationDeleted,
        })
      )

      // Simulate notification deleted event
      capturedHandlers.onNotificationDeleted({
        notificationId: 'notif-123',
        userId: 'test-user-id',
      })

      await waitFor(() => {
        expect(onNotificationDeleted).toHaveBeenCalledWith('notif-123')
      })
    })
  })

  describe('connection status', () => {
    it('should track connection status changes', async () => {
      let capturedHandlers: any

      vi.mocked(mockService.subscribeToNotifications).mockImplementation((userId, handlers) => {
        capturedHandlers = handlers
        return () => {}
      })

      const { result } = renderHook(() =>
        useRealtimeNotifications({
          userId: 'test-user-id',
          enabled: true,
        })
      )

      // Initial status should be connecting
      expect(result.current.connectionStatus).toBe('connecting')

      // Simulate connection status change
      capturedHandlers.onConnectionStatusChange('connected')

      await waitFor(() => {
        expect(result.current.connectionStatus).toBe('connected')
      })
    })

    it('should sync missed notifications when reconnected', async () => {
      // Requirement 3.4: Sync missed notifications after reconnection
      const onNewNotification = vi.fn()
      let capturedHandlers: any

      const missedNotifications: Notification[] = [
        {
          id: 'notif-1',
          userId: 'test-user-id',
          type: 'project_created',
          title: 'Missed 1',
          body: 'Body 1',
          data: {},
          read: false,
          sentViaEmail: false,
          legalHold: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'notif-2',
          userId: 'test-user-id',
          type: 'proposal_submitted',
          title: 'Missed 2',
          body: 'Body 2',
          data: {},
          read: false,
          sentViaEmail: false,
          legalHold: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]

      vi.mocked(mockService.syncMissedNotifications).mockResolvedValue(missedNotifications)

      vi.mocked(mockService.subscribeToNotifications).mockImplementation((userId, handlers) => {
        capturedHandlers = handlers
        return () => {}
      })

      const { result } = renderHook(() =>
        useRealtimeNotifications({
          userId: 'test-user-id',
          enabled: true,
          onNewNotification,
        })
      )

      // Simulate reconnection
      capturedHandlers.onConnectionStatusChange('connected')

      await waitFor(() => {
        expect(mockService.syncMissedNotifications).toHaveBeenCalledWith('test-user-id')
        expect(result.current.missedNotifications).toHaveLength(2)
        expect(onNewNotification).toHaveBeenCalledTimes(2)
      })
    })
  })

  describe('reconnect', () => {
    it('should provide reconnect function', () => {
      const { result } = renderHook(() =>
        useRealtimeNotifications({
          userId: 'test-user-id',
          enabled: true,
        })
      )

      expect(typeof result.current.reconnect).toBe('function')
    })

    it('should call service reconnect when reconnect is called', () => {
      const { result } = renderHook(() =>
        useRealtimeNotifications({
          userId: 'test-user-id',
          enabled: true,
        })
      )

      result.current.reconnect()

      expect(mockService.reconnect).toHaveBeenCalledWith(
        'test-user-id',
        expect.any(Object)
      )
    })
  })

  describe('subscription status', () => {
    it('should return subscription status', () => {
      vi.mocked(mockService.isSubscribed).mockReturnValue(true)

      const { result } = renderHook(() =>
        useRealtimeNotifications({
          userId: 'test-user-id',
          enabled: true,
        })
      )

      expect(result.current.isSubscribed).toBe(true)
    })
  })
})
