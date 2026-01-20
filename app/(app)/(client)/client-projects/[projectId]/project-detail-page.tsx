"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { useGraphQLQuery } from "@/hooks/use-graphql"
import { useUser } from "@/hooks/use-user"
import { useToast } from "@/components/ui/use-toast"
import { GET_PROJECT, GET_PROPOSALS_FOR_PROJECT } from "@/lib/graphql/queries"
import { UPDATE_PROJECT_STATUS } from "@/lib/graphql/mutations"
import { Project, ProjectStatus, AdditionalInfoRequirement } from "@/types/project"
import { ProjectWithProposals } from "@/lib/graphql/types"
import { EditProjectDialog } from "@/components/client/edit-project-dialog"
import { ScoringTemplateManager } from "@/components/client/scoring-template-manager"
import { ProposalRankingsList } from "@/components/client/proposal-rankings-list"
import { ScoringComparisonView } from "@/components/client/scoring-comparison-view"
import { ProposalsList } from "@/components/client/proposals-list"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
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
  ArrowLeft,
  FileText,
  Clock,
  User,
  Type,
  Hash,
  CalendarDays,
  Upload,
  List,
  AlignLeft,
  CheckCircle2,
  Edit,
  Settings,
  TrendingUp,
  GitCompare,
} from "lucide-react"

interface ProjectResponse {
  project: Project
}

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

