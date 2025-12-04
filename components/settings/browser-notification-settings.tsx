/**
 * Browser Notification Settings Component
 * 
 * Allows users to manage browser notification preferences.
 * Shows current permission status and allows requesting permission.
 * 
 * Requirements:
 * - 16.1: Request browser notification permission
 * - 16.5: Show support status and gracefully degrade
 */

'use client'

import { useState } from 'react'
import { Bell, BellOff, AlertCircle, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useBrowserNotifications } from '@/hooks/use-browser-notifications'
import { cn } from '@/lib/utils'

interface BrowserNotificationSettingsProps {
  className?: string
}

export function BrowserNotificationSettings({
  className,
}: BrowserNotificationSettingsProps) {
  const [isRequesting, setIsRequesting] = useState(false)

  const {
    isSupported,
    permission,
    requestPermission,
  } = useBrowserNotifications({
    autoRequestPermission: false,
  })

  const handleRequestPermission = async () => {
    setIsRequesting(true)
    try {
      await requestPermission()
    } finally {
      setIsRequesting(false)
    }
  }

  // Requirement 16.5: Show not supported message
  if (!isSupported) {
    return (
      <Card className={cn('border-yellow-400/20', className)}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BellOff className="h-5 w-5 text-muted-foreground" />
            Browser Notifications
          </CardTitle>
          <CardDescription>
            Desktop notifications for important updates
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Browser notifications are not supported in your current browser.
              Please use a modern browser like Chrome, Firefox, Safari, or Edge.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={cn('border-yellow-400/20', className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-yellow-400" />
          Browser Notifications
        </CardTitle>
        <CardDescription>
          Receive desktop notifications for important updates even when BidSync is not open
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Permission Status */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Permission Status</span>
            <div className="flex items-center gap-2">
              {permission === 'granted' && (
                <>
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span className="text-sm text-green-500">Enabled</span>
                </>
              )}
              {permission === 'denied' && (
                <>
                  <AlertCircle className="h-4 w-4 text-red-500" />
                  <span className="text-sm text-red-500">Blocked</span>
                </>
              )}
              {permission === 'default' && (
                <>
                  <AlertCircle className="h-4 w-4 text-yellow-400" />
                  <span className="text-sm text-yellow-400">Not Set</span>
                </>
              )}
            </div>
          </div>

          {/* Status-specific messages */}
          {permission === 'granted' && (
            <Alert className="bg-green-500/10 border-green-500/20">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <AlertDescription className="text-sm">
                You will receive browser notifications for high-priority updates like
                proposal acceptances, approaching deadlines, and account changes.
              </AlertDescription>
            </Alert>
          )}

          {permission === 'denied' && (
            <Alert className="bg-red-500/10 border-red-500/20">
              <AlertCircle className="h-4 w-4 text-red-500" />
              <AlertDescription className="text-sm">
                Browser notifications are blocked. To enable them, click the lock icon
                in your browser's address bar and allow notifications for this site.
              </AlertDescription>
            </Alert>
          )}

          {permission === 'default' && (
            <Alert className="bg-yellow-400/10 border-yellow-400/20">
              <AlertCircle className="h-4 w-4 text-yellow-400" />
              <AlertDescription className="text-sm">
                Enable browser notifications to receive important updates even when
                BidSync is not open.
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* Action Button */}
        {permission === 'default' && (
          <Button
            onClick={handleRequestPermission}
            disabled={isRequesting}
            className="w-full bg-yellow-400 hover:bg-yellow-500 text-black"
          >
            {isRequesting ? 'Requesting...' : 'Enable Browser Notifications'}
          </Button>
        )}

        {/* Information */}
        <div className="space-y-2 pt-2 border-t border-yellow-400/20">
          <p className="text-sm font-medium">What you'll be notified about:</p>
          <ul className="text-sm text-muted-foreground space-y-1 ml-4">
            <li className="list-disc">Proposal acceptances and rejections</li>
            <li className="list-disc">Approaching project deadlines</li>
            <li className="list-disc">Ready for delivery notifications</li>
            <li className="list-disc">Revision requests</li>
            <li className="list-disc">Account verification status changes</li>
            <li className="list-disc">Critical account updates</li>
          </ul>
          <p className="text-xs text-muted-foreground pt-2">
            Note: Only high-priority notifications will trigger browser notifications.
            You can still see all notifications in the notification center.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
