"use client"

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Settings, Mail, Bell, Shield } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'

interface SystemSettings {
  email: {
    smtp_host: string
    smtp_port: number
    smtp_user: string
    from_email: string
  }
  notifications: {
    enable_email_notifications: boolean
    enable_proposal_notifications: boolean
    enable_project_notifications: boolean
    enable_admin_notifications: boolean
  }
  security: {
    require_email_verification: boolean
    require_client_verification: boolean
    session_timeout_minutes: number
    max_login_attempts: number
  }
}

async function fetchSettings(): Promise<SystemSettings> {
  const response = await fetch('/api/admin/settings')
  if (!response.ok) throw new Error('Failed to fetch settings')
  return response.json()
}

export function SystemSettings() {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const { data: settings, isLoading } = useQuery({
    queryKey: ['system-settings'],
    queryFn: fetchSettings,
  })

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<SystemSettings>) => {
      const response = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!response.ok) throw new Error('Failed to update settings')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-settings'] })
      toast({ title: 'Settings updated successfully' })
    },
    onError: () => {
      toast({ title: 'Failed to update settings', variant: 'destructive' })
    },
  })

  const [emailSettings, setEmailSettings] = useState(settings?.email)
  const [notificationSettings, setNotificationSettings] = useState(settings?.notifications)
  const [securitySettings, setSecuritySettings] = useState(settings?.security)

  if (isLoading || !settings) {
    return <div>Loading settings...</div>
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="email" className="space-y-6">
        <TabsList className="bg-white dark:bg-black border border-yellow-400/20">
          <TabsTrigger
            value="email"
            className="data-[state=active]:bg-yellow-400 data-[state=active]:text-black"
          >
            <Mail className="h-4 w-4 mr-2" />
            Email
          </TabsTrigger>
          <TabsTrigger
            value="notifications"
            className="data-[state=active]:bg-yellow-400 data-[state=active]:text-black"
          >
            <Bell className="h-4 w-4 mr-2" />
            Notifications
          </TabsTrigger>
          <TabsTrigger
            value="security"
            className="data-[state=active]:bg-yellow-400 data-[state=active]:text-black"
          >
            <Shield className="h-4 w-4 mr-2" />
            Security
          </TabsTrigger>
        </TabsList>

        <TabsContent value="email">
          <Card className="border-yellow-400/20">
            <CardHeader>
              <CardTitle>Email Configuration</CardTitle>
              <CardDescription>Configure SMTP settings for outgoing emails</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="smtp_host">SMTP Host</Label>
                <Input
                  id="smtp_host"
                  defaultValue={settings.email.smtp_host}
                  placeholder="smtp.example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="smtp_port">SMTP Port</Label>
                <Input
                  id="smtp_port"
                  type="number"
                  defaultValue={settings.email.smtp_port}
                  placeholder="587"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="smtp_user">SMTP Username</Label>
                <Input
                  id="smtp_user"
                  defaultValue={settings.email.smtp_user}
                  placeholder="user@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="from_email">From Email</Label>
                <Input
                  id="from_email"
                  defaultValue={settings.email.from_email}
                  placeholder="noreply@bidsync.com"
                />
              </div>
              <Button
                onClick={() => updateMutation.mutate({ email: emailSettings })}
                className="bg-yellow-400 hover:bg-yellow-500 text-black"
              >
                Save Email Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card className="border-yellow-400/20">
            <CardHeader>
              <CardTitle>Notification Settings</CardTitle>
              <CardDescription>Control system-wide notification preferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Email Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Enable all email notifications
                  </p>
                </div>
                <Switch
                  checked={settings.notifications.enable_email_notifications}
                  onCheckedChange={(checked: boolean) =>
                    setNotificationSettings({ ...notificationSettings!, enable_email_notifications: checked })
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Proposal Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Notify when proposals are submitted
                  </p>
                </div>
                <Switch
                  checked={settings.notifications.enable_proposal_notifications}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Project Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Notify when projects are created
                  </p>
                </div>
                <Switch
                  checked={settings.notifications.enable_project_notifications}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Admin Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Send notifications to admins
                  </p>
                </div>
                <Switch
                  checked={settings.notifications.enable_admin_notifications}
                />
              </div>
              <Button
                onClick={() => updateMutation.mutate({ notifications: notificationSettings })}
                className="bg-yellow-400 hover:bg-yellow-500 text-black"
              >
                Save Notification Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security">
          <Card className="border-yellow-400/20">
            <CardHeader>
              <CardTitle>Security Settings</CardTitle>
              <CardDescription>Configure security and access control</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Require Email Verification</Label>
                  <p className="text-sm text-muted-foreground">
                    Users must verify email before access
                  </p>
                </div>
                <Switch
                  checked={settings.security.require_email_verification}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Require Client Verification</Label>
                  <p className="text-sm text-muted-foreground">
                    Clients need admin approval
                  </p>
                </div>
                <Switch
                  checked={settings.security.require_client_verification}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="session_timeout">Session Timeout (minutes)</Label>
                <Input
                  id="session_timeout"
                  type="number"
                  defaultValue={settings.security.session_timeout_minutes}
                  placeholder="60"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="max_attempts">Max Login Attempts</Label>
                <Input
                  id="max_attempts"
                  type="number"
                  defaultValue={settings.security.max_login_attempts}
                  placeholder="5"
                />
              </div>
              <Button
                onClick={() => updateMutation.mutate({ security: securitySettings })}
                className="bg-yellow-400 hover:bg-yellow-500 text-black"
              >
                Save Security Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
