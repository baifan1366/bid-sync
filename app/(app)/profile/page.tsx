'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createGraphQLClient } from '@/lib/graphql/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CheckCircle, Clock, XCircle, Edit2, Save, X, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useState } from 'react'
import { useToast } from '@/components/ui/use-toast'
import { Separator } from '@/components/ui/separator'

const ME_QUERY = `
  query Me {
    me {
      id
      email
      role
      verificationStatus
      verificationReason
      emailVerified
      fullName
      createdAt
    }
  }
`

export default function ProfilePage() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [isEditing, setIsEditing] = useState(false)
  const [editedData, setEditedData] = useState({
    fullName: '',
    businessName: '',
    companyRegistration: '',
    professionalTitle: '',
    companyName: '',
  })

  const { data, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const client = createGraphQLClient()
      const result = await client.request<any>(ME_QUERY)
      
      // Get user metadata from Supabase
      const supabase = createClient()
      const { data: { user: authUser } } = await supabase.auth.getUser()
      
      // Initialize edit form with current values
      setEditedData({
        fullName: result.me?.fullName || authUser?.user_metadata?.full_name || '',
        businessName: authUser?.user_metadata?.business_name || '',
        companyRegistration: authUser?.user_metadata?.company_registration || '',
        professionalTitle: authUser?.user_metadata?.professional_title || '',
        companyName: authUser?.user_metadata?.company_name || '',
      })
      
      return { ...result, metadata: authUser?.user_metadata }
    }
  })

  const updateProfileMutation = useMutation({
    mutationFn: async (updates: any) => {
      const supabase = createClient()
      const { error } = await supabase.auth.updateUser({
        data: updates
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

  const hasChanges = () => {
    const originalFullName = user?.fullName || metadata?.full_name || ''
    const originalBusinessName = metadata?.business_name || ''
    const originalCompanyRegistration = metadata?.company_registration || ''
    const originalProfessionalTitle = metadata?.professional_title || ''
    const originalCompanyName = metadata?.company_name || ''

    if (editedData.fullName !== originalFullName) return true
    
    if (user?.role === 'CLIENT') {
      if (editedData.businessName !== originalBusinessName) return true
      if (editedData.companyRegistration !== originalCompanyRegistration) return true
    }
    
    if (user?.role === 'BIDDING_LEAD' || user?.role === 'BIDDING_MEMBER') {
      if (editedData.professionalTitle !== originalProfessionalTitle) return true
      if (editedData.companyName !== originalCompanyName) return true
    }
    
    return false
  }

  const handleSave = () => {
    // Validate full name is not empty
    if (!editedData.fullName.trim()) {
      toast({
        title: 'Validation error',
        description: 'Full name cannot be empty',
        variant: 'destructive',
      })
      return
    }

    // Check if any changes were made
    if (!hasChanges()) {
      toast({
        title: 'No changes detected',
        description: 'Please make changes before saving',
        variant: 'destructive',
      })
      return
    }

    const updates: any = {
      full_name: editedData.fullName,
    }

    // Add role-specific fields
    if (user?.role === 'CLIENT') {
      updates.business_name = editedData.businessName
      updates.company_registration = editedData.companyRegistration
    } else if (user?.role === 'BIDDING_LEAD' || user?.role === 'BIDDING_MEMBER') {
      updates.professional_title = editedData.professionalTitle
      updates.company_name = editedData.companyName
    }

    updateProfileMutation.mutate(updates)
  }

  const handleCancel = () => {
    // Reset to original values
    setEditedData({
      fullName: user?.fullName || data?.metadata?.full_name || '',
      businessName: data?.metadata?.business_name || '',
      companyRegistration: data?.metadata?.company_registration || '',
      professionalTitle: data?.metadata?.professional_title || '',
      companyName: data?.metadata?.company_name || '',
    })
    setIsEditing(false)
  }

  const user = data?.me
  const metadata = data?.metadata

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

  return (
    <div className="min-h-screen bg-white dark:bg-black p-4 sm:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">My Profile</h1>
          {!isEditing ? (
            <Button
              onClick={() => setIsEditing(true)}
              className="bg-yellow-400 hover:bg-yellow-500 text-black"
            >
              <Edit2 className="h-4 w-4 mr-2" />
              Edit Profile
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button
                onClick={handleCancel}
                variant="outline"
                className="border-yellow-400/20"
                disabled={updateProfileMutation.isPending}
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                className="bg-yellow-400 hover:bg-yellow-500 text-black disabled:opacity-50"
                disabled={updateProfileMutation.isPending || !hasChanges()}
              >
                {updateProfileMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save Changes
              </Button>
            </div>
          )}
        </div>

        <Card className="border-yellow-400/20">
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isEditing ? (
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input
                    id="fullName"
                    value={editedData.fullName}
                    onChange={(e) => setEditedData({ ...editedData, fullName: e.target.value })}
                    className="border-yellow-400/20 focus-visible:ring-yellow-400"
                    placeholder="Enter your full name"
                  />
                </div>

                {user?.role === 'CLIENT' && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="businessName">Business Name</Label>
                      <Input
                        id="businessName"
                        value={editedData.businessName}
                        onChange={(e) => setEditedData({ ...editedData, businessName: e.target.value })}
                        className="border-yellow-400/20 focus-visible:ring-yellow-400"
                        placeholder="Enter your business name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="companyRegistration">Company Registration</Label>
                      <Input
                        id="companyRegistration"
                        value={editedData.companyRegistration}
                        onChange={(e) => setEditedData({ ...editedData, companyRegistration: e.target.value })}
                        className="border-yellow-400/20 focus-visible:ring-yellow-400"
                        placeholder="Enter company registration number"
                      />
                    </div>
                  </>
                )}

                {(user?.role === 'BIDDING_LEAD' || user?.role === 'BIDDING_MEMBER') && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="professionalTitle">Professional Title</Label>
                      <Input
                        id="professionalTitle"
                        value={editedData.professionalTitle}
                        onChange={(e) => setEditedData({ ...editedData, professionalTitle: e.target.value })}
                        className="border-yellow-400/20 focus-visible:ring-yellow-400"
                        placeholder="e.g., Senior Engineer"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="companyName">Company / Organization</Label>
                      <Input
                        id="companyName"
                        value={editedData.companyName}
                        onChange={(e) => setEditedData({ ...editedData, companyName: e.target.value })}
                        className="border-yellow-400/20 focus-visible:ring-yellow-400"
                        placeholder="Enter your company name"
                      />
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="grid gap-4">
                <div className="flex flex-col sm:flex-row sm:justify-between gap-2">
                  <span className="text-muted-foreground">Full Name:</span>
                  <span className="font-medium">{user?.fullName || metadata?.full_name || 'Not set'}</span>
                </div>

                {user?.role === 'CLIENT' && (
                  <>
                    <Separator className="bg-yellow-400/10" />
                    <div className="flex flex-col sm:flex-row sm:justify-between gap-2">
                      <span className="text-muted-foreground">Business Name:</span>
                      <span className="font-medium">{metadata?.business_name || 'Not set'}</span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:justify-between gap-2">
                      <span className="text-muted-foreground">Company Registration:</span>
                      <span className="font-medium">{metadata?.company_registration || 'Not set'}</span>
                    </div>
                  </>
                )}

                {(user?.role === 'BIDDING_LEAD' || user?.role === 'BIDDING_MEMBER') && (
                  <>
                    <Separator className="bg-yellow-400/10" />
                    <div className="flex flex-col sm:flex-row sm:justify-between gap-2">
                      <span className="text-muted-foreground">Professional Title:</span>
                      <span className="font-medium">{metadata?.professional_title || 'Not set'}</span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:justify-between gap-2">
                      <span className="text-muted-foreground">Company / Organization:</span>
                      <span className="font-medium">{metadata?.company_name || 'Not set'}</span>
                    </div>
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-yellow-400/20">
          <CardHeader>
            <CardTitle>Account Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4">
              <div className="flex flex-col sm:flex-row sm:justify-between gap-2">
                <span className="text-muted-foreground">Email:</span>
                <span className="font-medium">{user?.email}</span>
              </div>

              <div className="flex flex-col sm:flex-row sm:justify-between gap-2">
                <span className="text-muted-foreground">Role:</span>
                <Badge className="bg-yellow-400 text-black hover:bg-yellow-500 w-fit">
                  {user?.role?.split('_').map((word: string) => 
                    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
                  ).join(' ')}
                </Badge>
              </div>

              <div className="flex flex-col sm:flex-row sm:justify-between gap-2">
                <span className="text-muted-foreground">Verification Status:</span>
                {getStatusBadge(user?.verificationStatus)}
              </div>

              {user?.verificationReason && (
                <div className="flex flex-col gap-2">
                  <span className="text-muted-foreground">Verification Note:</span>
                  <p className="text-sm bg-yellow-400/5 border border-yellow-400/20 rounded p-3">
                    {user.verificationReason}
                  </p>
                </div>
              )}

              <div className="flex flex-col sm:flex-row sm:justify-between gap-2">
                <span className="text-muted-foreground">Member Since:</span>
                <span className="font-medium">
                  {new Date(user?.createdAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </span>
              </div>
            </div>

            {user?.role === 'CLIENT' && user?.verificationStatus === 'PENDING_VERIFICATION' && (
              <div className="mt-6 p-4 bg-yellow-400/5 border border-yellow-400/20 rounded">
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <Clock className="h-5 w-5 text-yellow-400" />
                  Verification Pending
                </h3>
                <p className="text-sm text-muted-foreground">
                  Your account is currently under review by our admin team. 
                  You will be able to create projects once your account is verified. 
                  This usually takes 1-2 business days.
                </p>
              </div>
            )}

            {user?.role === 'CLIENT' && user?.verificationStatus === 'VERIFIED' && (
              <div className="mt-6 p-4 bg-green-500/5 border border-green-500/20 rounded">
                <h3 className="font-semibold mb-2 flex items-center gap-2 text-green-600 dark:text-green-400">
                  <CheckCircle className="h-5 w-5" />
                  Account Verified
                </h3>
                <p className="text-sm text-muted-foreground">
                  Your account has been verified! You can now create projects and receive proposals.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