export function ProjectDetailPage() {
  const params = useParams()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { user } = useUser()
  const { toast } = useToast()
  const projectId = params.projectId as string
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isScoringDialogOpen, setIsScoringDialogOpen] = useState(false)
  const [isRankingsDialogOpen, setIsRankingsDialogOpen] = useState(false)
  const [isComparisonDialogOpen, setIsComparisonDialogOpen] = useState(false)
  const [selectedProposals, setSelectedProposals] = useState<string[]>([])
  const [showProposals, setShowProposals] = useState(false)
  const [showCloseConfirm, setShowCloseConfirm] = useState(false)
  const [showReopenConfirm, setShowReopenConfirm] = useState(false)

  const { data, isLoading } = useGraphQLQuery<ProjectResponse>(
    ["project", projectId],
    GET_PROJECT,
    { id: projectId },
    { enabled: !!projectId }
  )

  const { data: proposalsData, isLoading: isLoadingProposals } = useGraphQLQuery<{ projectWithProposals: ProjectWithProposals }>(
    ["project-proposals", projectId],
    GET_PROPOSALS_FOR_PROJECT,
    { projectId },
    { enabled: !!projectId }
  )

  const project = data?.project
  const proposals = proposalsData?.projectWithProposals?.proposals || []
  const hasProposals = proposals.length > 0

  const handleCloseProject = async () => {
    if (!project) return
    
    setShowCloseConfirm(false)
    setIsUpdatingStatus(true)
    try {
      const response = await fetch('/api/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: UPDATE_PROJECT_STATUS,
          variables: {
            projectId: project.id,
            status: 'CLOSED',
          },
        }),
      })

      const result = await response.json()

      if (result.errors) {
        throw new Error(result.errors[0]?.message || 'Failed to close project')
      }

      // Invalidate queries to refetch
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      
      toast({
        title: "Project closed",
        description: "Project closed successfully",
      })
    } catch (error) {
      console.error('Error closing project:', error)
      toast({
        title: "Failed to close project",
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: "destructive",
      })
    } finally {
      setIsUpdatingStatus(false)
    }
  }

  const handleReopenProject = async () => {
    if (!project) return
    
    setShowReopenConfirm(false)
    setIsUpdatingStatus(true)
    try {
      const response = await fetch('/api/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: UPDATE_PROJECT_STATUS,
          variables: {
            projectId: project.id,
            status: 'OPEN',
          },
        }),
      })

      const result = await response.json()

      if (result.errors) {
        throw new Error(result.errors[0]?.message || 'Failed to reopen project')
      }

      // Invalidate queries to refetch
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      
      toast({
        title: "Project reopened",
        description: "Project reopened successfully",
      })
    } catch (error) {
      console.error('Error reopening project:', error)
      toast({
        title: "Failed to reopen project",
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: "destructive",
      })
    } finally {
      setIsUpdatingStatus(false)
    }
  }

  if (isLoading) {
    return (
      <div className="container mx-auto p-4 sm:p-6 space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  if (!project) {
    return (
      <div className="container mx-auto p-4 sm:p-6">
        <Card className="border-yellow-400/20">
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">Project not found</p>
            <Button
              onClick={() => router.push(user?.user_metadata?.role === 'client' ? '/projects' : '/')}
              className="mt-4 bg-yellow-400 hover:bg-yellow-500 text-black"
            >
              {user?.user_metadata?.role === 'client' ? 'Back to Projects' : 'Back to Home'}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const hasDeadline = !!project.deadline
  const daysUntilDeadline = hasDeadline ? calculateDaysUntilDeadline(project.deadline!) : null
  const isOverdue = hasDeadline ? isDeadlineOverdue(project.deadline!) : false
  const showDeadlineWarning = hasDeadline && daysUntilDeadline !== null && daysUntilDeadline <= 7

  // Determine back navigation based on user role
  const handleBack = () => {
    if (user?.user_metadata?.role === 'client') {
      router.push('/projects')
    } else {
      router.push('/')
    }
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6">
      {/* Back Button */}
      <Button
        variant="ghost"
        onClick={handleBack}
        className="hover:bg-yellow-400/10"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        {user?.user_metadata?.role === 'client' ? 'Back to Projects' : 'Back to Home'}
      </Button>

      {/* Header Card */}
      <Card className="border-yellow-400/20 bg-white dark:bg-black">
        <CardHeader>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex-1 space-y-3">
              <CardTitle className="text-2xl sm:text-3xl font-bold text-black dark:text-white">
                {project.title}
              </CardTitle>
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
            
            {/* Project Actions */}
            <div className="flex gap-2 flex-wrap">
              {/* Create Proposal button - for bidding leads */}
              {user?.user_metadata?.role === 'bidding_lead' && (
                <Button
                  onClick={() => router.push(`/lead-dashboard?createProposal=${projectId}`)}
                  className="bg-yellow-400 hover:bg-yellow-500 text-black font-semibold"
                  disabled={project.status !== 'OPEN'}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  {project.status === 'OPEN' ? 'Create Proposal' : `Project ${project.status}`}
                </Button>
              )}
              
              {/* Edit button - only for PENDING_REVIEW projects and project owner */}
              {user?.id === project.clientId && project.status === 'PENDING_REVIEW' && (
                <Button
                  onClick={() => setIsEditDialogOpen(true)}
                  variant="outline"
                  className="border-yellow-400/40 hover:bg-yellow-400/10"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Project
                </Button>
              )}
              
              {/* Status management buttons - only for project owner */}
              {user?.id === project.clientId && (
                <>
                  {project.status === 'CLOSED' ? (
                    <Button
                      onClick={() => setShowReopenConfirm(true)}
                      disabled={isUpdatingStatus}
                      variant="outline"
                      className="border-yellow-400/40 hover:bg-yellow-400/10"
                    >
                      {isUpdatingStatus ? "Reopening..." : "Reopen Project"}
                    </Button>
                  ) : project.status !== 'AWARDED' && project.status !== 'PENDING_REVIEW' && (
                    <Button
                      onClick={() => setShowCloseConfirm(true)}
                      disabled={isUpdatingStatus}
                      variant="outline"
                      className="border-red-600/40 hover:bg-red-600/10 text-red-600 dark:text-red-400"
                    >
                      {isUpdatingStatus ? "Closing..." : "Close Project"}
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Key Metrics */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-start gap-3 p-4 rounded-lg border border-yellow-400/20 bg-yellow-400/5">
              <DollarSign className="h-5 w-5 text-yellow-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground">Budget</p>
                <p className="text-xl font-bold text-yellow-400">{formatBudget(project.budget)}</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 rounded-lg border border-yellow-400/20">
              <Calendar className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-muted-foreground">Deadline</p>
                <p
                  className={cn(
                    "text-xl font-bold",
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

          <Separator className="bg-yellow-400/20" />

          {/* Description */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-yellow-400" />
              <h3 className="text-lg font-semibold text-black dark:text-white">Description</h3>
            </div>
            <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
              {project.description}
            </p>
          </div>

          <Separator className="bg-yellow-400/20" />

          {/* Additional Information Requirements */}
          {(project.additionalInfoRequirements && project.additionalInfoRequirements.length > 0) && (
            <>
              <div className="space-y-5">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-yellow-400/20">
                    <FileText className="h-5 w-5 text-yellow-400" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-black dark:text-white">
                      Additional Information Requirements
                    </h3>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Bidders must provide the following information when submitting proposals
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 p-3 rounded-lg bg-yellow-400/10 border border-yellow-400/30">
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-red-600 animate-pulse" />
                    <span className="text-sm font-semibold text-red-600 dark:text-red-400">
                      {(project.additionalInfoRequirements || []).filter((r: AdditionalInfoRequirement) => r.required).length} Required
                    </span>
                  </div>
                  <div className="h-4 w-px bg-yellow-400/30" />
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-gray-500" />
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                      {(project.additionalInfoRequirements || []).filter((r: AdditionalInfoRequirement) => !r.required).length} Optional
                    </span>
                  </div>
                </div>
                
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {(project.additionalInfoRequirements || [])
                    .sort((a: AdditionalInfoRequirement, b: AdditionalInfoRequirement) => a.order - b.order)
                    .map((req: AdditionalInfoRequirement, index: number) => {
                      // Parse options if it's a string
                      const rawOptions = req.options as string | string[] | undefined
                      const options = typeof rawOptions === 'string' 
                        ? rawOptions.split(',').map((opt: string) => opt.trim()).filter(Boolean)
                        : (rawOptions as string[]) || []
                      
                      // Get icon based on field type
                      const getFieldIcon = () => {
                        switch (req.fieldType) {
                          case 'text': return <Type className="h-4 w-4 text-yellow-400" />
                          case 'textarea': return <AlignLeft className="h-4 w-4 text-yellow-400" />
                          case 'number': return <Hash className="h-4 w-4 text-yellow-400" />
                          case 'date': return <CalendarDays className="h-4 w-4 text-yellow-400" />
                          case 'file': return <Upload className="h-4 w-4 text-yellow-400" />
                          case 'select': return <List className="h-4 w-4 text-yellow-400" />
                          default: return <FileText className="h-4 w-4 text-yellow-400" />
                        }
                      }
                      
                      // Get preview UI based on field type
                      const getFieldPreview = () => {
                        switch (req.fieldType) {
                          case 'text':
                            return (
                              <div className="p-3 rounded-lg border-2 border-yellow-400/30 bg-gray-50 dark:bg-gray-900/50 hover:border-yellow-400/50 transition-colors">
                                <div className="h-4 w-full bg-gray-300 dark:bg-gray-700 rounded animate-pulse" />
                              </div>
                            )
                          case 'textarea':
                            return (
                              <div className="p-3 rounded-lg border-2 border-yellow-400/30 bg-gray-50 dark:bg-gray-900/50 hover:border-yellow-400/50 transition-colors space-y-2">
                                <div className="h-3 w-full bg-gray-300 dark:bg-gray-700 rounded animate-pulse" />
                                <div className="h-3 w-11/12 bg-gray-300 dark:bg-gray-700 rounded animate-pulse" />
                                <div className="h-3 w-4/5 bg-gray-300 dark:bg-gray-700 rounded animate-pulse" />
                                <div className="h-3 w-3/5 bg-gray-300 dark:bg-gray-700 rounded animate-pulse" />
                              </div>
                            )
                          case 'number':
                            return (
                              <div className="p-3 rounded-lg border-2 border-yellow-400/30 bg-gray-50 dark:bg-gray-900/50 hover:border-yellow-400/50 transition-colors flex items-center gap-2">
                                <Hash className="h-4 w-4 text-yellow-400" />
                                <div className="h-4 w-28 bg-gray-300 dark:bg-gray-700 rounded animate-pulse" />
                              </div>
                            )
                          case 'date':
                            return (
                              <div className="p-3 rounded-lg border-2 border-yellow-400/30 bg-gray-50 dark:bg-gray-900/50 hover:border-yellow-400/50 transition-colors flex items-center gap-3">
                                <CalendarDays className="h-5 w-5 text-yellow-400" />
                                <div className="h-4 w-36 bg-gray-300 dark:bg-gray-700 rounded animate-pulse" />
                              </div>
                            )
                          case 'file':
                            return (
                              <div className="p-6 rounded-lg border-2 border-dashed border-yellow-400/40 bg-yellow-400/5 hover:bg-yellow-400/10 hover:border-yellow-400/60 transition-all cursor-pointer group">
                                <div className="flex flex-col items-center gap-2">
                                  <div className="p-3 rounded-full bg-yellow-400/20 group-hover:bg-yellow-400/30 transition-colors">
                                    <Upload className="h-5 w-5 text-yellow-400" />
                                  </div>
                                  <span className="text-xs font-medium text-muted-foreground">Click to upload file</span>
                                  <span className="text-xs text-muted-foreground/70">or drag and drop</span>
                                </div>
                              </div>
                            )
                          case 'select':
                            return (
                              <div className="space-y-3">
                                <div className="p-3 rounded-lg border-2 border-yellow-400/30 bg-gray-50 dark:bg-gray-900/50 hover:border-yellow-400/50 transition-colors cursor-pointer">
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm text-muted-foreground font-medium">Select an option...</span>
                                    <svg className="h-4 w-4 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                  </div>
                                </div>
                                {options.length > 0 && (
                                  <div className="p-3 rounded-lg bg-yellow-400/10 border border-yellow-400/30">
                                    <p className="text-xs font-bold text-yellow-400 mb-2.5 uppercase tracking-wide">
                                      {options.length} Available Option{options.length > 1 ? 's' : ''}
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                      {options.map((option: string, idx: number) => (
                                        <span
                                          key={idx}
                                          className="text-xs px-3 py-1.5 rounded-md bg-white dark:bg-black text-black dark:text-white border-2 border-yellow-400/40 font-medium hover:border-yellow-400 hover:shadow-md hover:scale-105 transition-all cursor-pointer"
                                        >
                                          {option}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )
                          default:
                            return null
                        }
                      }
                      
                      return (
                        <div
                          key={req.id || index}
                          className="group relative p-5 rounded-xl border-2 border-yellow-400/20 bg-white dark:bg-black hover:border-yellow-400/50 hover:shadow-lg hover:shadow-yellow-400/10 transition-all duration-200"
                        >
                          {/* Required indicator stripe */}
                          {req.required && (
                            <div className="absolute top-0 left-0 right-0 h-1 bg-linear-to-r from-red-600 to-red-500 rounded-t-xl" />
                          )}
                          
                          {/* Header */}
                          <div className="space-y-3 mb-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-3 flex-1">
                                <div className="p-2 rounded-lg bg-yellow-400/20 group-hover:bg-yellow-400 group-hover:shadow-md transition-all shrink-0">
                                  {getFieldIcon()}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-bold text-black dark:text-white text-base leading-tight mb-2">
                                    {req.fieldName}
                                  </h4>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs px-2.5 py-1 rounded-md bg-yellow-400 text-black capitalize font-bold shadow-sm">
                                      {req.fieldType}
                                    </span>
                                    {req.required ? (
                                      <Badge className="bg-red-600 text-white text-xs font-bold shadow-sm">
                                        Required
                                      </Badge>
                                    ) : (
                                      <Badge variant="outline" className="text-xs font-medium border-gray-400 dark:border-gray-600">
                                        Optional
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                            
                            {/* Help Text */}
                            {req.helpText && (
                              <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200/60 dark:border-blue-800/60">
                                <div className="flex gap-2">
                                  <span className="text-sm shrink-0">💡</span>
                                  <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
                                    {req.helpText}
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>
                          
                          {/* Field Preview */}
                          <div className="space-y-2.5">
                            <div className="flex items-center gap-2">
                              <div className="h-px flex-1 bg-yellow-400/20" />
                              <p className="text-xs font-bold text-yellow-400 uppercase tracking-wider">
                                Preview
                              </p>
                              <div className="h-px flex-1 bg-yellow-400/20" />
                            </div>
                            {getFieldPreview()}
                          </div>
                        </div>
                      )
                    })}
                </div>
              </div>
              <Separator className="bg-yellow-400/20" />
            </>
          )}

          {/* Timeline */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-yellow-400" />
              <h3 className="text-lg font-semibold text-black dark:text-white">Timeline</h3>
            </div>
            <div className="text-sm text-muted-foreground space-y-1">
              <p>Created: {formatDate(project.createdAt)}</p>
              {project.updatedAt && <p>Last updated: {formatDate(project.updatedAt)}</p>}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Scoring Actions Card */}
      {hasProposals && (project.status === 'OPEN' || project.status === 'CLOSED' || project.status === 'AWARDED') ? (
        <Card className="border-yellow-400/20 bg-white dark:bg-black">
          <CardHeader>
            <CardTitle className="text-xl font-bold text-black dark:text-white">
              Proposal Evaluation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Use the scoring system to systematically evaluate and compare proposals for this project.
            </p>
            
            <div className="flex flex-wrap gap-3">
              {/* Configure Scoring Button */}
              <Button
                onClick={() => setIsScoringDialogOpen(true)}
                className="bg-yellow-400 hover:bg-yellow-500 text-black"
              >
                <Settings className="h-4 w-4 mr-2" />
                Configure Scoring
              </Button>

              {/* View Rankings Button */}
              <Button
                onClick={() => setIsRankingsDialogOpen(true)}
                variant="outline"
                className="border-yellow-400/40 hover:bg-yellow-400/10"
                disabled={proposals.length === 0}
              >
                <TrendingUp className="h-4 w-4 mr-2" />
                View Rankings
              </Button>

              {/* Compare Proposals Button */}
              <Button
                onClick={() => setShowProposals(!showProposals)}
                variant="outline"
                className="border-yellow-400/40 hover:bg-yellow-400/10"
                disabled={proposals.length < 2}
              >
                <GitCompare className="h-4 w-4 mr-2" />
                {showProposals ? 'Hide Proposals' : 'Compare Proposals'}
              </Button>
            </div>

            {/* Show comparison button when proposals are selected */}
            {selectedProposals.length >= 2 && (
              <div className="p-4 rounded-lg bg-yellow-400/10 border border-yellow-400/30">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-yellow-400 text-black">
                      {selectedProposals.length} selected
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {selectedProposals.length === 4 ? 'Maximum reached' : `Select up to ${4 - selectedProposals.length} more`}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => setSelectedProposals([])}
                      variant="outline"
                      size="sm"
                      className="border-yellow-400/40 hover:bg-yellow-400/10"
                    >
                      Clear Selection
                    </Button>
                    <Button
                      onClick={() => setIsComparisonDialogOpen(true)}
                      size="sm"
                      className="bg-yellow-400 hover:bg-yellow-500 text-black"
                    >
                      Compare Selected
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      {/* Proposals List for Selection */}
      {showProposals && (
        <Card className="border-yellow-400/20 bg-white dark:bg-black">
          <CardHeader>
            <CardTitle className="text-xl font-bold text-black dark:text-white">
              Select Proposals to Compare
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ProposalsList
              proposals={proposals}
              isLoading={isLoadingProposals}
              selectedProposals={selectedProposals}
              onProposalSelect={(id) => {
                setSelectedProposals((prev) => {
                  if (prev.includes(id)) {
                    return prev.filter((p) => p !== id)
                  }
                  if (prev.length >= 4) {
                    return prev
                  }
                  return [...prev, id]
                })
              }}
              onProposalClick={(id) => {
                router.push(`/client-projects/${projectId}/proposals/${id}`)
              }}
            />
          </CardContent>
        </Card>
      )}
      
      {/* Edit Project Dialog */}
      <EditProjectDialog
        project={project}
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
      />

      {/* Scoring Template Manager Dialog */}
      <ScoringTemplateManager 
        projectId={projectId}
        open={isScoringDialogOpen}
        onOpenChange={setIsScoringDialogOpen}
      />

      {/* Rankings Dialog */}
      <Dialog open={isRankingsDialogOpen} onOpenChange={setIsRankingsDialogOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Proposal Rankings</DialogTitle>
          </DialogHeader>
          <ProposalRankingsList projectId={projectId} />
        </DialogContent>
      </Dialog>

      {/* Comparison Dialog */}
      <Dialog open={isComparisonDialogOpen} onOpenChange={setIsComparisonDialogOpen}>
        <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Compare Proposals</DialogTitle>
          </DialogHeader>
          <ScoringComparisonView 
            projectId={projectId} 
            proposalIds={selectedProposals}
          />
        </DialogContent>
      </Dialog>

      {/* Close Project Confirmation Dialog */}
      <AlertDialog open={showCloseConfirm} onOpenChange={setShowCloseConfirm}>
        <AlertDialogContent className="border-yellow-400/20">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-black dark:text-white">Close Project</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to close this project? This will prevent new proposals from being submitted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-yellow-400/40 hover:bg-yellow-400/10">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCloseProject}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Close Project
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reopen Project Confirmation Dialog */}
      <AlertDialog open={showReopenConfirm} onOpenChange={setShowReopenConfirm}>
        <AlertDialogContent className="border-yellow-400/20">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-black dark:text-white">Reopen Project</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to reopen this project? This will allow new proposals to be submitted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-yellow-400/40 hover:bg-yellow-400/10">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReopenProject}
              className="bg-yellow-400 hover:bg-yellow-500 text-black"
            >
              Reopen Project
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
