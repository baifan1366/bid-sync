/**
 * Browser Notification Example
 * 
 * Demonstrates how to use browser notifications in the BidSync platform.
 * Shows integration with the notification system and various use cases.
 * 
 * Requirements: 16.1, 16.2, 16.3, 16.4, 16.5
 */

'use client'

import { useState } from 'react'
import { Bell, CheckCircle2, AlertCircle, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useBrowserNotifications } from '@/hooks/use-browser-notifications'
import { NotificationPriority } from '@/lib/notification-service'

export function BrowserNotificationExample() {
  const [lastResult, setLastResult] = useState<string>('')

  const {
    isSupported,
    permission,
    hasRequestedPermission,
    requestPermission,
    showNotification,
    showNotificationForEvent,
  } = useBrowserNotifications({
    autoRequestPermission: false,
  })

  const handleRequestPermission = async () => {
    const result = await requestPermission()
    setLastResult(`Permission result: ${result}`)
  }

  const handleShowSimpleNotification = async () => {
    await showNotification({
      title: 'Simple Notification',
      body: 'This is a simple browser notification',
    })
    setLastResult('Simple notification shown')
  }

  const handleShowHighPriorityNotification = async () => {
    await showNotification({
      title: 'High Priority Alert',
      body: 'This is a high-priority notification that requires attention',
      requireInteraction: false,
      tag: 'high-priority-demo',
    })
    setLastResult('High-priority notification shown')
  }

  const handleShowCriticalNotification = async () => {
    await showNotification({
      title: '🚨 Critical Alert',
      body: 'This is a critical notification that requires immediate attention',
      requireInteraction: true,
      tag: 'critical-demo',
    })
    setLastResult('Critical notification shown (requires interaction)')
  }

  const handleShowProposalAccepted = async () => {
    // Simulate a proposal accepted notification
    const mockNotification = {
      id: 'demo-1',
      userId: 'demo-user',
      type: 'proposal_accepted' as const,
      title: 'Proposal Accepted! 🎉',
      body: 'Your proposal for "Website Redesign Project" has been accepted',
      data: {
        proposalId: 'demo-proposal-1',
        projectId: 'demo-project-1',
      },
      read: false,
      sentViaEmail: false,
      legalHold: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    await showNotificationForEvent(mockNotification, NotificationPriority.HIGH)
    setLastResult('Proposal accepted notification shown')
  }

  const handleShowDeadlineReminder = async () => {
    // Simulate a deadline reminder notification
    const mockNotification = {
      id: 'demo-2',
      userId: 'demo-user',
      type: 'project_deadline_approaching' as const,
      title: 'Deadline Approaching ⏰',
      body: 'Project "Mobile App Development" is due in 2 days',
      data: {
        projectId: 'demo-project-2',
        daysRemaining: 2,
      },
      read: false,
      sentViaEmail: false,
      legalHold: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    await showNotificationForEvent(mockNotification, NotificationPriority.HIGH)
    setLastResult('Deadline reminder notification shown')
  }

  return (
    <div className="space-y-6 p-6">
      <Card className="border-yellow-400/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-yellow-400" />
            Browser Notification Demo
          </CardTitle>
          <CardDescription>
            Test browser notification functionality and see how it works
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Support Status */}
          <Alert className={isSupported ? 'bg-green-500/10 border-green-500/20' : 'bg-red-500/10 border-red-500/20'}>
            {isSupported ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <AlertDescription>
                  Browser notifications are supported in your browser
                </AlertDescription>
              </>
            ) : (
              <>
                <AlertCircle className="h-4 w-4 text-red-500" />
                <AlertDescription>
                  Browser notifications are not supported in your browser
                </AlertDescription>
              </>
            )}
          </Alert>

          {/* Permission Status */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Permission Status</h3>
            <div className="flex items-center gap-2">
              <span className="text-sm">Current permission:</span>
              <span className={`text-sm font-medium ${
                permission === 'granted' ? 'text-green-500' :
                permission === 'denied' ? 'text-red-500' :
                'text-yellow-400'
              }`}>
                {permission}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm">Has requested:</span>
              <span className="text-sm font-medium">
                {hasRequestedPermission ? 'Yes' : 'No'}
              </span>
            </div>
          </div>

          {/* Request Permission */}
          {permission === 'default' && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Step 1: Request Permission</h3>
              <Button
                onClick={handleRequestPermission}
                className="bg-yellow-400 hover:bg-yellow-500 text-black"
              >
                Request Browser Notification Permission
              </Button>
            </div>
          )}

          {/* Test Notifications */}
          {permission === 'granted' && (
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Step 2: Test Notifications</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Button
                  onClick={handleShowSimpleNotification}
                  variant="outline"
                  className="border-yellow-400/20 hover:bg-yellow-400/10"
                >
                  Show Simple Notification
                </Button>

                <Button
                  onClick={handleShowHighPriorityNotification}
                  variant="outline"
                  className="border-yellow-400/20 hover:bg-yellow-400/10"
                >
                  Show High Priority
                </Button>

                <Button
                  onClick={handleShowCriticalNotification}
                  variant="outline"
                  className="border-yellow-400/20 hover:bg-yellow-400/10"
                >
                  Show Critical Alert
                </Button>

                <Button
                  onClick={handleShowProposalAccepted}
                  variant="outline"
                  className="border-yellow-400/20 hover:bg-yellow-400/10"
                >
                  Proposal Accepted
                </Button>

                <Button
                  onClick={handleShowDeadlineReminder}
                  variant="outline"
                  className="border-yellow-400/20 hover:bg-yellow-400/10"
                >
                  Deadline Reminder
                </Button>
              </div>
            </div>
          )}

          {/* Permission Denied */}
          {permission === 'denied' && (
            <Alert className="bg-red-500/10 border-red-500/20">
              <AlertCircle className="h-4 w-4 text-red-500" />
              <AlertDescription>
                Browser notifications are blocked. To enable them, click the lock icon
                in your browser's address bar and allow notifications for this site.
              </AlertDescription>
            </Alert>
          )}

          {/* Last Result */}
          {lastResult && (
            <Alert className="bg-blue-500/10 border-blue-500/20">
              <Info className="h-4 w-4 text-blue-500" />
              <AlertDescription>
                {lastResult}
              </AlertDescription>
            </Alert>
          )}

          {/* Information */}
          <div className="space-y-2 pt-4 border-t border-yellow-400/20">
            <h3 className="text-sm font-medium">How it works:</h3>
            <ul className="text-sm text-muted-foreground space-y-1 ml-4">
              <li className="list-disc">
                <strong>Requirement 16.1:</strong> Permission is requested on first login
              </li>
              <li className="list-disc">
                <strong>Requirement 16.2:</strong> Only high-priority notifications trigger browser notifications
              </li>
              <li className="list-disc">
                <strong>Requirement 16.3:</strong> Notifications include title and body text
              </li>
              <li className="list-disc">
                <strong>Requirement 16.4:</strong> Clicking a notification focuses the app and navigates to the relevant page
              </li>
              <li className="list-disc">
                <strong>Requirement 16.5:</strong> Gracefully degrades for unsupported browsers
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
