"use client"

import * as React from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import {
  Calendar,
  Clock,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Plus,
  Edit,
  X,
} from "lucide-react"

interface SectionDeadline {
  sectionId: string
  sectionTitle: string
  deadline?: string
  assignedTo?: string
  assigneeName?: string
  status: 'not_started' | 'in_progress' | 'in_review' | 'completed'
}

interface DeadlineManagerProps {
  sections: SectionDeadline[]
  projectDeadline?: string
  onSetDeadline: (sectionId: string, deadline: string) => Promise<void>
  onRemoveDeadline?: (sectionId: string) => Promise<void>
  className?: string
}

/**
 * DeadlineManager Component
 * 
 * Manages deadlines for proposal sections with:
 * - Visual timeline of all section deadlines
 * - Set/edit/remove deadline functionality
 * - Validation against project deadline
 * - Overdue and approaching deadline indicators
 * - Grouped by status (overdue, upcoming, future)
 * 
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5
 */
export function DeadlineManager({
  sections,
  projectDeadline,
  onSetDeadline,
  onRemoveDeadline,
  className,
}: DeadlineManagerProps) {
  const [isDialogOpen, setIsDialogOpen] = React.useState(false)
  const [selectedSectionId, setSelectedSectionId] = React.useState<string | null>(null)
  const [deadline, setDeadline] = React.useState("")
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const selectedSection = sections.find((s) => s.sectionId === selectedSectionId)

  const openDeadlineDialog = (sectionId: string) => {
    const section = sections.find((s) => s.sectionId === sectionId)
    setSelectedSectionId(sectionId)
    setDeadline(
      section?.deadline ? new Date(section.deadline).toISOString().split('T')[0] : ""
    )
    setError(null)
    setIsDialogOpen(true)
  }

  const handleSetDeadline = async () => {
    if (!selectedSectionId || !deadline) {
      setError("Please select a deadline")
      return
    }

    // Validate deadline
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

    setIsLoading(true)
    setError(null)

    try {
      await onSetDeadline(selectedSectionId, deadline)
      setIsDialogOpen(false)
      setSelectedSectionId(null)
      setDeadline("")
    } catch (err) {
      console.error("Error setting deadline:", err)
      setError(err instanceof Error ? err.message : "Failed to set deadline")
    } finally {
      setIsLoading(false)
    }
  }

  const handleRemoveDeadline = async (sectionId: string) => {
    if (!onRemoveDeadline) return

    setIsLoading(true)
    try {
      await onRemoveDeadline(sectionId)
    } catch (error) {
      console.error("Error removing deadline:", error)
    } finally {
      setIsLoading(false)
    }
  }

  // Categorize sections by deadline status
  const categorizedSections = React.useMemo(() => {
    const now = new Date()
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const nextWeek = new Date(now)
    nextWeek.setDate(nextWeek.getDate() + 7)

    const overdue: SectionDeadline[] = []
    const today: SectionDeadline[] = []
    const upcoming: SectionDeadline[] = []
    const future: SectionDeadline[] = []
    const noDeadline: SectionDeadline[] = []

    sections.forEach((section) => {
      if (!section.deadline) {
        noDeadline.push(section)
        return
      }

      const deadlineDate = new Date(section.deadline)
      deadlineDate.setHours(23, 59, 59, 999)

      if (section.status === 'completed') {
        // Don't show completed sections
        return
      }

      if (deadlineDate < now) {
        overdue.push(section)
      } else if (deadlineDate.toDateString() === now.toDateString()) {
        today.push(section)
      } else if (deadlineDate < nextWeek) {
        upcoming.push(section)
      } else {
        future.push(section)
      }
    })

    return { overdue, today, upcoming, future, noDeadline }
  }, [sections])

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <Badge className="bg-green-500 text-white text-xs">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Completed
          </Badge>
        )
      case "in_progress":
        return (
          <Badge className="bg-yellow-400 text-black text-xs">
            <Clock className="h-3 w-3 mr-1" />
            In Progress
          </Badge>
        )
      case "in_review":
        return (
          <Badge className="bg-blue-500 text-white text-xs">In Review</Badge>
        )
      default:
        return (
          <Badge variant="outline" className="border-yellow-400/20 text-xs">
            Not Started
          </Badge>
        )
    }
  }

  const renderSectionCard = (section: SectionDeadline, showDeadline = true) => (
    <Card
      key={section.sectionId}
      className="p-3 border-yellow-400/20 hover:border-yellow-400/40 transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-black dark:text-white mb-1">
            {section.sectionTitle}
          </h4>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {section.assigneeName && (
              <span>Assigned to: {section.assigneeName}</span>
            )}
            {getStatusBadge(section.status)}
          </div>
          {showDeadline && section.deadline && (
            <div className="flex items-center gap-1 mt-2 text-xs">
              <Calendar className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">
                {new Date(section.deadline).toLocaleDateString()} at{' '}
                {new Date(section.deadline).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => openDeadlineDialog(section.sectionId)}
            className="h-7 w-7 p-0"
            title={section.deadline ? "Edit deadline" : "Set deadline"}
          >
            {section.deadline ? (
              <Edit className="h-3 w-3" />
            ) : (
              <Plus className="h-3 w-3" />
            )}
          </Button>
          {section.deadline && onRemoveDeadline && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleRemoveDeadline(section.sectionId)}
              className="h-7 w-7 p-0 text-red-500 hover:text-red-600"
              title="Remove deadline"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>
    </Card>
  )

  return (
    <div className={cn("space-y-6", className)}>
      {/* Project Deadline */}
      {projectDeadline && (
        <Card className="p-4 border-yellow-400/20 bg-yellow-400/5">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-yellow-400" />
            <div>
              <p className="text-sm font-medium text-black dark:text-white">
                Project Deadline
              </p>
              <p className="text-xs text-muted-foreground">
                {new Date(projectDeadline).toLocaleDateString()} at{' '}
                {new Date(projectDeadline).toLocaleTimeString()}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Overdue Sections */}
      {categorizedSections.overdue.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="h-5 w-5 text-red-500" />
            <h3 className="text-sm font-semibold text-red-500">
              Overdue ({categorizedSections.overdue.length})
            </h3>
          </div>
          <div className="space-y-2">
            {categorizedSections.overdue.map((section) => renderSectionCard(section))}
          </div>
        </div>
      )}

      {/* Due Today */}
      {categorizedSections.today.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Clock className="h-5 w-5 text-yellow-400" />
            <h3 className="text-sm font-semibold text-black dark:text-white">
              Due Today ({categorizedSections.today.length})
            </h3>
          </div>
          <div className="space-y-2">
            {categorizedSections.today.map((section) => renderSectionCard(section))}
          </div>
        </div>
      )}

      {/* Upcoming (Next 7 Days) */}
      {categorizedSections.upcoming.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="h-5 w-5 text-blue-500" />
            <h3 className="text-sm font-semibold text-black dark:text-white">
              Upcoming ({categorizedSections.upcoming.length})
            </h3>
          </div>
          <div className="space-y-2">
            {categorizedSections.upcoming.map((section) => renderSectionCard(section))}
          </div>
        </div>
      )}

      {/* Future Deadlines */}
      {categorizedSections.future.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Calendar className="h-5 w-5 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-black dark:text-white">
              Future ({categorizedSections.future.length})
            </h3>
          </div>
          <div className="space-y-2">
            {categorizedSections.future.map((section) => renderSectionCard(section))}
          </div>
        </div>
      )}

      {/* No Deadline */}
      {categorizedSections.noDeadline.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Clock className="h-5 w-5 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-black dark:text-white">
              No Deadline ({categorizedSections.noDeadline.length})
            </h3>
          </div>
          <div className="space-y-2">
            {categorizedSections.noDeadline.map((section) =>
              renderSectionCard(section, false)
            )}
          </div>
        </div>
      )}

      {/* Set Deadline Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedSection?.deadline ? "Edit Deadline" : "Set Deadline"}
            </DialogTitle>
            <DialogDescription>
              Set a deadline for this section. It must be before the project deadline.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Section Info */}
            {selectedSection && (
              <div className="p-3 rounded-lg bg-yellow-400/10 border border-yellow-400/20">
                <p className="text-sm font-medium text-black dark:text-white">
                  {selectedSection.sectionTitle}
                </p>
                {selectedSection.assigneeName && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Assigned to: {selectedSection.assigneeName}
                  </p>
                )}
              </div>
            )}

            {/* Deadline Input */}
            <div className="space-y-2">
              <Label htmlFor="deadline">Deadline *</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="deadline"
                  type="datetime-local"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  min={new Date().toISOString().slice(0, 16)}
                  max={
                    projectDeadline
                      ? new Date(projectDeadline).toISOString().slice(0, 16)
                      : undefined
                  }
                  className="pl-9 border-yellow-400/20 focus:border-yellow-400"
                />
              </div>
              {projectDeadline && (
                <p className="text-xs text-muted-foreground">
                  Project deadline: {new Date(projectDeadline).toLocaleString()}
                </p>
              )}
            </div>

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
              onClick={() => setIsDialogOpen(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSetDeadline}
              disabled={!deadline || isLoading}
              className="bg-yellow-400 hover:bg-yellow-500 text-black"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Calendar className="h-4 w-4 mr-2" />
                  {selectedSection?.deadline ? "Update Deadline" : "Set Deadline"}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
