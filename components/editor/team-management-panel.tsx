/**
 * Team Management Panel Component
 * 
 * Displays and manages document collaborators:
 * - Display collaborators list with roles
 * - Add "Invite Member" button and dialog
 * - Implement role change dropdown
 * - Add remove member button with confirmation
 * - Show pending invitations
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 8.1, 8.2, 8.3
 */

'use client'

import { useState } from 'react'
import { useUser } from '@/hooks/use-user'
import { useGraphQLQuery, useGraphQLMutation } from '@/hooks/use-graphql'
import { gql } from 'graphql-request'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { useToast } from '@/components/ui/use-toast'
import {
  UserPlus,
  Mail,
  Trash2,
  Loader2,
  Shield,
  Edit,
  Eye,
  MessageSquare,
  Clock,
  CheckCircle,
  XCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const GET_COLLABORATORS = gql`
  query GetCollaborators($documentId: ID!) {
    documentCollaborators(documentId: $documentId) {
      id
      documentId
      userId
      userName
      email
      role
      addedBy
      addedByName
      addedAt
    }
  }
`

const GET_INVITATIONS = gql`
  query GetInvitations($documentId: ID!) {
    documentInvitations(documentId: $documentId) {
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

const INVITE_MEMBER = gql`
  mutation InviteMember($input: InviteMemberInput!) {
    inviteMember(input: $input) {
      success
      invitation {
        id
        email
        role
        expiresAt
      }
      error
    }
  }
`

const UPDATE_MEMBER_ROLE = gql`
  mutation UpdateMemberRole($input: UpdateMemberRoleInput!) {
    updateMemberRole(input: $input) {
      success
      collaborator {
        id
        userId
        role
      }
      error
    }
  }
`

const REMOVE_MEMBER = gql`
  mutation RemoveMember($documentId: ID!, $userId: ID!) {
    removeMember(documentId: $documentId, userId: $userId)
  }
`

interface Collaborator {
  id: string
  documentId: string
  userId: string
  userName: string
  email: string
  role: 'owner' | 'editor' | 'commenter' | 'viewer'
  addedBy: string
  addedByName: string
  addedAt: string
}

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

interface TeamManagementPanelProps {
  documentId: string
  isOpen: boolean
  onClose: () => void
}

export function TeamManagementPanel({ documentId, isOpen, onClose }: TeamManagementPanelProps) {
  const { user } = useUser()
  const { toast } = useToast()
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false)
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false)
  const [selectedCollaborator, setSelectedCollaborator] = useState<Collaborator | null>(null)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'editor' | 'commenter' | 'viewer'>('editor')

  // Fetch collaborators
  const {
    data: collaboratorsData,
    isLoading: collaboratorsLoading,
    refetch: refetchCollaborators,
  } = useGraphQLQuery<{ documentCollaborators: Collaborator[] }>(
    ['collaborators', documentId],
    GET_COLLABORATORS,
    { documentId },
    { enabled: isOpen }
  )

  // Fetch invitations
  const {
    data: invitationsData,
    isLoading: invitationsLoading,
    refetch: refetchInvitations,
  } = useGraphQLQuery<{ documentInvitations: Invitation[] }>(
    ['invitations', documentId],
    GET_INVITATIONS,
    { documentId },
    { enabled: isOpen }
  )

  const inviteMemberMutation = useGraphQLMutation(INVITE_MEMBER, [
    ['collaborators', documentId],
    ['invitations', documentId],
  ])

  const updateRoleMutation = useGraphQLMutation(UPDATE_MEMBER_ROLE, [
    ['collaborators', documentId],
  ])

  const removeMemberMutation = useGraphQLMutation(REMOVE_MEMBER, [
    ['collaborators', documentId],
  ])

  const collaborators = collaboratorsData?.documentCollaborators || []
  const invitations = invitationsData?.documentInvitations || []
  const pendingInvitations = invitations.filter((inv) => !inv.acceptedAt)

  // Get current user's role
  const currentUserRole = collaborators.find((c) => c.userId === user?.id)?.role
  const isOwner = currentUserRole === 'owner'

  // Handle invite member
  const handleInviteMember = async () => {
    if (!inviteEmail.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter an email address',
        variant: 'destructive',
      })
      return
    }

    try {
      const result = await inviteMemberMutation.mutateAsync({
        input: {
          documentId,
          email: inviteEmail.trim(),
          role: inviteRole,
        },
      })

      if (result.inviteMember.success) {
        toast({
          title: 'Invitation sent',
          description: `An invitation has been sent to ${inviteEmail}`,
        })
        setInviteEmail('')
        setInviteRole('editor')
        setInviteDialogOpen(false)
        refetchInvitations()
      } else {
        toast({
          title: 'Failed to send invitation',
          description: result.inviteMember.error || 'An error occurred',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('Failed to invite member:', error)
      toast({
        title: 'Error',
        description: 'Failed to send invitation',
        variant: 'destructive',
      })
    }
  }

  // Handle role change
  const handleRoleChange = async (collaborator: Collaborator, newRole: string) => {
    if (newRole === collaborator.role) return

    try {
      const result = await updateRoleMutation.mutateAsync({
        input: {
          documentId,
          userId: collaborator.userId,
          role: newRole.toUpperCase(),
        },
      })

      if (result.updateMemberRole.success) {
        toast({
          title: 'Role updated',
          description: `${collaborator.userName}'s role has been updated to ${newRole}`,
        })
        refetchCollaborators()
      } else {
        toast({
          title: 'Failed to update role',
          description: result.updateMemberRole.error || 'An error occurred',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('Failed to update role:', error)
      toast({
        title: 'Error',
        description: 'Failed to update role',
        variant: 'destructive',
      })
    }
  }

  // Handle remove member
  const handleRemoveMember = async () => {
    if (!selectedCollaborator) return

    try {
      await removeMemberMutation.mutateAsync({
        documentId,
        userId: selectedCollaborator.userId,
      })

      toast({
        title: 'Member removed',
        description: `${selectedCollaborator.userName} has been removed from this document`,
      })
      setRemoveDialogOpen(false)
      setSelectedCollaborator(null)
      refetchCollaborators()
    } catch (error) {
      console.error('Failed to remove member:', error)
      toast({
        title: 'Error',
        description: 'Failed to remove member',
        variant: 'destructive',
      })
    }
  }

  // Get role icon
  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner':
        return <Shield className="h-4 w-4" />
      case 'editor':
        return <Edit className="h-4 w-4" />
      case 'commenter':
        return <MessageSquare className="h-4 w-4" />
      case 'viewer':
        return <Eye className="h-4 w-4" />
      default:
        return null
    }
  }

  // Get role badge color
  const getRoleBadgeClass = (role: string) => {
    switch (role) {
      case 'owner':
        return 'bg-yellow-400 text-black hover:bg-yellow-500'
      case 'editor':
        return 'bg-yellow-400/80 text-black hover:bg-yellow-400'
      case 'commenter':
        return 'bg-yellow-400/60 text-black hover:bg-yellow-400/70'
      case 'viewer':
        return 'bg-yellow-400/40 text-black hover:bg-yellow-400/50'
      default:
        return ''
    }
  }

  // Get initials from name
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  if (!isOpen) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Team Management</DialogTitle>
          <DialogDescription>
            Manage collaborators and their permissions for this document
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Invite Member Button */}
          {isOwner && (
            <div>
              <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="w-full bg-yellow-400 hover:bg-yellow-500 text-black">
                    <UserPlus className="h-4 w-4 mr-2" />
                    Invite Member
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Invite Team Member</DialogTitle>
                    <DialogDescription>
                      Send an invitation to collaborate on this document
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">Email Address</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="colleague@example.com"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        className="border-yellow-400/20"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="role">Role</Label>
                      <Select value={inviteRole} onValueChange={(value: any) => setInviteRole(value)}>
                        <SelectTrigger className="border-yellow-400/20">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="editor">
                            <div className="flex items-center gap-2">
                              <Edit className="h-4 w-4" />
                              <span>Editor - Can edit content</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="commenter">
                            <div className="flex items-center gap-2">
                              <MessageSquare className="h-4 w-4" />
                              <span>Commenter - Can add comments</span>
                            </div>
                          </SelectItem>
                          <SelectItem value="viewer">
                            <div className="flex items-center gap-2">
                              <Eye className="h-4 w-4" />
                              <span>Viewer - Read-only access</span>
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setInviteDialogOpen(false)}
                      className="border-yellow-400/20"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleInviteMember}
                      disabled={inviteMemberMutation.isPending}
                      className="bg-yellow-400 hover:bg-yellow-500 text-black"
                    >
                      {inviteMemberMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <Mail className="h-4 w-4 mr-2" />
                          Send Invitation
                        </>
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          )}

          {/* Collaborators List */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Collaborators ({collaborators.length})</h3>
            {collaboratorsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-yellow-400" />
              </div>
            ) : collaborators.length === 0 ? (
              <Card className="border-yellow-400/20 p-6 text-center">
                <p className="text-sm text-muted-foreground">No collaborators yet</p>
              </Card>
            ) : (
              <div className="space-y-2">
                {collaborators.map((collaborator) => (
                  <Card
                    key={collaborator.id}
                    className="border-yellow-400/20 p-4 hover:border-yellow-400/40 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <Avatar>
                          <AvatarFallback className="bg-yellow-400 text-black">
                            {getInitials(collaborator.userName)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium truncate">{collaborator.userName}</p>
                            {collaborator.userId === user?.id && (
                              <Badge variant="secondary" className="text-xs">
                                You
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground truncate">
                            {collaborator.email}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Added {new Date(collaborator.addedAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {/* Role selector or badge */}
                        {isOwner && collaborator.role !== 'owner' ? (
                          <Select
                            value={collaborator.role}
                            onValueChange={(value) => handleRoleChange(collaborator, value)}
                            disabled={updateRoleMutation.isPending}
                          >
                            <SelectTrigger className="w-[140px] border-yellow-400/20">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="editor">
                                <div className="flex items-center gap-2">
                                  <Edit className="h-4 w-4" />
                                  <span>Editor</span>
                                </div>
                              </SelectItem>
                              <SelectItem value="commenter">
                                <div className="flex items-center gap-2">
                                  <MessageSquare className="h-4 w-4" />
                                  <span>Commenter</span>
                                </div>
                              </SelectItem>
                              <SelectItem value="viewer">
                                <div className="flex items-center gap-2">
                                  <Eye className="h-4 w-4" />
                                  <span>Viewer</span>
                                </div>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge className={cn('gap-1', getRoleBadgeClass(collaborator.role))}>
                            {getRoleIcon(collaborator.role)}
                            {collaborator.role}
                          </Badge>
                        )}

                        {/* Remove button */}
                        {isOwner && collaborator.role !== 'owner' && (
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              setSelectedCollaborator(collaborator)
                              setRemoveDialogOpen(true)
                            }}
                            className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Pending Invitations */}
          {isOwner && pendingInvitations.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">
                Pending Invitations ({pendingInvitations.length})
              </h3>
              <div className="space-y-2">
                {pendingInvitations.map((invitation) => {
                  const isExpired = new Date(invitation.expiresAt) < new Date()
                  return (
                    <Card
                      key={invitation.id}
                      className="border-yellow-400/20 p-4 hover:border-yellow-400/40 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-400/20">
                            <Mail className="h-5 w-5 text-yellow-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{invitation.email}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {isExpired ? (
                                <span className="text-red-500">
                                  Expired {new Date(invitation.expiresAt).toLocaleDateString()}
                                </span>
                              ) : (
                                <span>
                                  Expires {new Date(invitation.expiresAt).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <Badge className={cn('gap-1', getRoleBadgeClass(invitation.role))}>
                            {getRoleIcon(invitation.role)}
                            {invitation.role}
                          </Badge>
                          {isExpired && (
                            <Badge variant="destructive" className="gap-1">
                              <XCircle className="h-3 w-3" />
                              Expired
                            </Badge>
                          )}
                        </div>
                      </div>
                    </Card>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Remove Member Confirmation Dialog */}
        <AlertDialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove Team Member</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to remove {selectedCollaborator?.userName} from this document?
                They will immediately lose access and will need to be re-invited to collaborate again.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleRemoveMember}
                className="bg-red-500 hover:bg-red-600 text-white"
                disabled={removeMemberMutation.isPending}
              >
                {removeMemberMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Removing...
                  </>
                ) : (
                  'Remove Member'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  )
}
