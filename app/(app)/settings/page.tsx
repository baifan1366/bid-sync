'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createGraphQLClient } from '@/lib/graphql/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/components/ui/use-toast'
import { Loader2, Save, User, Mail, Shield } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { NotificationPreferences } from '@/components/settings/notification-preferences'

const ME_QUERY = `
  query Me {
    me {
      id
      email
      role
      fullName
      emailVerified
      createdAt
    }
  }
`

export default function SettingsPage() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [fullName, setFullName] = useState('')
  const [isEditing, setIsEditing] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const client = createGraphQLClient()
      const result = await client.request<any>(ME_QUERY)
      return result
    }
  })

  // Sync fullName state when data changes
  useEffect(() => {
    if (data?.me?.fullName) {
      setFullName(data.me.fullName)
    }
  }, [data?.me?.fullName])

  const updateProfileMutation = useMutation({
    mutationFn: async (newFullName: string) => {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({
        data: { fullName: newFullName }
      })
      if (error) throw error
    },
    onSuccess: () => {
      toast({
        title: 'Profile updated',
        description: 'Your profile has been updated successfully.',
      })
      setIsEditing(false)
      queryClient.invalidateQueries({ queryKey: ['me'] })
    },
    onError: (error: any) => {
      toast({
        title: 'Update failed',
        description: error.message || 'Failed to update profile',
        variant: 'destructive',
      })
    }
  })

  const handleSaveProfile = () => {
    if (!fullName.trim()) {
      toast({
        title: 'Validation error',
        description: 'Full name cannot be empty',
        variant: 'destructive',
      })
      return
    }
    updateProfileMutation.mutate(fullName)
  }

  const user = data?.me

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white dark:bg-black p-4 sm:p-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-yellow-400" />
            <p className="text-muted-foreground">Loading settings...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white dark:bg-black p-4 sm:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground mt-2">
            Manage your account settings and preferences
          </p>
        </div>

        <Separator className="bg-yellow-400/20" />

        {/* Profile Settings */}
        <Card className="border-yellow-400/20">
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-yellow-400" />
              <CardTitle>Profile Information</CardTitle>
            </div>
            <CardDescription>
              Update your personal information and how others see you
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <div className="flex gap-2">
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => {
                    setFullName(e.target.value)
                    setIsEditing(true)
                  }}
                  placeholder="Enter your full name"
                  className="border-yellow-400/20 focus-visible:ring-yellow-400"
                />
                {isEditing && (
                  <Button
                    onClick={handleSaveProfile}
                    disabled={updateProfileMutation.isPending}
                    className="bg-yellow-400 hover:bg-yellow-500 text-black"
                  >
                    {updateProfileMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Save
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="email"
                  value={user?.email || ''}
                  disabled
                  className="border-yellow-400/20 bg-muted"
                />
                <Mail className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-xs text-muted-foreground">
                Email cannot be changed. Contact support if you need to update it.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Account Role</Label>
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-yellow-400" />
                <span className="font-medium">
                  {user?.role?.split('_').map((word: string) => 
                    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
                  ).join(' ')}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notification Settings */}
        {user?.id && <NotificationPreferences userId={user.id} />}

        {/* Account Information */}
        <Card className="border-yellow-400/20">
          <CardHeader>
            <CardTitle>Account Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Member Since:</span>
              <span className="font-medium">
                {new Date(user?.createdAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Email Verified:</span>
              <span className="font-medium">
                {user?.emailVerified ? 'Yes' : 'No'}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
