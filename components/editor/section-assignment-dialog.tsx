'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Avatar, Avatar as AvatarFallback } from '@/components/ui/avatar'
import { User, Calendar } from 'lucide-react'

interface SectionAssignmentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sectionId: string
  sectionTitle: string
  currentAssignee?: string
  currentDeadline?: string
  teamMembers: Array<{ id: string; name: string; email: string }>
  onAssign: (sectionId: string, userId: string, deadline?: string) => Promise<void>
}

/**
 * Section Assignment Dialog Component
 * 
 * Allows bidding leads to assign sections to team members with optional deadlines.
 */
export function SectionAssignmentDialog({
  open,
  onOpenChange,
  sectionId,
  sectionTitle,
  currentAssignee,
  currentDeadline,
  teamMembers,
  onAssign,
}: SectionAssignmentDialogProps) {
  const [selectedMember, setSelectedMember] = useState<string>(currentAssignee || '')
  const [deadline, setDeadline] = useState<string>(
    currentDeadline ? new Date(currentDeadline).toISOString().split('T')[0] : ''
  )
  const [loading, setLoading] = useState(false)

  const handleAssign = async () => {
    if (!selectedMember) return

    setLoading(true)
    try {
      await onAssign(sectionId, selectedMember, deadline || undefined)
      onOpenChange(false)
    } catch (error) {
      console.error('Error assigning section:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] border-yellow-400/20">
        <DialogHeader>
          <DialogTitle>Assign Section</DialogTitle>
          <DialogDescription>
            Assign "{sectionTitle}" to a team member
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Team Member Selection */}
          <div className="space-y-2">
            <Label htmlFor="member">Team Member</Label>
            <Select value={selectedMember} onValueChange={setSelectedMember}>
              <SelectTrigger
                id="member"
                className="border-yellow-400/20 focus:ring-yellow-400"
              >
                <SelectValue placeholder="Select a team member" />
              </SelectTrigger>
              <SelectContent>
                {teamMembers.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6 bg-yellow-400">
                        <AvatarFallback className="text-black text-xs font-bold">
                          {member.name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{member.name}</p>
                        <p className="text-xs text-muted-foreground">{member.email}</p>
                      </div>
                    </div>
                  </SelectItem>
                ))}
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
                className="pl-10 border-yellow-400/20 focus-visible:ring-yellow-400"
              />
            </div>
          </div>

          {/* Current Assignment Info */}
          {currentAssignee && (
            <div className="p-3 rounded-lg bg-yellow-400/10 border border-yellow-400/20">
              <p className="text-sm font-medium mb-1">Current Assignment</p>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <User className="h-4 w-4" />
                <span>
                  {teamMembers.find((m) => m.id === currentAssignee)?.name || 'Unknown'}
                </span>
              </div>
              {currentDeadline && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                  <Calendar className="h-4 w-4" />
                  <span>{new Date(currentDeadline).toLocaleDateString()}</span>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-yellow-400 text-yellow-400 hover:bg-yellow-400/10"
          >
            Cancel
          </Button>
          <Button
            onClick={handleAssign}
            disabled={!selectedMember || loading}
            className="bg-yellow-400 hover:bg-yellow-500 text-black"
          >
            {loading ? 'Assigning...' : 'Assign Section'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
