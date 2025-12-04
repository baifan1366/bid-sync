/**
 * Tests for RealtimeNotificationService
 * 
 * Tests real-time notification subscription, connection management,
 * and missed notification syncing.
 * 
 * Requirements: 3.1, 3.2, 3.4, 3.5
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { RealtimeNotificationService } from '../realtime-notification-service'
import type { Notification } from '../notification-service'

// Mock Supabase client
const mockChannel = {
  on: vi.fn().mockReturnThis(),
  subscribe: vi.fn((callback) => {
    // Simulate successful subscription
    setTimeout(() => callback('SUBSCRIBED'), 0)
    return mockChannel
  }),
  unsubscribe: vi.fn(),
  send: vi.fn().mockResolvedValue({ status: 'ok' }),
  state: 'joined',
}

const mockSupabase = {
  channel: vi.fn(() => mockChannel),
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        gt: vi.fn(() => ({
          order: vi.fn(() => ({
            data: [],
            error: null,
          })),
        })),
      })),
    })),
  })),
}

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => mockSupabase,
}))

describe('RealtimeNotificationService', () => {
  let service: RealtimeNotificationService

  beforeEach(() => {
    service = new RealtimeNotificationService()
    vi.clearAllMocks()
  })

  afterEach(() => {
    // Clean up any subscriptions
    service.unsubscribe('test-user-id')
  })

  describe('subscribeToNotifications', () => {
    it('should create a notification channel for the user', () => {
      // Requirement 3.1: Establish Realtime subscription
      const handlers = {
        onNewNotification: vi.fn(),
      }

      service.subscribeToNotifications('test-user-id', handlers)

      expect(mockSupabase.channel).toHaveBeenCalledWith('notifications:test-user-id')
    })

    it('should set up event listeners for new notifications', () => {
      const handlers = {
        onNewNotification: vi.fn(),
      }

      service.subscribeToNotifications('test-user-id', handlers)

      expect(mockChannel.on).toHaveBeenCalledWith(
        'broadcast',
        { event: 'new_notification' },
        expect.any(Function)
      )
    })

    it('should set up event listeners for notification read events', () => {
      const handlers = {
        onNotificationRead: vi.fn(),
      }

      service.subscribeToNotifications('test-user-id', handlers)

      expect(mockChannel.on).toHaveBeenCalledWith(
        'broadcast',
        { event: 'notification_read' },
        expect.any(Function)
      )
    })

    it('should set up event listeners for notification deleted events', () => {
      const handlers = {
        onNotificationDeleted: vi.fn(),
      }

      service.subscribeToNotifications('test-user-id', handlers)

      expect(mockChannel.on).toHaveBeenCalledWith(
        'broadcast',
        { event: 'notification_deleted' },
        expect.any(Function)
      )
    })

    it('should subscribe to the channel', () => {
      const handlers = {
        onNewNotification: vi.fn(),
      }

      service.subscribeToNotifications('test-user-id', handlers)

      expect(mockChannel.subscribe).toHaveBeenCalled()
    })

    it('should return a cleanup function', () => {
      const handlers = {
        onNewNotification: vi.fn(),
      }

      const cleanup = service.subscribeToNotifications('test-user-id', handlers)

      expect(typeof cleanup).toBe('function')
    })

    it('should mark user as subscribed', () => {
      const handlers = {
        onNewNotification: vi.fn(),
      }

      service.subscribeToNotifications('test-user-id', handlers)

      expect(service.isSubscribed('test-user-id')).toBe(true)
    })
  })

  describe('unsubscribe', () => {
    it('should unsubscribe from the channel', () => {
      // Requirement 3.5: Unsubscribe on logout
      const handlers = {
        onNewNotification: vi.fn(),
      }

      service.subscribeToNotifications('test-user-id', handlers)
      service.unsubscribe('test-user-id')

      expect(mockChannel.unsubscribe).toHaveBeenCalled()
    })

    it('should mark user as not subscribed', () => {
      const handlers = {
        onNewNotification: vi.fn(),
      }

      service.subscribeToNotifications('test-user-id', handlers)
      service.unsubscribe('test-user-id')

      expect(service.isSubscribed('test-user-id')).toBe(false)
    })

    it('should handle unsubscribe when not subscribed', () => {
      expect(() => {
        service.unsubscribe('test-user-id')
      }).not.toThrow()
    })
  })

  describe('broadcastNewNotification', () => {
    it('should broadcast notification to user channel', async () => {
      // Requirement 3.2: Push notifications immediately
      const handlers = {
        onNewNotification: vi.fn(),
      }

      service.subscribeToNotifications('test-user-id', handlers)

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

      await service.broadcastNewNotification('test-user-id', notification)

      expect(mockChannel.send).toHaveBeenCalledWith({
        type: 'broadcast',
        event: 'new_notification',
        payload: {
          notification,
        },
      })
    })

    it('should throw error if user not subscribed', async () => {
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

      await expect(
        service.broadcastNewNotification('test-user-id', notification)
      ).rejects.toThrow('Notification channel not found')
    })
  })

  describe('broadcastNotificationRead', () => {
    it('should broadcast notification read event', async () => {
      const handlers = {
        onNotificationRead: vi.fn(),
      }

      service.subscribeToNotifications('test-user-id', handlers)

      await service.broadcastNotificationRead('test-user-id', 'notif-123')

      expect(mockChannel.send).toHaveBeenCalledWith({
        type: 'broadcast',
        event: 'notification_read',
        payload: expect.objectContaining({
          notificationId: 'notif-123',
          userId: 'test-user-id',
        }),
      })
    })
  })

  describe('broadcastNotificationDeleted', () => {
    it('should broadcast notification deleted event', async () => {
      const handlers = {
        onNotificationDeleted: vi.fn(),
      }

      service.subscribeToNotifications('test-user-id', handlers)

      await service.broadcastNotificationDeleted('test-user-id', 'notif-123')

      expect(mockChannel.send).toHaveBeenCalledWith({
        type: 'broadcast',
        event: 'notification_deleted',
        payload: {
          notificationId: 'notif-123',
          userId: 'test-user-id',
        },
      })
    })
  })

  describe('getConnectionStatus', () => {
    it('should return "connected" when channel is joined', () => {
      const handlers = {
        onNewNotification: vi.fn(),
      }

      service.subscribeToNotifications('test-user-id', handlers)

      expect(service.getConnectionStatus('test-user-id')).toBe('connected')
    })

    it('should return "disconnected" when not subscribed', () => {
      expect(service.getConnectionStatus('test-user-id')).toBe('disconnected')
    })

    it('should return "connecting" when channel is joining', () => {
      mockChannel.state = 'joining'

      const handlers = {
        onNewNotification: vi.fn(),
      }

      service.subscribeToNotifications('test-user-id', handlers)

      expect(service.getConnectionStatus('test-user-id')).toBe('connecting')

      // Reset state
      mockChannel.state = 'joined'
    })
  })

  describe('isSubscribed', () => {
    it('should return true when user is subscribed', () => {
      const handlers = {
        onNewNotification: vi.fn(),
      }

      service.subscribeToNotifications('test-user-id', handlers)

      expect(service.isSubscribed('test-user-id')).toBe(true)
    })

    it('should return false when user is not subscribed', () => {
      expect(service.isSubscribed('test-user-id')).toBe(false)
    })
  })

  describe('reconnect', () => {
    it('should unsubscribe and resubscribe', () => {
      const handlers = {
        onNewNotification: vi.fn(),
      }

      service.subscribeToNotifications('test-user-id', handlers)

      const unsubscribeSpy = vi.spyOn(service, 'unsubscribe')
      const subscribeSpy = vi.spyOn(service, 'subscribeToNotifications')

      service.reconnect('test-user-id', handlers)

      expect(unsubscribeSpy).toHaveBeenCalledWith('test-user-id')
      expect(subscribeSpy).toHaveBeenCalledWith('test-user-id', handlers)
    })
  })

  describe('syncMissedNotifications', () => {
    it('should return empty array when no last sync timestamp', async () => {
      // Requirement 3.4: Sync missed notifications
      const result = await service.syncMissedNotifications('test-user-id')

      expect(result).toEqual([])
    })

    it('should fetch notifications created since last sync', async () => {
      // Subscribe to set last sync timestamp
      const handlers = {
        onNewNotification: vi.fn(),
      }

      service.subscribeToNotifications('test-user-id', handlers)

      // Mock database response
      const mockNotifications = [
        {
          id: 'notif-1',
          user_id: 'test-user-id',
          type: 'project_created',
          title: 'Test 1',
          body: 'Body 1',
          data: {},
          read: false,
          sent_via_email: false,
          legal_hold: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ]

      mockSupabase.from = vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            gt: vi.fn(() => ({
              order: vi.fn(() => ({
                data: mockNotifications,
                error: null,
              })),
            })),
          })),
        })),
      }))

      const result = await service.syncMissedNotifications('test-user-id')

      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('notif-1')
    })
  })
})
