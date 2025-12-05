/**
 * NotificationDropdown Component
 * 
 * Displays a dropdown list of recent notifications with filtering and actions.
 * 
 * Requirements:
 * - 1.3: Display dropdown list of recent notifications
 * - 13.2: Mark all notifications as read
 */

'use client'

import { useState, useEffect } from 'react'
import { Notification } from '@/lib/notification-types'
import { NotificationItem } from './notification-item'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CheckCheck, Inbox } from 'lucide-react'
import { cn } from '@/lib/utils'

interface NotificationDropdownProps {
  userId: string
  notifications: Notification[]
  onNotificationsChange: () => void
  className?: string
}

export function NotificationDropdown({
  userId,
  notifications,
  onNotificationsChange,
  className,
}: NotificationDropdownProps) {
  const [activeTab, setActiveTab] = useState<'all' | 'unread'>('all')
  const [isMarkingAllRead, setIsMarkingAllRead] = useState(false)

  const unreadNotifications = notifications.filter((n) => !n.read)
  const displayNotifications = activeTab === 'unread' ? unreadNotifications : notifications

  // Requirement 13.2: Mark all notifications as read
  const handleMarkAllAsRead = async () => {
    if (unreadNotifications.length === 0) return

    setIsMarkingAllRead(true)
    try {
      const response = await fetch('/api/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `mutation { markAllNotificationsAsRead }`,
        }),
      })
      if (response.ok) {
        onNotificationsChange()
      }
    } catch (error) {
      console.error('Error marking all as read:', error)
    } finally {
      setIsMarkingAllRead(false)
    }
  }

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await fetch('/api/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `mutation MarkAsRead($id: ID!) { markNotificationAsRead(notificationId: $id) }`,
          variables: { id: notificationId },
        }),
      })
      onNotificationsChange()
    } catch (error) {
      console.error('Error marking notification as read:', error)
    }
  }

  const handleDelete = async (notificationId: string) => {
    try {
      await fetch('/api/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `mutation DeleteNotification($id: ID!) { deleteNotification(notificationId: $id) }`,
          variables: { id: notificationId },
        }),
      })
      onNotificationsChange()
    } catch (error) {
      console.error('Error deleting notification:', error)
    }
  }

  return (
    <div
      className={cn(
        'w-[400px] bg-background border border-yellow-400/20 rounded-lg shadow-lg',
        className
      )}
    >
      <div className="p-4 border-b border-yellow-400/20">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-lg">Notifications</h3>
          
          {unreadNotifications.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMarkAllAsRead}
              disabled={isMarkingAllRead}
              className="text-xs hover:bg-yellow-400/10 hover:text-yellow-400"
            >
              <CheckCheck className="h-3.5 w-3.5 mr-1" />
              Mark all read
            </Button>
          )}
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'all' | 'unread')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="all" className="text-xs">
              All ({notifications.length})
            </TabsTrigger>
            <TabsTrigger value="unread" className="text-xs">
              Unread ({unreadNotifications.length})
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <ScrollArea className="h-[400px]">
        <div className="p-2">
          {displayNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Inbox className="h-12 w-12 text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground">
                {activeTab === 'unread'
                  ? 'No unread notifications'
                  : 'No notifications yet'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {displayNotifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onMarkAsRead={handleMarkAsRead}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
