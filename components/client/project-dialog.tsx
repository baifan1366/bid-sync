"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Project, ProjectStatus } from "@/types/project"
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
import { ScrollArea } from "@/components/ui/scroll-area"
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
  ExternalLink,
  FileText,
  Clock,
  Type,
  Hash,
  CalendarDays,
  Upload,
  List,
  AlignLeft,
  CheckCircle2,
  Circle,
  Users,
} from "lucide-react"

interface ProjectDialogProps {
  project: Project | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

// Status badge color mapping
const statusColors: Record<ProjectStatus, string> = {
  PENDING_REVIEW: "bg-yellow-400 text-black hover:bg-yellow-500",
  OPEN: "bg-green-500 text-white hover:bg-green-600",
  CLOSED: "bg-gray-500 text-white hover:bg-gray-600",
  AWARDED: "bg-yellow-400 text-black hover:bg-yellow-500",
}

const statusLabels: Record<ProjectStatus, string> = {
  PENDING_REVIEW: "Pending Review",
  OPEN: "Open",
  CLOSED: "Closed",
  AWARDED: "Awarded",
}

export function ProjectDialog({ project, open, onOpenChange }: ProjectDialogProps) {
  const router = useRouter()

  if (!project) return null

  // Calculate deadline status
  const hasDeadline = !!project.deadline
  const daysUntilDeadline = hasDeadline ? calculateDaysUntilDeadline(project.deadline!) : null
  const isOverdue = hasDeadline ? isDeadlineOverdue(project.deadline!) : false
  const showDeadlineWarning = hasDeadline && daysUntilDeadline !== null && daysUntilDeadline <= 7

  const handleViewFullPage = () => {
    onOpenChange(false)
    router.push(`/client-projects/${project.id}`)
  }

  const handleViewBids = () => {
    onOpenChange(false)
    router.push(`/client-projects/${project.id}/decision`)
  }
  
  // Check if project can show bids (OPEN or AWARDED status)
  const canViewBids = project.status === 'OPEN' || project.status === 'AWARDED'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0 bg-white dark:bg-black border-yellow-400/20">
        <ScrollArea className="max-h-[90vh]">
          <div className="p-6 space-y-6">
            {/* Header */}
            <DialogHeader>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-2">
                  <DialogTitle className="text-2xl font-bold text-black dark:text-white">
                    {project.title}
                  </DialogTitle>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className={cn("text-xs font-medium", statusColors[project.status])}>
                      {statusLabels[project.status]}
                    </Badge>
                    {showDeadlineWarning && (
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs",
                          isOverdue
                            ? "border-red-600 text-red-600 dark:border-red-400 dark:text-red-400"
                            : "border-yellow-400 text-yellow-400"
                        )}
                      >
                        {isOverdue ? (
                          <>
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Overdue
                          </>
                        ) : (
                          <>
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Urgent
                          </>
                        )}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </DialogHeader>

            <Separator className="bg-yellow-400/20" />

            {/* Key Information */}
            <div className="grid gap-4 sm:grid-cols-2">
              {/* Budget */}
              <div className="flex items-start gap-3 p-4 rounded-lg border border-yellow-400/20 bg-yellow-400/5">
                <DollarSign className="h-5 w-5 text-yellow-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">Budget</p>
                  <p className="text-lg font-bold text-yellow-400">{formatBudget(project.budget)}</p>
                </div>
              </div>

              {/* Deadline */}
              <div className="flex items-start gap-3 p-4 rounded-lg border border-yellow-400/20">
                <Calendar className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-muted-foreground">Deadline</p>
                  <p
                    className={cn(
                      "text-lg font-bold",
                      isOverdue && "text-red-600 dark:text-red-400",
                      !isOverdue && showDeadlineWarning && "text-yellow-400"
                    )}
                  >
                    {hasDeadline ? formatDate(project.deadline!) : "No deadline"}
                  </p>
                  {showDeadlineWarning && daysUntilDeadline !== null && (
                    <p
                      className={cn(
                        "text-xs mt-1",
                        isOverdue ? "text-red-600 dark:text-red-400" : "text-yellow-400"
                      )}
                    >
                      {isOverdue
                        ? `${Math.abs(daysUntilDeadline)} days overdue`
                        : `${daysUntilDeadline} days left`}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-yellow-400" />
                <h3 className="font-semibold text-black dark:text-white">Description</h3>
              </div>
              <DialogDescription className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                {project.description}
              </DialogDescription>
            </div>

            {/* Additional Information Requirements */}
            {(project.additionalInfoRequirements && project.additionalInfoRequirements.length > 0) && (
              <>
                <Separator className="bg-yellow-400/20" />
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-yellow-400" />
                    <h3 className="font-semibold text-black dark:text-white">
                      Additional Information Requirements
                    </h3>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Bidders must provide the following information when submitting proposals
                  </p>
                  <div className="space-y-2.5">
                    {(project.additionalInfoRequirements || [])
                      .sort((a, b) => a.order - b.order)
                      .map((req, index) => {
                        // Parse options if it's a string
                        const rawOptions = req.options as string | string[] | undefined
                        const options = typeof rawOptions === 'string' 
                          ? rawOptions.split(',').map((opt: string) => opt.trim()).filter(Boolean)
                          : (rawOptions as string[]) || []
                        
                        // Get icon based on field type
                        const getFieldIcon = () => {
                          const iconClass = "h-3.5 w-3.5 text-yellow-400 shrink-0"
                          switch (req.fieldType) {
                            case 'text': return <Type className={iconClass} />
                            case 'textarea': return <AlignLeft className={iconClass} />
                            case 'number': return <Hash className={iconClass} />
                            case 'date': return <CalendarDays className={iconClass} />
                            case 'file': return <Upload className={iconClass} />
                            case 'select': return <List className={iconClass} />
                            default: return <FileText className={iconClass} />
                          }
                        }
                        
                        return (
                          <div
                            key={req.id || index}
                            className="group p-3 rounded-lg border border-yellow-400/20 bg-yellow-400/5 hover:border-yellow-400/40 hover:bg-yellow-400/10 transition-all"
                          >
                            <div className="flex items-start gap-2.5">
                              {/* Icon */}
                              <div className="mt-0.5">
                                {getFieldIcon()}
                              </div>
                              
                              {/* Content */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2 mb-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-sm font-medium text-black dark:text-white">
                                      {index + 1}. {req.fieldName}
                                    </span>
                                    {req.required ? (
                                      <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-red-600 text-white">
                                        <CheckCircle2 className="h-3 w-3" />
                                        Required
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-gray-500 text-white">
                                        <Circle className="h-3 w-3" />
                                        Optional
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-xs px-2 py-0.5 rounded bg-yellow-400/20 text-yellow-400 capitalize shrink-0 font-medium">
                                    {req.fieldType}
                                  </span>
                                </div>
                                
                                {req.helpText && (
                                  <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                                    💡 {req.helpText}
                                  </p>
                                )}
                                
                                {req.fieldType === 'select' && options.length > 0 && (
                                  <div className="mt-2 space-y-1">
                                    <p className="text-xs font-medium text-muted-foreground">Available options:</p>
                                    <div className="flex flex-wrap gap-1.5">
                                      {options.map((option: string, idx: number) => (
                                        <span
                                          key={idx}
                                          className="text-xs px-2 py-1 rounded-md border border-yellow-400/30 bg-white dark:bg-black text-black dark:text-white font-medium hover:border-yellow-400/50 hover:bg-yellow-400/5 transition-colors"
                                        >
                                          {option}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                  </div>
                  
                  {/* Summary */}
                  <div className="mt-3 p-2.5 rounded-lg bg-yellow-400/10 border border-yellow-400/30">
                    <p className="text-xs text-muted-foreground">
                      <span className="font-semibold text-black dark:text-white">
                        {(project.additionalInfoRequirements || []).filter(r => r.required).length}
                      </span> required field(s) • 
                      <span className="font-semibold text-black dark:text-white ml-1">
                        {(project.additionalInfoRequirements || []).length}
                      </span> total field(s)
                    </p>
                  </div>
                </div>
              </>
            )}

            {/* Timeline */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-yellow-400" />
                <h3 className="font-semibold text-black dark:text-white">Timeline</h3>
              </div>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>Created: {formatDate(project.createdAt)}</p>
                {project.updatedAt && (
                  <p>Last updated: {formatDate(project.updatedAt)}</p>
                )}
              </div>
            </div>

            <Separator className="bg-yellow-400/20" />

            {/* Actions */}
            <div className="flex flex-col gap-3">
              {/* Primary action - View Bids (if applicable) */}
              {canViewBids && (
                <Button
                  onClick={handleViewBids}
                  className="w-full bg-yellow-400 hover:bg-yellow-500 text-black font-semibold"
                >
                  <Users className="h-4 w-4 mr-2" />
                  View Bids & Make Decision
                </Button>
              )}
              
              {/* Secondary actions */}
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  onClick={handleViewFullPage}
                  variant="outline"
                  className="flex-1 border-yellow-400/20 hover:bg-yellow-400/10"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View Full Project Page
                </Button>
                <Button
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  className="flex-1 border-yellow-400/20 hover:bg-yellow-400/10"
                >
                  Close
                </Button>
              </div>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
