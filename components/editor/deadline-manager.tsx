'use client'

import { useState } from 'react'
import { useProgressTracker } from '@/hooks/use-progress-tracker'
import { SectionStatus } from '@/lib/graphql/types'
import { cn } from '@/lib/utils'
import { 
  Calendar, 
  Clock, 
  AlertCircle, 
  Plus,
  X,
  CheckCircle2
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { useToast } from '@/components/ui/use-toast'

export interface DeadlineManagerProps {
  documentId: string
  className?: string
}

/**
 * Deadline Management Component
 * 
 * Provides UI for managing deadlines at both document and section levels:
 * - Set section deadlines with date picker
 * - Set document-wide deadline
 * - Display timeline view of all deadlines
 * - Show warning/overdue indicators
 * 
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.6
 */
export function DeadlineManager({ documentId, className }: DeadlineManagerProps) {
  const { toast } = useToast()
  const {
    sections,
    deadlines,
    setDeadline,
    setDocumentDeadline,
    isLoading,
  } = useProgressTracker({
    documentId,
    enabled: true,
  })

  const [isDocumentDeadlineDialogOpen, setIsDocumentDeadlineDialogOpen] = useState(false)
  const [isSectionDeadlineDialogOpen, setIsSectionDeadlineDialogOpen] = useState(false)
  const [selectedSectionId, setSelectedSectionId] = useState<string>('')
  const [documentDeadlineDate, setDocumentDeadlineDate] = useState('')
  const [documentDeadlineTime, setDocumentDeadlineTime] = useState('')
  const [sectionDeadlineDate, setSectionDeadlineDate] = useState('')
  const [sectionDeadlineTime, setSectionDeadlineTime] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  // Handle document deadline submission
  const handleSetDocumentDeadline = async () => {
    if (!documentDeadlineDate || !documentDeadlineTime) {
      toast({
        title: 'Invalid Input',
        description: 'Please select both date and time',
        variant: 'destructive',
      })
      return
    }

    setIsSaving(true)
    try {
      const deadline = new Date(`${documentDeadlineDate}T${documentDeadlineTime}`)
      await setDocumentDeadline(deadline)
      
      toast({
        title: 'Success',
        description: 'Document deadline has been set',
      })
      
      setIsDocumentDeadlineDialogOpen(false)
      setDocumentDeadlineDate('')
      setDocumentDeadlineTime('')
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to set document deadline',
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }

  // Handle section deadline submission
  const handleSetSectionDeadline = async () => {
    if (!selectedSectionId || !sectionDeadlineDate || !sectionDeadlineTime) {
      toast({
        title: 'Invalid Input',
        description: 'Please select section, date, and time',
        variant: 'destructive',
      })
      return
    }

    setIsSaving(true)
    try {
      const deadline = new Date(`${sectionDeadlineDate}T${sectionDeadlineTime}`)
      await setDeadline(selectedSectionId, deadline)
      
      toast({
        title: 'Success',
        description: 'Section deadline has been set',
      })
      
      setIsSectionDeadlineDialogOpen(false)
      setSelectedSectionId('')
      setSectionDeadlineDate('')
      setSectionDeadlineTime('')
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to set section deadline',
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }

  // Sort deadlines by date
  const sortedDeadlines = [...deadlines].sort((a, b) => {
    return new Date(a.deadline).getTime() - new Date(b.deadline).getTime()
  })

  // Group deadlines by status
  const overdueDeadlines = sortedDeadlines.filter(d => d.isOverdue)
  const upcomingDeadlines = sortedDeadlines.filter(d => !d.isOverdue)

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header with Actions */}
      <Card className="border-yellow-400/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-yellow-400" />
                Deadline Management
              </CardTitle>
              <CardDescription>
                Set and track deadlines for sections and the entire document
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Dialog open={isDocumentDeadlineDialogOpen} onOpenChange={setIsDocumentDeadlineDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="border-yellow-400 text-yellow-400 hover:bg-yellow-400/10">
                    <Calendar className="h-4 w-4 mr-2" />
                    Set Document Deadline
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Set Document Deadline</DialogTitle>
                    <DialogDescription>
                      Set a deadline for the entire document. This will apply to all sections.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="doc-deadline-date">Date</Label>
                      <Input
                        id="doc-deadline-date"
                        type="date"
                        value={documentDeadlineDate}
                        onChange={(e) => setDocumentDeadlineDate(e.target.value)}
                        min={new Date().toISOString().split('T')[0]}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="doc-deadline-time">Time</Label>
                      <Input
                        id="doc-deadline-time"
                        type="time"
                        value={documentDeadlineTime}
                        onChange={(e) => setDocumentDeadlineTime(e.target.value)}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setIsDocumentDeadlineDialogOpen(false)}
                      disabled={isSaving}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleSetDocumentDeadline}
                      disabled={isSaving}
                      className="bg-yellow-400 text-black hover:bg-yellow-500"
                    >
                      {isSaving ? 'Setting...' : 'Set Deadline'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Dialog open={isSectionDeadlineDialogOpen} onOpenChange={setIsSectionDeadlineDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="bg-yellow-400 text-black hover:bg-yellow-500">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Section Deadline
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Set Section Deadline</DialogTitle>
                    <DialogDescription>
                      Set a deadline for a specific section
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="section-select">Section</Label>
                      <Select value={selectedSectionId} onValueChange={setSelectedSectionId}>
                        <SelectTrigger id="section-select">
                          <SelectValue placeholder="Select a section" />
                        </SelectTrigger>
                        <SelectContent>
                          {sections.map((section) => (
                            <SelectItem key={section.sectionId} value={section.sectionId}>
                              {section.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="section-deadline-date">Date</Label>
                      <Input
                        id="section-deadline-date"
                        type="date"
                        value={sectionDeadlineDate}
                        onChange={(e) => setSectionDeadlineDate(e.target.value)}
                        min={new Date().toISOString().split('T')[0]}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="section-deadline-time">Time</Label>
                      <Input
                        id="section-deadline-time"
                        type="time"
                        value={sectionDeadlineTime}
                        onChange={(e) => setSectionDeadlineTime(e.target.value)}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setIsSectionDeadlineDialogOpen(false)}
                      disabled={isSaving}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleSetSectionDeadline}
                      disabled={isSaving}
                      className="bg-yellow-400 text-black hover:bg-yellow-500"
                    >
                      {isSaving ? 'Setting...' : 'Set Deadline'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Overdue Deadlines Alert */}
      {overdueDeadlines.length > 0 && (
        <Card className="border-red-500/20 bg-red-500/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-500">
              <AlertCircle className="h-5 w-5" />
              Overdue Deadlines ({overdueDeadlines.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {overdueDeadlines.map((deadline) => (
                <DeadlineTimelineItem
                  key={deadline.sectionId}
                  deadline={deadline}
                  isOverdue={true}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Timeline View */}
      <Card className="border-yellow-400/20">
        <CardHeader>
          <CardTitle>Deadline Timeline</CardTitle>
          <CardDescription>
            All upcoming deadlines in chronological order
          </CardDescription>
        </CardHeader>
        <CardContent>
          {upcomingDeadlines.length === 0 && overdueDeadlines.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No deadlines set yet</p>
              <p className="text-sm">Add deadlines to track your progress</p>
            </div>
          ) : upcomingDeadlines.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-green-500" />
              <p>All upcoming deadlines completed!</p>
              <p className="text-sm">Check overdue section above for any missed deadlines</p>
            </div>
          ) : (
            <div className="space-y-3">
              {upcomingDeadlines.map((deadline, index) => (
                <DeadlineTimelineItem
                  key={deadline.sectionId}
                  deadline={deadline}
                  isOverdue={false}
                  isFirst={index === 0}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================================================
// Sub-components
// ============================================================================

interface DeadlineTimelineItemProps {
  deadline: {
    sectionId: string
    title: string
    deadline: Date
    assignedTo?: string
    assignedToUser?: {
      id: string
      name?: string
      email: string
    }
    isOverdue: boolean
    hoursRemaining: number
    status: SectionStatus
  }
  isOverdue: boolean
  isFirst?: boolean
}

function DeadlineTimelineItem({ deadline, isOverdue, isFirst }: DeadlineTimelineItemProps) {
  const deadlineDate = deadline.deadline
  const now = new Date()
  const hoursRemaining = (deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60)

  const getUrgencyColor = () => {
    if (isOverdue) return 'border-red-500 bg-red-500/5'
    if (hoursRemaining < 6) return 'border-red-400 bg-red-400/5'
    if (hoursRemaining < 24) return 'border-yellow-400 bg-yellow-400/5'
    return 'border-yellow-400/20'
  }

  const getStatusColor = (status: SectionStatus) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500 text-white'
      case 'in_review':
        return 'bg-blue-500 text-white'
      case 'in_progress':
        return 'bg-yellow-400 text-black'
      default:
        return 'bg-gray-300 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
    }
  }

  const formatTimeRemaining = () => {
    if (isOverdue) {
      const hoursOverdue = Math.abs(hoursRemaining)
      if (hoursOverdue < 24) {
        return `${Math.round(hoursOverdue)}h overdue`
      } else {
        return `${Math.round(hoursOverdue / 24)}d overdue`
      }
    }

    if (hoursRemaining < 24) {
      return `${Math.round(hoursRemaining)}h remaining`
    } else {
      return `${Math.round(hoursRemaining / 24)}d remaining`
    }
  }

  return (
    <div className={cn('p-4 rounded-lg border transition-colors', getUrgencyColor())}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-medium text-black dark:text-white">
              {deadline.title}
            </h4>
            <Badge className={cn('text-xs', getStatusColor(deadline.status))}>
              {deadline.status.replace('_', ' ')}
            </Badge>
            {isFirst && !isOverdue && (
              <Badge className="bg-yellow-400 text-black text-xs">
                Next Due
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              <span>{deadlineDate.toLocaleDateString()}</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              <span>{deadlineDate.toLocaleTimeString()}</span>
            </div>
            {deadline.assignedToUser && (
              <div className="flex items-center gap-1">
                <span>Assigned to: {deadline.assignedToUser.name || deadline.assignedToUser.email}</span>
              </div>
            )}
          </div>
        </div>

        <div className="shrink-0 text-right">
          <div className={cn(
            'text-sm font-medium',
            isOverdue ? 'text-red-500' : hoursRemaining < 24 ? 'text-yellow-400' : 'text-muted-foreground'
          )}>
            {formatTimeRemaining()}
          </div>
        </div>
      </div>
    </div>
  )
}
