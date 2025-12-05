/**
 * Example component demonstrating real-time notification usage
 * 
 * This component shows how to:
 * - Subscribe to real-time notifications
 * - Display connection status
 * - Handle new notifications
 * - Show missed notifications after reconnection
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
 */

'use client'

import { useEffect, useState } from 'react'
import { useRealtimeNotifications } from '@/hooks/use-realtime-notifications'
import { Notification } from '@/lib/notification-types'
import { Bell, Wifi, WifiOff, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/use-toast'

interface RealtimeNotificationExampleProps {
  userId: string
  userName: string
}

export function RealtimeNotificationExample({
  userId,
  userName,
}: RealtimeNotificationExampleProps) {
  const { toast } = useToast()
  const [notifications, setNotifications] = useState<Notification[]>([])

  // Requirement 3.1, 3.2, 3.4, 3.5: Subscribe to real-time notifications
  const {
    connectionStatus,
    isSubscribed,
    missedNotifications,
    reconnect,
  } = useRealtimeNotifications({
    userId,
    enabled: true,
    onNewNotification: (notification) => {
      // Requirement 3.3: Display toast notification
      toast({
        title: notification.title,
        description: notification.body,
        duration: 5000,
      })

      // Add to local state
      setNotifications((prev) => [notification, ...prev])
    },
    onNotificationRead: (notificationId) => {
      // Update local state
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notificationId ? { ...n, read: true } : n
        )
      )
    },
    onNotificationDeleted: (notificationId) => {
      // Remove from local state
      setNotifications((prev) =>
        prev.filter((n) => n.id !== notificationId)
      )
    },
  })

  // Display missed notifications
  useEffect(() => {
    if (missedNotifications.length > 0) {
      toast({
        title: 'Synced Notifications',
        description: `You have ${missedNotifications.length} new notification(s)`,
        duration: 5000,
      })

      // Add missed notifications to local state
      setNotifications((prev) => [...missedNotifications, ...prev])
    }
  }, [missedNotifications, toast])

  const getConnectionStatusColor = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'bg-green-500'
      case 'connecting':
        return 'bg-yellow-400'
      case 'disconnected':
        return 'bg-red-500'
    }
  }

  const getConnectionStatusIcon = () => {
    switch (connectionStatus) {
      case 'connected':
        return <Wifi className="h-4 w-4" />
      case 'connecting':
        return <RefreshCw className="h-4 w-4 animate-spin" />
      case 'disconnected':
        return <WifiOff className="h-4 w-4" />
    }
  }

  const unreadCount = notifications.filter((n) => !n.read).length

  return (
    <Card className="border-yellow-400/20">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-yellow-400" />
            <CardTitle>Real-Time Notifications</CardTitle>
            {unreadCount > 0 && (
              <Badge className="bg-yellow-400 text-black hover:bg-yellow-500">
                {unreadCount}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full ${getConnectionStatusColor()}`} />
              <span className="text-sm text-muted-foreground capitalize">
                {connectionStatus}
              </span>
              {getConnectionStatusIcon()}
            </div>
            {connectionStatus === 'disconnected' && (
              <Button
                size="sm"
                variant="outline"
                onClick={reconnect}
                className="border-yellow-400 text-yellow-400 hover:bg-yellow-400/10"
              >
                Reconnect
              </Button>
            )}
          </div>
        </div>
        <CardDescription>
          {isSubscribed
            ? `Subscribed to notifications for ${userName}`
            : 'Not subscribed to notifications'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {notifications.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No notifications yet
            </p>
          ) : (
            notifications.slice(0, 5).map((notification) => (
              <div
                key={notification.id}
                className={`p-3 rounded-lg border ${
                  notification.read
                    ? 'border-gray-200 dark:border-gray-800'
                    : 'border-yellow-400/40 bg-yellow-400/5'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <p className="font-medium text-sm">{notification.title}</p>
                    {notification.body && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {notification.body}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(notification.createdAt).toLocaleString()}
                    </p>
                  </div>
                  {!notification.read && (
                    <div className="h-2 w-2 rounded-full bg-yellow-400" />
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}
