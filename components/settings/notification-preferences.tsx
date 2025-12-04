'use client'

/**
 * Notification Preferences Component
 * 
 * Provides UI for managing user notification preferences.
 * Implements requirements from notification-system spec:
 * - 4.1: Display all available notification categories
 * - 4.2: Save preference toggles to database
 * 
 * Features:
 * - Toggle switches for each notification category
 * - Global email notification toggle
 * - Reset to defaults functionality
 * - Real-time preference updates
 * - Loading and error states
 */

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { useToast } from '@/components/ui/use-toast'
import { Bell, Loader2, RotateCcw, Mail, FolderOpen, MessageSquare, FileText, HelpCircle, Clock, Users, CheckCircle, Award } from 'lucide-react'
import { 
  UserNotificationPreferences, 
  UpdatePreferencesInput 
} from '@/lib/notification-preferences-service'
import { BrowserNotificationSettings } from './browser-notification-settings'

interface NotificationPreferencesProps {
  userId: string
}

/**
 * Notification category configuration
 * Maps preference keys to display information
 */
const NOTIFICATION_CATEGORIES = [
  {
    key: 'emailNotifications' as const,
    label: 'Email Notifications',
    description: 'Receive notifications via email (master toggle)',
    icon: Mail,
    isGlobal: true,
  },
  {
    key: 'projectUpdates' as const,
    label: 'Project Updates',
    description: 'Get notified when there are updates to your projects',
    icon: FolderOpen,
  },
  {
    key: 'newMessages' as const,
    label: 'New Messages',
    description: 'Receive notifications for new messages and Q&A',
    icon: MessageSquare,
  },
  {
    key: 'proposalUpdates' as const,
    label: 'Proposal Updates',
    description: 'Get notified about proposal status changes and submissions',
    icon: FileText,
  },
  {
    key: 'qaNotifications' as const,
    label: 'Q&A Notifications',
    description: 'Receive notifications for questions and answers',
    icon: HelpCircle,
  },
  {
    key: 'deadlineReminders' as const,
    label: 'Deadline Reminders',
    description: 'Get reminders about approaching project and section deadlines',
    icon: Clock,
  },
  {
    key: 'teamNotifications' as const,
    label: 'Team Notifications',
    description: 'Receive notifications about team member changes and invitations',
    icon: Users,
  },
  {
    key: 'completionNotifications' as const,
    label: 'Completion Notifications',
    description: 'Get notified about project deliveries and completion status',
    icon: CheckCircle,
  },
  {
    key: 'scoringNotifications' as const,
    label: 'Scoring Notifications',
    description: 'Receive notifications about proposal scoring and rankings',
    icon: Award,
  },
]

