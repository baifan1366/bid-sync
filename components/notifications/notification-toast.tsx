/**
 * NotificationToast Component
 * 
 * Displays toast/banner notifications for real-time updates.
 * 
 * Requirements:
 * - 3.3: Display toast/banner notification when real-time notification is received
 */

'use client'

import { useEffect } from 'react'
import { Notification } from '@/lib/notification-types'
import { useToast } from '@/components/ui/use-toast'

interface NotificationToastProps {
  notification: Notification | null
  onDismiss?: () => void
}

export function NotificationToast({
  notification,
  onDismiss,
}: NotificationToastProps) {
  const { toast } = useToast()

  useEffect(() => {
    if (!notification) return

    // Requirement 3.3: Display toast notification
    toast({
      title: notification.title,
      description: notification.body,
      duration: 5000,
    })

    // Call onDismiss after showing toast
    if (onDismiss) {
      onDismiss()
    }
  }, [notification, toast, onDismiss])

  return null // This component doesn't render anything directly
}
