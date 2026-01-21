'use client'

import { useQuery } from '@tanstack/react-query'
import { createGraphQLClient } from '@/lib/graphql/client'
import { GET_USER_PROFILE } from '@/lib/graphql/queries'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ArrowLeft, Mail, Calendar, CheckCircle, Clock, XCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Separator } from '@/components/ui/separator'

interface UserProfilePageProps {
  params: Promise<{ userId: string }>
}

export default function UserProfilePage({ params }: UserProfilePageProps) {
  const router = useRouter()
  const [userId, setUserId] = React.useState<string | null>(null)

  React.useEffect(() => {
    params.then(p => setUserId(p.userId))
  }, [params])

  const { data, isLoading, error } = useQuery({
    queryKey: ['userProfile', userId],
    queryFn: async () => {
      if (!userId) return null
      const client = createGraphQLClient()
      const result = await client.request<any>(GET_USER_PROFILE, { userId })
      return result.userProfile
    },
    enabled: !!userId,
  })

  const getInitials = (name: string | null) => {
    if (!name) return '?'
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const getRoleBadge = (role: string) => {
    const roleText = role.split('_').map((word: string) => 
      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ).join(' ')
    
    return (
      <Badge className="bg-yellow-400 text-black hover:bg-yellow-500">
        {roleText}
      </Badge>
    )
  }

  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'verified':
        return (
          <Badge className="bg-green-500 text-white hover:bg-green-600">
            <CheckCircle className="h-4 w-4 mr-2" />
            Verified
          </Badge>
        )
      case 'pending_verification':
        return (
          <Badge className="bg-yellow-400 text-black hover:bg-yellow-500">
            <Clock className="h-4 w-4 mr-2" />
            Pending Verification
          </Badge>
        )
      case 'rejected':
        return (
          <Badge variant="destructive">
            <XCircle className="h-4 w-4 mr-2" />
            Rejected
          </Badge>
        )
      default:
        return <Badge>{status}</Badge>
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white dark:bg-black p-8">
        <div className="max-w-4xl mx-auto">
          <p className="text-muted-foreground">Loading profile...</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-white dark:bg-black p-8">
        <div className="max-w-4xl mx-auto">
          <Card className="border-yellow-400/20">
            <CardContent className="p-6">
              <p className="text-red-500">Failed to load user profile</p>
              <Button
                onClick={() => router.back()}
                className="mt-4 bg-yellow-400 hover:bg-yellow-500 text-black"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Go Back
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white dark:bg-black p-4 sm:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button
            onClick={() => router.back()}
            variant="outline"
            className="border-yellow-400/20 hover:bg-yellow-400/10"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <h1 className="text-3xl font-bold text-black dark:text-white">User Profile</h1>
        </div>

        <Card className="border-yellow-400/20">
          <CardHeader>
            <div className="flex items-start gap-6">
              <Avatar className="h-24 w-24">
                <AvatarImage src={undefined} />
                <AvatarFallback className="bg-yellow-400 text-black text-2xl">
                  {getInitials(data.fullName)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <CardTitle className="text-2xl mb-2">{data.fullName}</CardTitle>
                <div className="flex flex-wrap gap-2 mb-3">
                  {getRoleBadge(data.role)}
                  {getStatusBadge(data.verificationStatus)}
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="h-4 w-4" />
                  <span>{data.email}</span>
                </div>
              </div>
            </div>
          </CardHeader>
        </Card>

        <Card className="border-yellow-400/20">
          <CardHeader>
            <CardTitle>Account Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4">
              <div className="flex flex-col sm:flex-row sm:justify-between gap-2">
                <span className="text-muted-foreground">User ID:</span>
                <span className="font-mono text-sm">{data.id}</span>
              </div>

              <Separator className="bg-yellow-400/10" />

              <div className="flex flex-col sm:flex-row sm:justify-between gap-2">
                <span className="text-muted-foreground">Role:</span>
                {getRoleBadge(data.role)}
              </div>

              <div className="flex flex-col sm:flex-row sm:justify-between gap-2">
                <span className="text-muted-foreground">Verification Status:</span>
                {getStatusBadge(data.verificationStatus)}
              </div>

              <div className="flex flex-col sm:flex-row sm:justify-between gap-2">
                <span className="text-muted-foreground flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Member Since:
                </span>
                <span className="font-medium">
                  {new Date(data.createdAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// Add React import
import * as React from 'react'
