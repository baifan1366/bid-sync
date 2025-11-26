"use client"

import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import {
  formatBudget,
  formatDate,
  calculateDaysUntilDeadline,
  isDeadlineOverdue,
  cn,
} from "@/lib/utils"
import {
  Calendar,
  DollarSign,
  User,
  FileText,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Loader2,
  X,
} from "lucide-react"
import { ProjectDiscoveryService, ProjectDetail } from "@/lib/project-discovery-service"

interface ProjectDetailViewProps {
  projectId: string | null
  isOpen: boolean
  onClose: () => void
  onCreateProposal: (projectId: string) => void
  isCreatingProposal?: boolean
}

export function ProjectDetailView({
  projectId,
  isOpen,
  onClose,
  onCreateProposal,
  isCreatingProposal = false,
}: ProjectDetailViewProps) {
  const [project, setProject] = useState<ProjectDetail | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (projectId && isOpen) {
      loadProjectDetails()
    }
  }, [projectId, isOpen])

  const loadProjectDetails = async () => {
    if (!projectId) return

    setIsLoading(true)
    setError(null)

    try {
      const details = await ProjectDiscoveryService.getProjectDetail(projectId)
      setProject(details)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load project details")
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateProposal = () => {
    if (projectId) {
      onCreateProposal(projectId)
    }
  }

  if (!isOpen) return null

  const hasDeadline = project?.deadline
  const daysUntilDeadline = hasDeadline
    ? calculateDaysUntilDeadline(project.deadline!)
    : null
  const isOverdue = hasDeadline ? isDeadlineOverdue(project.deadline!) : false
  const showDeadlineWarning =
    hasDeadline && daysUntilDeadline !== null && daysUntilDeadline <= 7

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-white dark:bg-black border-yellow-400/20">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-black dark:text-white pr-8">
            {isLoading ? (
              <Skeleton className="h-8 w-3/4" />
            ) : (
              project?.title || "Project Details"
            )}
          </DialogTitle>
          <DialogDescription>
            Complete project information and requirements
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <AlertCircle className="h-5 w-5" />
              <p className="font-medium">{error}</p>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="space-y-6">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : project ? (
          <div className="space-y-6">
            {/* Status and Badges */}
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className="bg-yellow-400 text-black hover:bg-yellow-500">
                Open for Bidding
              </Badge>
              {showDeadlineWarning && (
                <Badge
                  variant="outline"
                  className={cn(
                    "font-medium",
                    isOverdue
                      ? "border-red-600 text-red-600 dark:border-red-400 dark:text-red-400"
                      : "border-yellow-400 text-yellow-400"
                  )}
                >
                  {isOverdue ? "Overdue" : "Urgent"}
                </Badge>
              )}
            </div>

            {/* Key Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Budget */}
              <div className="p-4 rounded-lg border border-yellow-400/20 bg-yellow-400/5">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="h-5 w-5 text-yellow-400" />
                  <span className="text-sm font-medium text-muted-foreground">
                    Budget
                  </span>
                </div>
                <p className="text-2xl font-bold text-yellow-400">
                  {formatBudget(project.budget)}
                </p>
              </div>

              {/* Deadline */}
              <div className="p-4 rounded-lg border border-yellow-400/20 bg-yellow-400/5">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="h-5 w-5 text-yellow-400" />
                  <span className="text-sm font-medium text-muted-foreground">
                    Deadline
                  </span>
                </div>
                <p
                  className={cn(
                    "text-xl font-bold",
                    isOverdue
                      ? "text-red-600 dark:text-red-400"
                      : showDeadlineWarning
                      ? "text-yellow-400"
                      : "text-black dark:text-white"
                  )}
                >
                  {hasDeadline ? formatDate(project.deadline!) : "No deadline"}
                </p>
                {showDeadlineWarning && daysUntilDeadline !== null && (
                  <p
                    className={cn(
                      "text-sm mt-1",
                      isOverdue
                        ? "text-red-600 dark:text-red-400"
                        : "text-yellow-400"
                    )}
                  >
                    {isOverdue
                      ? `${Math.abs(daysUntilDeadline)} days overdue`
                      : `${daysUntilDeadline} days remaining`}
                  </p>
                )}
              </div>
            </div>

            {/* Client Information */}
            {project.client && (
              <div className="p-4 rounded-lg border border-yellow-400/20">
                <div className="flex items-center gap-2 mb-3">
                  <User className="h-5 w-5 text-yellow-400" />
                  <h3 className="font-semibold text-black dark:text-white">
                    Client Information
                  </h3>
                </div>
                <div className="space-y-1 text-sm">
                  {project.client.name && (
                    <p className="text-gray-700 dark:text-gray-300">
                      <span className="font-medium">Name:</span> {project.client.name}
                    </p>
                  )}
                  <p className="text-gray-700 dark:text-gray-300">
                    <span className="font-medium">Email:</span> {project.client.email}
                  </p>
                </div>
              </div>
            )}

            <Separator className="bg-yellow-400/20" />

            {/* Description */}
            <div>
              <h3 className="font-semibold text-lg mb-3 text-black dark:text-white">
                Project Description
              </h3>
              <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                {project.description}
              </p>
            </div>

            {/* Additional Info Requirements */}
            {project.additionalInfoRequirements &&
              project.additionalInfoRequirements.length > 0 && (
                <>
                  <Separator className="bg-yellow-400/20" />
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <FileText className="h-5 w-5 text-yellow-400" />
                      <h3 className="font-semibold text-lg text-black dark:text-white">
                        Additional Requirements
                      </h3>
                      <Badge className="bg-yellow-400 text-black hover:bg-yellow-500">
                        {project.additionalInfoRequirements.length}
                      </Badge>
                    </div>
                    <div className="space-y-3">
                      {project.additionalInfoRequirements
                        .sort((a, b) => a.order - b.order)
                        .map((req) => (
                          <div
                            key={req.id}
                            className="p-3 rounded-lg border border-yellow-400/20 bg-yellow-400/5"
                          >
                            <div className="flex items-start gap-2">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <p className="font-medium text-black dark:text-white">
                                    {req.fieldName}
                                    {req.required && (
                                      <span className="text-red-500 ml-1">*</span>
                                    )}
                                  </p>
                                  <Badge
                                    variant="outline"
                                    className="text-xs border-yellow-400/40"
                                  >
                                    {req.fieldType}
                                  </Badge>
                                </div>
                                {req.helpText && (
                                  <p className="text-sm text-muted-foreground">
                                    {req.helpText}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                </>
              )}

            {/* Project Metadata */}
            <Separator className="bg-yellow-400/20" />
            <div className="text-sm text-muted-foreground">
              <p>Posted on {formatDate(project.createdAt)}</p>
              {project.updatedAt !== project.createdAt && (
                <p>Last updated {formatDate(project.updatedAt)}</p>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4 border-t border-yellow-400/20">
              <Button
                variant="outline"
                onClick={onClose}
                className="flex-1 border-yellow-400/40 hover:bg-yellow-400/10"
              >
                <X className="h-4 w-4 mr-2" />
                Close
              </Button>
              <Button
                onClick={handleCreateProposal}
                disabled={isCreatingProposal}
                className="flex-1 bg-yellow-400 hover:bg-yellow-500 text-black font-semibold"
              >
                {isCreatingProposal ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating Proposal...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Submit Proposal
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
