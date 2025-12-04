/**
 * NotificationCenter Demo Component
 * 
 * Demonstrates all notification features:
 * - NotificationBell with unread badge
 * - NotificationDropdown with filtering
 * - Real-time notification updates
 * - Toast notifications
 * - Mark as read/delete functionality
 * 
 * This is a demo component for testing and documentation purposes.
 */

'use client'

import { useState } from 'react'
import { NotificationCenter } from './notification-center'
import { NotificationService, NotificationType } from '@/lib/notification-service'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/use-toast'

interface NotificationCenterDemoProps {
  userId: string
}

export function NotificationCenterDemo({ userId }: NotificationCenterDemoProps) {
  const { toast } = useToast()
  const [notificationType, setNotificationType] = useState<NotificationType>('project_created')
  const [title, setTitle] = useState('New Project Created')
  const [body, setBody] = useState('A new project has been created and is awaiting your review.')
  const [isCreating, setIsCreating] = useState(false)

  const handleCreateNotification = async () => {
    setIsCreating(true)
    try {
      const result = await NotificationService.createNotification({
        userId,
        type: notificationType,
        title,
        body,
        data: {
          projectId: 'demo-project-123',
          timestamp: new Date().toISOString(),
        },
        sendEmail: false, // Don't send email in demo
      })

      if (result.success) {
        toast({
          title: 'Notification Created',
          description: 'A new notification has been created successfully.',
        })
        
        // Reset form
        setTitle('New Project Created')
        setBody('A new project has been created and is awaiting your review.')
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to create notification',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('Error creating notification:', error)
      toast({
        title: 'Error',
        description: 'An unexpected error occurred',
        variant: 'destructive',
      })
    } finally {
      setIsCreating(false)
    }
  }

  const notificationTypes: NotificationType[] = [
    'project_created',
    'project_approved',
    'proposal_submitted',
    'proposal_scored',
    'proposal_accepted',
    'team_member_joined',
    'ready_for_delivery',
    'section_assigned',
    'project_deadline_approaching',
  ]

  return (
    <div className="space-y-6">
      <Card className="border-yellow-400/20">
        <CardHeader>
          <CardTitle>Notification Center Demo</CardTitle>
          <CardDescription>
            Test the notification system by creating notifications and seeing them appear in real-time.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Notification Center Display */}
          <div className="flex items-center justify-between p-4 border border-yellow-400/20 rounded-lg bg-yellow-400/5">
            <div>
              <p className="font-medium">Notification Center</p>
              <p className="text-sm text-muted-foreground">
                Click the bell icon to view notifications
              </p>
            </div>
            <NotificationCenter userId={userId} />
          </div>

          {/* Create Notification Form */}
          <div className="space-y-4 p-4 border border-yellow-400/20 rounded-lg">
            <h3 className="font-semibold">Create Test Notification</h3>
            
            <div className="space-y-2">
              <Label htmlFor="notification-type">Notification Type</Label>
              <Select
                value={notificationType}
                onValueChange={(value) => setNotificationType(value as NotificationType)}
              >
                <SelectTrigger id="notification-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {notificationTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notification-title">Title</Label>
              <Input
                id="notification-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Notification title"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notification-body">Body</Label>
              <Textarea
                id="notification-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Notification body"
                rows={3}
              />
            </div>

            <Button
              onClick={handleCreateNotification}
              disabled={isCreating || !title}
              className="w-full bg-yellow-400 text-black hover:bg-yellow-500"
            >
              {isCreating ? 'Creating...' : 'Create Notification'}
            </Button>
          </div>

          {/* Features List */}
          <div className="space-y-2 p-4 border border-yellow-400/20 rounded-lg bg-background">
            <h3 className="font-semibold mb-3">Features Demonstrated</h3>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <span className="text-yellow-400">✓</span>
                <span>Real-time notification updates via Supabase Realtime</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-yellow-400">✓</span>
                <span>Unread badge on notification bell</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-yellow-400">✓</span>
                <span>Dropdown list with filtering (All/Unread)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-yellow-400">✓</span>
                <span>Toast notifications for new notifications</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-yellow-400">✓</span>
                <span>Mark as read functionality</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-yellow-400">✓</span>
                <span>Mark all as read functionality</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-yellow-400">✓</span>
                <span>Delete individual notifications</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-yellow-400">✓</span>
                <span>Visual distinction between read/unread</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-yellow-400">✓</span>
                <span>Navigation to relevant pages on click</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-yellow-400">✓</span>
                <span>Connection status indicator (dev mode)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-yellow-400">✓</span>
                <span>Automatic reconnection with missed notification sync</span>
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
