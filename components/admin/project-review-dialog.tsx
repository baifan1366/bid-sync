"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calendar, DollarSign, FileText, CheckCircle, XCircle } from "lucide-react"
import { formatBudget, formatDate } from "@/lib/utils"

interface Project {
  id: string
  clientId: string
  title: string
  description: string
  status: string
  budget?: number
  deadline?: string
  createdAt: string
  updatedAt: string
}

interface ProjectReviewDialogProps {
  project: Project
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ProjectReviewDialog({ project, open, onOpenChange }: ProjectReviewDialogProps) {
  const [newStatus, setNewStatus] = useState(project.status)
  const [reviewNotes, setReviewNotes] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async () => {
    setIsSubmitting(true)
    
    try {
      const response = await fetch('/api/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: `
            mutation UpdateProjectStatus($projectId: ID!, $status: ProjectStatus!, $notes: String) {
              updateProjectStatus(projectId: $projectId, status: $status, notes: $notes) {
                id
                status
              }
            }
          `,
          variables: {
            projectId: project.id,
            status: newStatus,
            notes: reviewNotes || null,
          },
        }),
      })

      const result = await response.json()

      if (result.errors) {
        console.error("GraphQL errors:", result.errors)
        alert(`Failed to update project: ${result.errors[0]?.message || 'Unknown error'}`)
        return
      }

      // Success
      onOpenChange(false)
    } catch (error) {
      console.error("Error updating project:", error)
      alert(`Failed to update project: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleApprove = () => {
    setNewStatus('OPEN')
    setTimeout(() => handleSubmit(), 100)
  }

  const handleReject = () => {
    if (!reviewNotes.trim()) {
      alert('Please provide a reason for rejection')
      return
    }
    setNewStatus('CLOSED')
    setTimeout(() => handleSubmit(), 100)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Review Project</DialogTitle>
          <DialogDescription>
            Review project details and approve or reject the submission
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Project Info */}
          <div className="space-y-4">
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Title</Label>
              <h3 className="text-lg font-bold text-black dark:text-white mt-1">
                {project.title}
              </h3>
            </div>

            <div>
              <Label className="text-sm font-medium text-muted-foreground">Description</Label>
              <p className="text-sm text-gray-700 dark:text-gray-300 mt-1 whitespace-pre-wrap">
                {project.description}
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-yellow-400" />
                <div>
                  <Label className="text-xs text-muted-foreground">Budget</Label>
                  <p className="font-semibold text-yellow-400">
                    {formatBudget(project.budget)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <Label className="text-xs text-muted-foreground">Deadline</Label>
                  <p className="font-medium">
                    {project.deadline ? formatDate(project.deadline) : 'No deadline'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <div>
                  <Label className="text-xs text-muted-foreground">Created</Label>
                  <p className="font-medium">
                    {formatDate(project.createdAt)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div>
                  <Label className="text-xs text-muted-foreground">Current Status</Label>
                  <Badge
                    className={
                      project.status === 'PENDING_REVIEW'
                        ? 'bg-yellow-400 text-black'
                        : project.status === 'OPEN'
                        ? 'bg-green-500 text-white'
                        : project.status === 'AWARDED'
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-500 text-white'
                    }
                  >
                    {project.status.replace('_', ' ')}
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          {/* Review Section */}
          <div className="space-y-4 pt-4 border-t border-yellow-400/20">
            <div className="space-y-2">
              <Label htmlFor="status">New Status</Label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PENDING_REVIEW">Pending Review</SelectItem>
                  <SelectItem value="OPEN">Open (Approved)</SelectItem>
                  <SelectItem value="CLOSED">Closed (Rejected)</SelectItem>
                  <SelectItem value="AWARDED">Awarded</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Review Notes (Optional)</Label>
              <Textarea
                id="notes"
                placeholder="Add notes about your review decision..."
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                rows={4}
              />
              <p className="text-xs text-muted-foreground">
                {newStatus === 'CLOSED' && 'Note: Rejection reason is required'}
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          
          {project.status === 'PENDING_REVIEW' && (
            <>
              <Button
                variant="outline"
                onClick={handleReject}
                disabled={isSubmitting}
                className="border-red-500 text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
              >
                <XCircle className="h-4 w-4 mr-2" />
                Reject
              </Button>
              <Button
                onClick={handleApprove}
                disabled={isSubmitting}
                className="bg-yellow-400 hover:bg-yellow-500 text-black"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Approve
              </Button>
            </>
          )}
          
          {project.status !== 'PENDING_REVIEW' && (
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="bg-yellow-400 hover:bg-yellow-500 text-black"
            >
              {isSubmitting ? 'Updating...' : 'Update Status'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
