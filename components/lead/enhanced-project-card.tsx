"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
  AlertTriangle,
  AlertCircle,
  FileText,
  CheckCircle2,
  Loader2,
  Eye,
} from "lucide-react"
import type { Project } from "@/types/project"

interface EnhancedProjectCardProps {
  project: Project
  onCreateProposal: (projectId: string) => void
  onViewDetails: (projectId: string) => void
  isCreatingProposal?: boolean
}

export function EnhancedProjectCard({
  project,
  onCreateProposal,
  onViewDetails,
  isCreatingProposal = false,
}: EnhancedProjectCardProps) {
  const hasDeadline = !!project.deadline
  const daysUntilDeadline = hasDeadline
    ? calculateDaysUntilDeadline(project.deadline!)
    : null
  const isOverdue = hasDeadline ? isDeadlineOverdue(project.deadline!) : false
  const showDeadlineWarning =
    hasDeadline && daysUntilDeadline !== null && daysUntilDeadline <= 7

  const additionalInfoCount = project.additionalInfoRequirements?.length || 0
  const requiredInfoCount =
    project.additionalInfoRequirements?.filter((req) => req.required).length || 0

  return (
    <Card
      className={cn(
        "transition-all duration-200 hover:shadow-lg hover:scale-[1.02]",
        "border-yellow-400/20 hover:border-yellow-400/40",
        "bg-white dark:bg-black"
      )}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3 mb-3">
          <CardTitle className="text-lg font-bold line-clamp-2 flex-1 text-black dark:text-white">
            {project.title}
          </CardTitle>
          {showDeadlineWarning && (
            <div className="shrink-0">
              {isOverdue ? (
                <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-yellow-400" />
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge className="bg-yellow-400 text-black hover:bg-yellow-500 text-xs">
            Open for Bidding
          </Badge>
          {showDeadlineWarning && (
            <Badge
              variant="outline"
              className={cn(
                "text-xs font-medium",
                isOverdue
                  ? "border-red-600 text-red-600 dark:border-red-400 dark:text-red-400"
                  : "border-yellow-400 text-yellow-400"
              )}
            >
              {isOverdue ? "Overdue" : "Urgent"}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Description */}
        <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-3">
          {project.description}
        </p>

        {/* Budget and Deadline */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <DollarSign className="h-4 w-4 text-yellow-400 shrink-0" />
            <span className="font-semibold text-yellow-400">
              {formatBudget(project.budget)}
            </span>
          </div>

          <div className="flex items-center gap-2 text-sm flex-wrap">
            <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
            <span
              className={cn(
                "font-medium",
                isOverdue && "text-red-600 dark:text-red-400",
                !isOverdue && showDeadlineWarning && "text-yellow-400"
              )}
            >
              {hasDeadline ? formatDate(project.deadline!) : "No deadline"}
            </span>
            {showDeadlineWarning && daysUntilDeadline !== null && (
              <span
                className={cn(
                  "text-xs",
                  isOverdue
                    ? "text-red-600 dark:text-red-400"
                    : "text-yellow-400"
                )}
              >
                {isOverdue
                  ? `(${Math.abs(daysUntilDeadline)} days overdue)`
                  : `(${daysUntilDeadline} days left)`}
              </span>
            )}
          </div>
        </div>

        {/* Additional Info Requirements */}
        {additionalInfoCount > 0 && (
          <div className="p-3 rounded-lg bg-yellow-400/10 border border-yellow-400/30">
            <div className="flex items-start gap-2">
              <FileText className="h-4 w-4 text-yellow-400 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-yellow-400">
                  Additional Requirements
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {additionalInfoCount} field{additionalInfoCount !== 1 ? "s" : ""}{" "}
                  {requiredInfoCount > 0 && (
                    <span className="font-medium">
                      ({requiredInfoCount} required)
                    </span>
                  )}
                </p>
                {project.additionalInfoRequirements && (
                  <div className="mt-2 space-y-1">
                    {project.additionalInfoRequirements.slice(0, 2).map((req) => (
                      <div key={req.id} className="flex items-center gap-1.5">
                        <div className="h-1 w-1 rounded-full bg-yellow-400" />
                        <span className="text-xs text-gray-700 dark:text-gray-300">
                          {req.fieldName}
                          {req.required && (
                            <span className="text-red-500 ml-0.5">*</span>
                          )}
                        </span>
                      </div>
                    ))}
                    {additionalInfoCount > 2 && (
                      <p className="text-xs text-muted-foreground pl-2.5">
                        +{additionalInfoCount - 2} more
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => onViewDetails(project.id)}
            className="flex-1 border-yellow-400/40 hover:bg-yellow-400/10"
          >
            <Eye className="h-4 w-4 mr-2" />
            View Details
          </Button>
          <Button
            onClick={() => onCreateProposal(project.id)}
            disabled={isCreatingProposal}
            className="flex-1 bg-yellow-400 hover:bg-yellow-500 text-black font-semibold"
          >
            {isCreatingProposal ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Submit Proposal
              </>
            )}
          </Button>
        </div>

        {/* Created date */}
        <div className="pt-2 border-t border-yellow-400/20">
          <p className="text-xs text-muted-foreground">
            Posted {formatDate(project.createdAt)}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