export function NotificationPreferences({ userId }: NotificationPreferencesProps) {
  const { toast } = useToast()
  const [preferences, setPreferences] = useState<UserNotificationPreferences | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isResetting, setIsResetting] = useState(false)

  /**
   * Requirement 4.1: Display all available notification categories
   * Fetches user preferences on component mount
   */
  useEffect(() => {
    fetchPreferences()
  }, [userId])

  /**
   * Fetches user notification preferences from the API
   */
  const fetchPreferences = async () => {
    try {
      setIsLoading(true)
      const response = await fetch('/api/notifications/preferences')
      
      if (!response.ok) {
        throw new Error('Failed to fetch preferences')
      }

      const data = await response.json()
      setPreferences(data.preferences)
    } catch (error) {
      console.error('Error fetching preferences:', error)
      toast({
        title: 'Error',
        description: 'Failed to load notification preferences',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  /**
   * Requirement 4.2: Save preference toggles to database
   * Updates a single preference setting
   */
  const updatePreference = async (key: keyof UpdatePreferencesInput, value: boolean) => {
    if (!preferences) return

    // Optimistic update
    const previousPreferences = preferences
    setPreferences({
      ...preferences,
      [key]: value,
    })

    try {
      setIsSaving(true)
      const response = await fetch('/api/notifications/preferences', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          [key]: value,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to update preference')
      }

      const data = await response.json()
      setPreferences(data.preferences)

      toast({
        title: 'Preference updated',
        description: 'Your notification preference has been saved',
      })
    } catch (error) {
      console.error('Error updating preference:', error)
      
      // Revert optimistic update
      setPreferences(previousPreferences)
      
      toast({
        title: 'Update failed',
        description: 'Failed to save notification preference',
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }

  /**
   * Requirement 4.2: Reset preferences to defaults
   * Resets all preferences to their default values
   */
  const resetToDefaults = async () => {
    try {
      setIsResetting(true)
      const response = await fetch('/api/notifications/preferences/reset', {
        method: 'POST',
      })

      if (!response.ok) {
        throw new Error('Failed to reset preferences')
      }

      const data = await response.json()
      setPreferences(data.preferences)

      toast({
        title: 'Preferences reset',
        description: 'All notification preferences have been reset to defaults',
      })
    } catch (error) {
      console.error('Error resetting preferences:', error)
      toast({
        title: 'Reset failed',
        description: 'Failed to reset notification preferences',
        variant: 'destructive',
      })
    } finally {
      setIsResetting(false)
    }
  }

  if (isLoading) {
    return (
      <Card className="border-yellow-400/20">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-yellow-400" />
            <CardTitle>Notification Preferences</CardTitle>
          </div>
          <CardDescription>
            Manage how you receive notifications
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-yellow-400" />
            <p className="text-muted-foreground">Loading preferences...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!preferences) {
    return (
      <Card className="border-yellow-400/20">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-yellow-400" />
            <CardTitle>Notification Preferences</CardTitle>
          </div>
          <CardDescription>
            Manage how you receive notifications
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Failed to load preferences</p>
          <Button
            onClick={fetchPreferences}
            variant="outline"
            className="mt-4 border-yellow-400/20 hover:bg-yellow-400/10"
          >
            Try Again
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Browser Notification Settings */}
      <BrowserNotificationSettings />

      <Card className="border-yellow-400/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-yellow-400" />
                <CardTitle>Notification Preferences</CardTitle>
              </div>
              <CardDescription className="mt-2">
                Manage how you receive notifications across the platform
              </CardDescription>
            </div>
            <Button
              onClick={resetToDefaults}
              disabled={isResetting || isSaving}
              variant="outline"
              size="sm"
              className="border-yellow-400/20 hover:bg-yellow-400/10"
            >
              {isResetting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reset to Defaults
                </>
              )}
            </Button>
          </div>
        </CardHeader>
      <CardContent className="space-y-4">
        {NOTIFICATION_CATEGORIES.map((category, index) => {
          const Icon = category.icon
          const isEnabled = preferences[category.key]
          const isGlobalEmail = category.key === 'emailNotifications'
          const isDisabledByGlobal = !preferences.emailNotifications && !isGlobalEmail

          return (
            <div key={category.key}>
              {index > 0 && <Separator className="bg-yellow-400/10 mb-4" />}
              
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1">
                  <Icon className={`h-5 w-5 mt-0.5 ${
                    isGlobalEmail 
                      ? 'text-yellow-400' 
                      : isDisabledByGlobal 
                        ? 'text-muted-foreground/50' 
                        : 'text-yellow-400/70'
                  }`} />
                  <div className="space-y-1 flex-1">
                    <Label 
                      htmlFor={category.key}
                      className={`text-base ${
                        isDisabledByGlobal ? 'text-muted-foreground' : ''
                      }`}
                    >
                      {category.label}
                      {isGlobalEmail && (
                        <span className="ml-2 text-xs font-normal text-yellow-400">
                          (Master Toggle)
                        </span>
                      )}
                    </Label>
                    <p className={`text-sm ${
                      isDisabledByGlobal 
                        ? 'text-muted-foreground/70' 
                        : 'text-muted-foreground'
                    }`}>
                      {category.description}
                    </p>
                    {isDisabledByGlobal && (
                      <p className="text-xs text-yellow-400/70">
                        Email notifications are disabled globally
                      </p>
                    )}
                  </div>
                </div>
                <Switch
                  id={category.key}
                  checked={isEnabled}
                  onCheckedChange={(checked) => updatePreference(category.key, checked)}
                  disabled={isSaving || isResetting || isDisabledByGlobal}
                  className="data-[state=checked]:bg-yellow-400"
                />
              </div>
            </div>
          )
        })}

        <Separator className="bg-yellow-400/10 my-6" />

        <div className="bg-yellow-400/5 border border-yellow-400/20 rounded-lg p-4">
          <p className="text-sm text-muted-foreground">
            <strong className="text-foreground">Note:</strong> Critical notifications 
            (account security, verification status) will always be sent regardless of 
            your preferences to ensure you stay informed about important account changes.
          </p>
        </div>
      </CardContent>
      </Card>
    </div>
  )
}
