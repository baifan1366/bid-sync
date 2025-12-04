/**
 * Browser Notification Permission Prompt
 * 
 * Displays a prompt to request browser notification permission.
 * Shows only when:
 * - Browser notifications are supported
 * - Permission has not been requested yet
 * - User has not dismissed the prompt
 * 
 * Requirements:
 * - 16.1: Request browser notification permission on first login
 * - 16.5: Gracefully degrade for unsupported browsers
 */

'use client'

import { useState, useEffect } from 'react'
import { Bell, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useBrowserNotifications } from '@/hooks/use-browser-notifications'
import { cn } from '@/lib/utils'

interface BrowserNotificationPromptProps {
  /**
   * Whether to show the prompt automatically
   */
  autoShow?: boolean

  /**
   * Callback when permission is granted
   */
  onPermissionGranted?: () => void

  /**
   * Callback when permission is denied
   */
  onPermissionDenied?: () => void

  /**
   * Callback when prompt is dismissed
   */
  onDismiss?: () => void

  /**
   * Custom className
   */
  className?: string
}

export function BrowserNotificationPrompt({
  autoShow = true,
  onPermissionGranted,
  onPermissionDenied,
  onDismiss,
  className,
}: BrowserNotificationPromptProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [isDismissed, setIsDismissed] = useState(false)

  const {
    isSupported,
    permission,
    hasRequestedPermission,
    requestPermission,
  } = useBrowserNotifications({
    autoRequestPermission: false,
  })

  // Check if we should show the prompt
  useEffect(() => {
    // Requirement 16.5: Don't show if not supported
    if (!isSupported) {
      return
    }

    // Don't show if already requested or dismissed
    if (hasRequestedPermission || isDismissed) {
      return
    }

    // Don't show if permission is already granted or denied
    if (permission !== 'default') {
      return
    }

    // Check if user has dismissed this before (localStorage)
    const dismissed = localStorage.getItem('browser-notification-prompt-dismissed')
    if (dismissed === 'true') {
      setIsDismissed(true)
      return
    }

    // Show the prompt
    if (autoShow) {
      // Delay showing the prompt slightly to avoid overwhelming the user
      const timer = setTimeout(() => {
        setIsVisible(true)
      }, 2000)

      return () => clearTimeout(timer)
    }
  }, [isSupported, hasRequestedPermission, permission, isDismissed, autoShow])

  const handleEnable = async () => {
    const result = await requestPermission()

    if (result === 'granted') {
      setIsVisible(false)
      onPermissionGranted?.()
    } else if (result === 'denied') {
      setIsVisible(false)
      onPermissionDenied?.()
    }
  }

  const handleDismiss = () => {
    setIsVisible(false)
    setIsDismissed(true)
    localStorage.setItem('browser-notification-prompt-dismissed', 'true')
    onDismiss?.()
  }

  // Don't render if not visible or not supported
  if (!isVisible || !isSupported) {
    return null
  }

  return (
    <Card
      className={cn(
        'fixed bottom-4 right-4 z-50 w-[380px] shadow-lg border-yellow-400/20',
        'animate-in slide-in-from-bottom-5 duration-300',
        className
      )}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-yellow-400/10 rounded-lg">
              <Bell className="h-5 w-5 text-yellow-400" />
            </div>
            <CardTitle className="text-base">Enable Notifications</CardTitle>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 -mt-1 -mr-2"
            onClick={handleDismiss}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <CardDescription className="text-sm">
          Stay updated with important notifications even when BidSync is not open.
          Get instant alerts for:
        </CardDescription>
        <ul className="text-sm text-muted-foreground space-y-1 ml-4">
          <li className="list-disc">Proposal acceptances and rejections</li>
          <li className="list-disc">Approaching deadlines</li>
          <li className="list-disc">Project updates</li>
          <li className="list-disc">Account status changes</li>
        </ul>
        <div className="flex gap-2">
          <Button
            onClick={handleEnable}
            className="flex-1 bg-yellow-400 hover:bg-yellow-500 text-black"
          >
            Enable Notifications
          </Button>
          <Button
            onClick={handleDismiss}
            variant="outline"
            className="flex-1 border-yellow-400/20 hover:bg-yellow-400/10"
          >
            Not Now
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
