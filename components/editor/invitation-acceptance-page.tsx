/**
 * Invitation Acceptance Page Component
 * 
 * Handles document collaboration invitation acceptance:
 * - Build invitation landing page
 * - Display invitation details (document, inviter, role)
 * - Add accept/decline buttons
 * - Handle expired invitations
 * - Redirect to document after acceptance
 * 
 * Requirements: 2.4
 */

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@/hooks/use-user'
import { useGraphQLQuery, useGraphQLMutation } from '@/hooks/use-graphql'
import { gql } from 'graphql-request'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import {
  Mail,
  FileText,
  User,
  Shield,
  Edit,
  Eye,
  MessageSquare,
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock,
  ArrowRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const GET_INVITATION = gql`
  query GetInvitation($token: String!) {
    pendingInvitations(email: "") {
      id
      documentId
      documentTitle
      email
      role
      token
      invitedBy
      invitedByName
      expiresAt
      acceptedAt
      acceptedBy
      createdAt
    }
  }
`

const ACCEPT_INVITATION = gql`
  mutation AcceptInvitation($token: String!) {
    acceptInvitation(token: $token) {
      success
      collaborator {
        id
        documentId
        userId
        role
      }
      error
    }
  }
`

interface Invitation {
  id: string
  documentId: string
  documentTitle: string
  email: string
  role: 'editor' | 'commenter' | 'viewer'
  token: string
  invitedBy: string
  invitedByName: string
  expiresAt: string
  acceptedAt?: string
  acceptedBy?: string
  createdAt: string
}

interface InvitationAcceptancePageProps {
  token: string
}

export function InvitationAcceptancePage({ token }: InvitationAcceptancePageProps) {
  const router = useRouter()
  const { user, isLoading: userLoading } = useUser()
  const { toast } = useToast()
  const [invitation, setInvitation] = useState<Invitation | null>(null)
  const [isExpired, setIsExpired] = useState(false)
  const [isAccepting, setIsAccepting] = useState(false)
  const [isDeclining, setIsDeclining] = useState(false)

  // Fetch invitation details
  const { data, isLoading, error } = useGraphQLQuery<{ pendingInvitations: Invitation[] }>(
    ['invitation', token],
    GET_INVITATION,
    { token },
    { enabled: !!token }
  )

  const acceptInvitationMutation = useGraphQLMutation(ACCEPT_INVITATION)

  // Find the invitation with matching token
  useEffect(() => {
    if (data?.pendingInvitations) {
      const foundInvitation = data.pendingInvitations.find((inv) => inv.token === token)
      if (foundInvitation) {
        setInvitation(foundInvitation)
        setIsExpired(new Date(foundInvitation.expiresAt) < new Date())
      }
    }
  }, [data, token])

  // Handle accept invitation
  const handleAccept = async () => {
    if (!user) {
      toast({
        title: 'Authentication required',
        description: 'Please sign in to accept this invitation',
        variant: 'destructive',
      })
      router.push(`/login?redirect=/invitations/${token}`)
      return
    }

    if (!invitation) return

    // Check if user email matches invitation email
    if (user.email !== invitation.email) {
      toast({
        title: 'Email mismatch',
        description: `This invitation was sent to ${invitation.email}. Please sign in with that account.`,
        variant: 'destructive',
      })
      return
    }

    setIsAccepting(true)
    try {
      const result = await acceptInvitationMutation.mutateAsync({ token })

      if (result.acceptInvitation.success) {
        toast({
          title: 'Invitation accepted',
          description: 'You now have access to this document',
        })
        // Redirect to the document
        router.push(`/editor/${invitation.documentId}`)
      } else {
        toast({
          title: 'Failed to accept invitation',
          description: result.acceptInvitation.error || 'An error occurred',
          variant: 'destructive',
        })
        setIsAccepting(false)
      }
    } catch (error) {
      console.error('Failed to accept invitation:', error)
      toast({
        title: 'Error',
        description: 'Failed to accept invitation',
        variant: 'destructive',
      })
      setIsAccepting(false)
    }
  }

  // Handle decline invitation
  const handleDecline = () => {
    setIsDeclining(true)
    toast({
      title: 'Invitation declined',
      description: 'You have declined this invitation',
    })
    // Redirect to home or documents page
    setTimeout(() => {
      router.push('/app/documents')
    }, 1500)
  }

  // Get role icon
  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'editor':
        return <Edit className="h-5 w-5" />
      case 'commenter':
        return <MessageSquare className="h-5 w-5" />
      case 'viewer':
        return <Eye className="h-5 w-5" />
      default:
        return null
    }
  }

  // Get role description
  const getRoleDescription = (role: string) => {
    switch (role) {
      case 'editor':
        return 'You will be able to edit and modify the document content'
      case 'commenter':
        return 'You will be able to add comments but not edit the document'
      case 'viewer':
        return 'You will have read-only access to the document'
      default:
        return ''
    }
  }

  // Get role badge color
  const getRoleBadgeClass = (role: string) => {
    switch (role) {
      case 'editor':
        return 'bg-yellow-400/80 text-black'
      case 'commenter':
        return 'bg-yellow-400/60 text-black'
      case 'viewer':
        return 'bg-yellow-400/40 text-black'
      default:
        return ''
    }
  }

  // Loading state
  if (isLoading || userLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-black">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-yellow-400 mx-auto" />
          <p className="text-muted-foreground">Loading invitation...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error || !invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-black p-4">
        <Card className="max-w-md w-full border-yellow-400/20 p-8">
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="h-16 w-16 rounded-full bg-red-500/10 flex items-center justify-center">
                <XCircle className="h-8 w-8 text-red-500" />
              </div>
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-2">Invitation Not Found</h2>
              <p className="text-muted-foreground">
                This invitation link is invalid or has already been used.
              </p>
            </div>
            <Button
              onClick={() => router.push('/app/documents')}
              className="bg-yellow-400 hover:bg-yellow-500 text-black"
            >
              Go to Documents
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  // Already accepted state
  if (invitation.acceptedAt) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-black p-4">
        <Card className="max-w-md w-full border-yellow-400/20 p-8">
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="h-16 w-16 rounded-full bg-green-500/10 flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-2">Already Accepted</h2>
              <p className="text-muted-foreground">
                This invitation has already been accepted.
              </p>
            </div>
            <Button
              onClick={() => router.push(`/editor/${invitation.documentId}`)}
              className="bg-yellow-400 hover:bg-yellow-500 text-black"
            >
              <FileText className="h-4 w-4 mr-2" />
              Open Document
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  // Expired state
  if (isExpired) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-black p-4">
        <Card className="max-w-md w-full border-yellow-400/20 p-8">
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="h-16 w-16 rounded-full bg-yellow-400/10 flex items-center justify-center">
                <Clock className="h-8 w-8 text-yellow-400" />
              </div>
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-2">Invitation Expired</h2>
              <p className="text-muted-foreground">
                This invitation expired on {new Date(invitation.expiresAt).toLocaleDateString()}.
                Please contact {invitation.invitedByName} to request a new invitation.
              </p>
            </div>
            <div className="space-y-2">
              <div className="p-4 bg-yellow-400/5 rounded-lg border border-yellow-400/20">
                <div className="flex items-center gap-3 text-sm">
                  <FileText className="h-5 w-5 text-yellow-400 shrink-0" />
                  <div className="text-left">
                    <p className="font-medium">{invitation.documentTitle}</p>
                    <p className="text-muted-foreground">Invited by {invitation.invitedByName}</p>
                  </div>
                </div>
              </div>
            </div>
            <Button
              onClick={() => router.push('/app/documents')}
              variant="outline"
              className="border-yellow-400/20"
            >
              Go to Documents
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  // Main invitation acceptance UI
  return (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-black p-4">
      <Card className="max-w-2xl w-full border-yellow-400/20 p-8">
        <div className="space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="flex justify-center">
              <div className="h-16 w-16 rounded-full bg-yellow-400/10 flex items-center justify-center">
                <Mail className="h-8 w-8 text-yellow-400" />
              </div>
            </div>
            <h1 className="text-3xl font-bold">You're Invited!</h1>
            <p className="text-muted-foreground">
              You've been invited to collaborate on a document
            </p>
          </div>

          {/* Invitation Details */}
          <div className="space-y-4">
            {/* Document */}
            <div className="p-4 bg-yellow-400/5 rounded-lg border border-yellow-400/20">
              <div className="flex items-start gap-3">
                <FileText className="h-6 w-6 text-yellow-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground mb-1">Document</p>
                  <p className="text-lg font-semibold">{invitation.documentTitle}</p>
                </div>
              </div>
            </div>

            {/* Inviter */}
            <div className="p-4 bg-yellow-400/5 rounded-lg border border-yellow-400/20">
              <div className="flex items-start gap-3">
                <User className="h-6 w-6 text-yellow-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground mb-1">Invited by</p>
                  <p className="text-lg font-semibold">{invitation.invitedByName}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Sent on {new Date(invitation.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>

            {/* Role */}
            <div className="p-4 bg-yellow-400/5 rounded-lg border border-yellow-400/20">
              <div className="flex items-start gap-3">
                <div className="shrink-0 mt-0.5">{getRoleIcon(invitation.role)}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm text-muted-foreground">Your role</p>
                    <Badge className={cn('gap-1', getRoleBadgeClass(invitation.role))}>
                      {invitation.role}
                    </Badge>
                  </div>
                  <p className="text-sm">{getRoleDescription(invitation.role)}</p>
                </div>
              </div>
            </div>

            {/* Expiration */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>
                This invitation expires on {new Date(invitation.expiresAt).toLocaleDateString()}
              </span>
            </div>
          </div>

          {/* Authentication Warning */}
          {!user && (
            <div className="p-4 bg-yellow-400/10 rounded-lg border border-yellow-400/20">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-yellow-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium mb-1">Sign in required</p>
                  <p className="text-sm text-muted-foreground">
                    You need to sign in with the email address {invitation.email} to accept this
                    invitation.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Email Mismatch Warning */}
          {user && user.email !== invitation.email && (
            <div className="p-4 bg-red-500/10 rounded-lg border border-red-500/20">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium mb-1 text-red-500">Email mismatch</p>
                  <p className="text-sm text-muted-foreground">
                    This invitation was sent to {invitation.email}, but you're signed in as{' '}
                    {user.email}. Please sign in with the correct account.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              onClick={handleDecline}
              variant="outline"
              className="flex-1 border-yellow-400/20"
              disabled={isDeclining || isAccepting}
            >
              {isDeclining ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Declining...
                </>
              ) : (
                'Decline'
              )}
            </Button>
            <Button
              onClick={handleAccept}
              className="flex-1 bg-yellow-400 hover:bg-yellow-500 text-black"
              disabled={isAccepting || isDeclining || (user && user.email !== invitation.email)}
            >
              {isAccepting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Accepting...
                </>
              ) : (
                <>
                  Accept Invitation
                  <ArrowRight className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
