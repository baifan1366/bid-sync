"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { useGraphQLQuery } from "@/hooks/use-graphql"
import { LIST_OPEN_PROJECTS } from "@/lib/graphql/queries"
import { CREATE_PROPOSAL } from "@/lib/graphql/mutations"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/components/ui/use-toast"
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
  Briefcase,
  FileText,
  Loader2,
  CheckCircle2,
} from "lucide-react"

interface Project {
  id: string
  title: string
  description: string
  status: string
  budget: number
  deadline: string | null
  clientId: string
  createdAt: string
  additionalInfoRequirements: any[]
}

interface OpenProjectsResponse {
  openProjects: Project[]
}

export function LeadDashboardContent() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [creatingProposalId, setCreatingProposalId] = useState<string | null>(null)

  const { data, isLoading, error } = useGraphQLQuery<OpenProjectsResponse>(
    ["open-projects"],
    LIST_OPEN_PROJECTS,
    {},
    { staleTime: 2 * 60 * 1000 }
  )

  const projects = data?.openProjects || []

  const handleCreateProposal = async (projectId: string) => {
    setCreatingProposalId(projectId)
    
    try {
      const response = await fetch('/api/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: CREATE_PROPOSAL,
          variables: { projectId },
        }),
      })

      const result = await response.json()

      if (result.errors) {
        throw new Error(result.errors[0]?.message || 'Failed to create proposal')
      }

      const proposalId = result.data?.createProposal?.id

      if (proposalId) {
        // Invalidate queries
        queryClient.invalidateQueries({ queryKey: ['lead-proposals'] })
        
        // Navigate to workspace with the new proposal
        router.push(`/workspace?proposal=${proposalId}`)
      }
    } catch (error) {
      console.error('Error creating proposal:', error)
      toast({
        title: "Failed to create proposal",
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: "destructive",
      })
    } finally {
      setCreatingProposalId(null)
    }
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-[1800px]">
        <Skeleton className="h-10 w-64 mb-6" />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-[1800px]">
        <Card className="p-6 border-yellow-400/20 bg-yellow-50 dark:bg-yellow-950/10">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-yellow-400" />
            <div>
              <h3 className="font-semibold text-black dark:text-white">
                Unable to Load Projects
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                We're having trouble loading open projects. Please try refreshing the page.
              </p>
            </div>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-[1800px]">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-black dark:text-white mb-2">
          Lead Dashboard
        </h1>
        <p className="text-muted-foreground">
          Browse open projects and submit proposals
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3 mb-8">
        <Card className="border-yellow-400/20 bg-white dark:bg-black">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-yellow-400/20">
                <Briefcase className="h-6 w-6 text-yellow-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Open Projects</p>
                <p className="text-2xl font-bold text-black dark:text-white">
                  {projects.length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-yellow-400/20 bg-white dark:bg-black">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-yellow-400/20">
                <FileText className="h-6 w-6 text-yellow-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Budget</p>
                <p className="text-2xl font-bold text-yellow-400">
                  {formatBudget(
                    projects.reduce((sum, p) => sum + (p.budget || 0), 0)
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-yellow-400/20 bg-white dark:bg-black">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-yellow-400/20">
                <AlertTriangle className="h-6 w-6 text-yellow-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Urgent Projects</p>
                <p className="text-2xl font-bold text-black dark:text-white">
                  {
                    projects.filter(
                      (p) =>
                        p.deadline &&
                        calculateDaysUntilDeadline(p.deadline) <= 7
                    ).length
                  }
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Projects Grid */}
      {projects.length === 0 ? (
        <Card className="p-12 border-yellow-400/20 text-center">
          <Briefcase className="h-12 w-12 text-yellow-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-black dark:text-white mb-2">
            No Open Projects
          </h3>
          <p className="text-muted-foreground">
            There are currently no open projects available for bidding.
          </p>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => {
            const hasDeadline = !!project.deadline
            const daysUntilDeadline = hasDeadline
              ? calculateDaysUntilDeadline(project.deadline!)
              : null
            const isOverdue = hasDeadline ? isDeadlineOverdue(project.deadline!) : false
            const showDeadlineWarning =
              hasDeadline && daysUntilDeadline !== null && daysUntilDeadline <= 7
            const isCreating = creatingProposalId === project.id

            return (
              <Card
                key={project.id}
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
                  {showDeadlineWarning && (
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-xs font-medium w-fit",
                        isOverdue
                          ? "border-red-600 text-red-600 dark:border-red-400 dark:text-red-400"
                          : "border-yellow-400 text-yellow-400"
                      )}
                    >
                      {isOverdue ? "Overdue" : "Urgent"}
                    </Badge>
                  )}
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

                  {/* Additional Info Requirements Badge */}
                  {project.additionalInfoRequirements &&
                    project.additionalInfoRequirements.length > 0 && (
                      <div className="flex items-center gap-2 p-2 rounded-lg bg-yellow-400/10 border border-yellow-400/30">
                        <FileText className="h-4 w-4 text-yellow-400" />
                        <span className="text-xs font-medium text-yellow-400">
                          {project.additionalInfoRequirements.length} additional{" "}
                          {project.additionalInfoRequirements.length === 1
                            ? "requirement"
                            : "requirements"}
                        </span>
                      </div>
                    )}

                  {/* Action Button */}
                  <Button
                    onClick={() => handleCreateProposal(project.id)}
                    disabled={isCreating}
                    className="w-full bg-yellow-400 hover:bg-yellow-500 text-black font-semibold"
                  >
                    {isCreating ? (
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

                  {/* Created date */}
                  <div className="pt-2 border-t border-yellow-400/20">
                    <p className="text-xs text-muted-foreground">
                      Posted {formatDate(project.createdAt)}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
