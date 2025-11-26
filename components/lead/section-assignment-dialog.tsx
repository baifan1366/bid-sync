"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  User,
  Calendar,
  Loader2,
  UserCheck,
  AlertCircle,
} from "lucide-react"

interface TeamMember {
  id: string
  name: string
  email: string
  assignedSections?: number
}

interface SectionAssignmentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sectionId: string
  sectionTitle: string
  currentAssignee?: string
  currentDeadline?: string
  teamMembers: TeamMember[]
  projectDeadline?: string
  onAssign: (userId: string, deadline?: string) => Promise<void>
  className?: string
}

/**
 * SectionAssignmentDialog Component
 * 
 * Dialog for assigning proposal sections to team members with optional deadlines.
 * 
 * Features:
 * - Select team member from available members
 * - Set optional deadline (validated against project deadline)
 * - Show current assignment status
 * - Display team member workload
 * 
 * Requirements: 6.1, 6.2, 6.3, 6.4, 7.1, 7.2
 */
export function SectionAssignmentDialog({
  open,
  onOpenChange,
  sectionId,
  sectionTitle,
  currentAssignee,
  currentDeadline,
  teamMembers,
  projectDeadline,
  onAssign,
  className,
}: SectionAssignmentDialogProps) {
  const [selectedUserId, setSelectedUserId] = React.useState<string>(currentAssignee || "")
  const [deadline, setDeadline] = React.useState<string>(
    currentDeadline ? new Date(currentDeadline).toISOString().split('T')[0] : ""
  )
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // Reset form when dialog opens
  React.useEffect(() => {
    if (open) {
      setSelectedUserId(currentAssignee || "")
      setDeadline(currentDeadline ? new Date(currentDeadline).toISOString().split('T')[0] : "")
      setError(null)
    }
  }, [open, currentAssignee, currentDeadline])

  const handleAssign = async () => {
    if (!selectedUserId) {
      setError("Please select a team member")
      return
    }

    // Validate deadline if provided
    if (deadline) {
      const deadlineDate = new Date(deadline)
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      if (deadlineDate < today) {
        setError("Deadline cannot be in the past")
        return
      }

      if (projectDeadline) {
        const projectDeadlineDate = new Date(projectDeadline)
        if (deadlineDate > projectDeadlineDate) {
          setError("Section deadline must be before project deadline")
          return
        }
      }
    }

    setIsLoading(true)
    setError(null)

    try {
      await onAssign(selectedUserId, deadline || undefined)
      onOpenChange(false)
    } catch (err) {
      console.error("Error assigning section:", err)
      setError(err instanceof Error ? err.message : "Failed to assign section")
    } finally {
      setIsLoading(false)
    }
  }

  const getCurrentAssigneeName = () => {
    if (!currentAssignee) return "Unassigned"
    const member = teamMembers.find((m) => m.id === currentAssignee)
    return member?.name || "Unknown"
  }

  const getSelectedMemberName = () => {
    if (!selectedUserId) return null
    const member = teamMembers.find((m) => m.id === selectedUserId)
    return member?.name || null
  }

  const isReassignment = currentAssignee && currentAssignee !== selectedUserId

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("sm:max-w-[500px]", className)}>
        <DialogHeader>
          <DialogTitle>Assign Section</DialogTitle>
          <DialogDescription>
            Assign this section to a team member and optionally set a deadline.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Section Info */}
          <div className="p-3 rounded-lg bg-yellow-400/10 border border-yellow-400/20">
            <p className="text-sm font-medium text-black dark:text-white mb-1">
              {sectionTitle}
            </p>
            <p className="text-xs text-muted-foreground">
              Currently assigned to: {getCurrentAssigneeName()}
            </p>
          </div>

          {/* Team Member Selection */}
          <div className="space-y-2">
            <Label htmlFor="team-member">Team Member *</Label>
            <Select value={selectedUserId} onValueChange={setSelectedUserId}>
              <SelectTrigger
                id="team-member"
                className="border-yellow-400/20 focus:border-yellow-400"
              >
                <SelectValue placeholder="Select a team member" />
              </SelectTrigger>
              <SelectContent>
                {teamMembers.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    No team members available
                  </div>
                ) : (
                  teamMembers.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="font-medium">{member.name}</p>
                            <p className="text-xs text-muted-foreground">{member.email}</p>
                          </div>
                        </div>
                        {member.assignedSections !== undefined && member.assignedSections > 0 && (
                          <Badge variant="outline" className="ml-2 text-xs">
                            {member.assignedSections} assigned
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Deadline Selection */}
          <div className="space-y-2">
            <Label htmlFor="deadline">Deadline (Optional)</Label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="deadline"
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                max={projectDeadline ? new Date(projectDeadline).toISOString().split('T')[0] : undefined}
                className="pl-9 border-yellow-400/20 focus:border-yellow-400"
              />
            </div>
            {projectDeadline && (
              <p className="text-xs text-muted-foreground">
                Project deadline: {new Date(projectDeadline).toLocaleDateString()}
              </p>
            )}
          </div>

          {/* Reassignment Warning */}
          {isReassignment && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-400/10 border border-yellow-400/20">
              <AlertCircle className="h-4 w-4 text-yellow-400 mt-0.5 shrink-0" />
              <div className="text-xs">
                <p className="font-medium text-black dark:text-white mb-1">
                  Reassignment Notice
                </p>
                <p className="text-muted-foreground">
                  Both {getCurrentAssigneeName()} and {getSelectedMemberName()} will be
                  notified of this reassignment.
                </p>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800">
              <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
              <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleAssign}
            disabled={!selectedUserId || isLoading}
            className="bg-yellow-400 hover:bg-yellow-500 text-black"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Assigning...
              </>
            ) : (
              <>
                <UserCheck className="h-4 w-4 mr-2" />
                {isReassignment ? "Reassign Section" : "Assign Section"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
