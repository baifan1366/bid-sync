'use client'

import { useState } from 'react'
import { useProgressTracker } from '@/hooks/use-progress-tracker'
import { cn } from '@/lib/utils'
import { User, UserPlus, X, Check, Mail } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import { useToast } from '@/components/ui/use-toast'
import { Skeleton } from '@/components/ui/skeleton'

export interface SectionAssignmentProps {
  documentId: string
  sectionId: string
  sectionTitle: string
  currentAssignee?: {
    id: string
    name?: string
    email: string
    avatarUrl?: string
  }
  availableUsers: Array<{
    id: string
    name?: string
    email: string
    avatarUrl?: string
  }>
  onAssignmentChange?: (userId: string | null) => void
  className?: string
}

/**
 * Section Assignment Component
 * 
 * Provides UI for assigning sections to team members:
 * - Dropdown with user list for assignment
 * - Display current assignments with avatars
 * - Send notifications on assignment via email
 * - Allow reassignment with confirmation
 * 
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
 */
export function SectionAssignment({
  documentId,
  sectionId,
  sectionTitle,
  currentAssignee,
  availableUsers,
  onAssignmentChange,
  className,
}: SectionAssignmentProps) {
  const { toast } = useToast()
  const { assignSection, unassignSection } = useProgressTracker({
    documentId,
    enabled: true,
  })

  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false)
  const [isReassignConfirmOpen, setIsReassignConfirmOpen] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState<string>('')
  const [pendingUserId, setPendingUserId] = useState<string>('')
  const [isAssigning, setIsAssigning] = useState(false)

  // Handle assignment
  const handleAssign = async (userId: string) => {
    // If already assigned, show confirmation dialog
    if (currentAssignee) {
      setPendingUserId(userId)
      setIsReassignConfirmOpen(true)
      return
    }

    await performAssignment(userId)
  }

  // Perform the actual assignment
  const performAssignment = async (userId: string) => {
    setIsAssigning(true)
    try {
      await assignSection(sectionId, userId)

      const assignedUser = availableUsers.find(u => u.id === userId)
      
      toast({
        title: 'Section Assigned',
        description: (
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            <span>
              {sectionTitle} assigned to {assignedUser?.name || assignedUser?.email}.
              Notification email sent.
            </span>
          </div>
        ),
      })

      setIsAssignDialogOpen(false)
      setIsReassignConfirmOpen(false)
      setSelectedUserId('')
      setPendingUserId('')
      
      if (onAssignmentChange) {
        onAssignmentChange(userId)
      }
    } catch (error) {
      toast({
        title: 'Assignment Failed',
        description: error instanceof Error ? error.message : 'Failed to assign section',
        variant: 'destructive',
      })
    } finally {
      setIsAssigning(false)
    }
  }

  // Handle unassignment
  const handleUnassign = async () => {
    setIsAssigning(true)
    try {
      await unassignSection(sectionId)

      toast({
        title: 'Section Unassigned',
        description: `${sectionTitle} is now available for assignment`,
      })

      if (onAssignmentChange) {
        onAssignmentChange(null)
      }
    } catch (error) {
      toast({
        title: 'Unassignment Failed',
        description: error instanceof Error ? error.message : 'Failed to unassign section',
        variant: 'destructive',
      })
    } finally {
      setIsAssigning(false)
    }
  }

  // Handle reassignment confirmation
  const handleReassignConfirm = async () => {
    await performAssignment(pendingUserId)
  }

  const pendingUser = availableUsers.find(u => u.id === pendingUserId)

  return (
    <div className={cn('space-y-3', className)}>
      {/* Current Assignment Display */}
      {currentAssignee ? (
        <Card className="border-yellow-400/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-yellow-400 text-black">
                    {(currentAssignee.name || currentAssignee.email).charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-medium text-black dark:text-white">
                    {currentAssignee.name || currentAssignee.email}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Assigned to this section
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
                  <DialogTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-yellow-400 text-yellow-400 hover:bg-yellow-400/10"
                    >
                      <UserPlus className="h-4 w-4 mr-2" />
                      Reassign
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Reassign Section</DialogTitle>
                      <DialogDescription>
                        Select a team member to assign to "{sectionTitle}"
                      </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                      <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a team member" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableUsers.map((user) => (
                            <SelectItem key={user.id} value={user.id}>
                              <div className="flex items-center gap-2">
                                <Avatar className="h-5 w-5">
                                  <AvatarFallback className="text-xs bg-yellow-400 text-black">
                                    {(user.name || user.email).charAt(0).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <span>{user.name || user.email}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => setIsAssignDialogOpen(false)}
                        disabled={isAssigning}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={() => handleAssign(selectedUserId)}
                        disabled={!selectedUserId || isAssigning}
                        className="bg-yellow-400 text-black hover:bg-yellow-500"
                      >
                        {isAssigning ? 'Assigning...' : 'Assign'}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleUnassign}
                  disabled={isAssigning}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-yellow-400/20 border-dashed">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-yellow-400/10 flex items-center justify-center">
                  <User className="h-5 w-5 text-yellow-400" />
                </div>
                <div>
                  <div className="font-medium text-black dark:text-white">
                    Unassigned
                  </div>
                  <div className="text-sm text-muted-foreground">
                    No one is assigned to this section
                  </div>
                </div>
              </div>
              <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    size="sm"
                    className="bg-yellow-400 text-black hover:bg-yellow-500"
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    Assign
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Assign Section</DialogTitle>
                    <DialogDescription>
                      Select a team member to assign to "{sectionTitle}". They will receive an email notification.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="py-4">
                    <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a team member" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableUsers.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            <div className="flex items-center gap-2">
                              <Avatar className="h-5 w-5">
                                <AvatarFallback className="text-xs bg-yellow-400 text-black">
                                  {(user.name || user.email).charAt(0).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <span>{user.name || user.email}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setIsAssignDialogOpen(false)}
                      disabled={isAssigning}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={() => handleAssign(selectedUserId)}
                      disabled={!selectedUserId || isAssigning}
                      className="bg-yellow-400 text-black hover:bg-yellow-500"
                    >
                      {isAssigning ? 'Assigning...' : 'Assign'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reassignment Confirmation Dialog */}
      <AlertDialog open={isReassignConfirmOpen} onOpenChange={setIsReassignConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Reassignment</AlertDialogTitle>
            <AlertDialogDescription>
              This section is currently assigned to {currentAssignee?.name || currentAssignee?.email}.
              Are you sure you want to reassign it to {pendingUser?.name || pendingUser?.email}?
              Both users will be notified via email.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isAssigning}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReassignConfirm}
              disabled={isAssigning}
              className="bg-yellow-400 text-black hover:bg-yellow-500"
            >
              {isAssigning ? 'Reassigning...' : 'Confirm Reassignment'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

/**
 * Bulk Section Assignment Component
 * 
 * Allows assigning multiple sections at once
 */
export interface BulkSectionAssignmentProps {
  documentId: string
  sections: Array<{
    id: string
    title: string
    assignedTo?: {
      id: string
      name?: string
      email: string
    }
  }>
  availableUsers: Array<{
    id: string
    name?: string
    email: string
    avatarUrl?: string
  }>
  className?: string
}

export function BulkSectionAssignment({
  documentId,
  sections,
  availableUsers,
  className,
}: BulkSectionAssignmentProps) {
  const { toast } = useToast()
  const { assignSection } = useProgressTracker({
    documentId,
    enabled: true,
  })

  const [assignments, setAssignments] = useState<Record<string, string>>({})
  const [isAssigning, setIsAssigning] = useState(false)

  const handleAssignmentChange = (sectionId: string, userId: string) => {
    setAssignments(prev => ({
      ...prev,
      [sectionId]: userId,
    }))
  }

  const handleBulkAssign = async () => {
    setIsAssigning(true)
    try {
      const assignmentPromises = Object.entries(assignments).map(([sectionId, userId]) =>
        assignSection(sectionId, userId)
      )

      await Promise.all(assignmentPromises)

      toast({
        title: 'Sections Assigned',
        description: `${Object.keys(assignments).length} section(s) assigned successfully. Notification emails sent.`,
      })

      setAssignments({})
    } catch (error) {
      toast({
        title: 'Assignment Failed',
        description: 'Some assignments may have failed. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setIsAssigning(false)
    }
  }

  return (
    <Card className={cn('border-yellow-400/20', className)}>
      <CardHeader>
        <CardTitle>Bulk Section Assignment</CardTitle>
        <CardDescription>
          Assign multiple sections to team members at once
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {sections.map((section) => (
          <div key={section.id} className="flex items-center justify-between p-3 rounded-lg border border-yellow-400/20">
            <div className="flex-1">
              <div className="font-medium text-sm text-black dark:text-white">
                {section.title}
              </div>
              {section.assignedTo && (
                <div className="text-xs text-muted-foreground">
                  Currently: {section.assignedTo.name || section.assignedTo.email}
                </div>
              )}
            </div>
            <Select
              value={assignments[section.id] || ''}
              onValueChange={(value) => handleAssignmentChange(section.id, value)}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select user" />
              </SelectTrigger>
              <SelectContent>
                {availableUsers.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.name || user.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}

        <Button
          onClick={handleBulkAssign}
          disabled={Object.keys(assignments).length === 0 || isAssigning}
          className="w-full bg-yellow-400 text-black hover:bg-yellow-500"
        >
          <Check className="h-4 w-4 mr-2" />
          {isAssigning ? 'Assigning...' : `Assign ${Object.keys(assignments).length} Section(s)`}
        </Button>
      </CardContent>
    </Card>
  )
}
