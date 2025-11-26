"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ProjectRequirementsDisplay } from "@/components/client/project-requirements-display"
import { ProposalEditor, type ProposalFormData } from "@/components/lead/proposal-editor"
import { LeadScoreCard } from "@/components/lead/lead-score-card"
import { useUser } from "@/hooks/use-user"
import { useGraphQLQuery } from "@/hooks/use-graphql"
import { useRealtimeRankings } from "@/hooks/use-realtime-rankings"
import { gql } from "graphql-request"
import { GET_PROPOSAL_SCORES, GET_PROPOSAL_RANKINGS } from "@/lib/graphql/queries"
import { 
  FileText, 
  Clock, 
  DollarSign, 
  Users, 
  Calendar,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Loader2,
  Edit3,
  Eye
} from "lucide-react"
import type { AdditionalInfoRequirement } from "@/lib/graphql/types"

interface ProposalWithProject {
  id: string
  title: string | null
  content: string | null
  status: string
  budgetEstimate: number | null
  timelineEstimate: string | null
  submissionDate: string | null
  additionalInfo: Record<string, any> | null
  project: {
    id: string
    title: string
    description: string
    deadline: string | null
    status: string
    additionalInfoRequirements: AdditionalInfoRequirement[]
  }
}

const GET_LEAD_PROPOSALS = gql`
  query GetLeadProposals($leadId: ID!) {
    leadProposals(leadId: $leadId) {
      id
      title
      content
      status
      budgetEstimate
      timelineEstimate
      submissionDate
      additionalInfo
      project {
        id
        title
        description
        deadline
        status
        additionalInfoRequirements {
          id
          fieldName
          fieldType
          required
          helpText
          options
          order
        }
      }
    }
  }
`

import { UPDATE_PROPOSAL, SUBMIT_PROPOSAL } from "@/lib/graphql/mutations"

const statusColors: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
  draft: {
    bg: "bg-gray-100 dark:bg-gray-800",
    text: "text-gray-700 dark:text-gray-300",
    icon: <FileText className="h-4 w-4" />,
  },
  submitted: {
    bg: "bg-blue-100 dark:bg-blue-900/20",
    text: "text-blue-700 dark:text-blue-300",
    icon: <Clock className="h-4 w-4" />,
  },
  under_review: {
    bg: "bg-yellow-100 dark:bg-yellow-900/20",
    text: "text-yellow-700 dark:text-yellow-300",
    icon: <AlertCircle className="h-4 w-4" />,
  },
  accepted: {
    bg: "bg-green-100 dark:bg-green-900/20",
    text: "text-green-700 dark:text-green-300",
    icon: <CheckCircle2 className="h-4 w-4" />,
  },
  rejected: {
    bg: "bg-red-100 dark:bg-red-900/20",
    text: "text-red-700 dark:text-red-300",
    icon: <XCircle className="h-4 w-4" />,
  },
}

export function WorkspaceContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, loading: userLoading } = useUser()
  const [selectedProposalId, setSelectedProposalId] = React.useState<string | null>(
    searchParams.get("proposal")
  )
  const [viewMode, setViewMode] = React.useState<"view" | "edit">("edit")

  // Only fetch proposals if user is a bidding lead
  const shouldFetch = !!user?.id && user?.user_metadata?.role === 'bidding_lead'
  
  // Fetch proposals for the current lead
  const { data, isLoading, error } = useGraphQLQuery<{ leadProposals: ProposalWithProject[] }>(
    ['lead-proposals', user?.id || 'no-user'],
    GET_LEAD_PROPOSALS,
    { leadId: user?.id || '' },
    {
      staleTime: 1 * 60 * 1000,
      enabled: shouldFetch, // Only run query if user is a bidding lead
    }
  )

  const proposals = shouldFetch ? (data?.leadProposals || []) : []

  // Get selected proposal
  const selectedProposal = React.useMemo(() => {
    if (!selectedProposalId) return null
    return proposals.find((p) => p.id === selectedProposalId) || null
  }, [selectedProposalId, proposals])

  // Debug logging
  React.useEffect(() => {
    console.log('Workspace Debug:', {
      userId: user?.id,
      userRole: user?.user_metadata?.role,
      shouldFetch,
      isLoading,
      error: error?.message,
      proposalsCount: proposals.length,
      proposals: proposals.map(p => ({ id: p.id, title: p.title, status: p.status })),
      selectedProposal: selectedProposal ? {
        id: selectedProposal.id,
        title: selectedProposal.title,
        status: selectedProposal.status,
        isDraft: selectedProposal.status?.toLowerCase() === 'draft'
      } : null
    })
  }, [user, shouldFetch, isLoading, error, proposals, selectedProposal])

  // Fetch proposal scores for the selected proposal
  const { data: scoresData, isLoading: scoresLoading, refetch: refetchScores } = useGraphQLQuery<{ proposalScores: any[] }>(
    ['proposal-scores', selectedProposalId || 'none'],
    GET_PROPOSAL_SCORES,
    { proposalId: selectedProposalId || '' },
    {
      enabled: !!selectedProposalId && selectedProposal?.status !== 'draft',
      staleTime: 1 * 60 * 1000,
    }
  )

  // Fetch proposal rankings for the project
  const { data: rankingsData, refetch: refetchRankings } = useGraphQLQuery<{ proposalRankings: any[] }>(
    ['proposal-rankings', selectedProposal?.project.id || 'none'],
    GET_PROPOSAL_RANKINGS,
    { projectId: selectedProposal?.project.id || '' },
    {
      enabled: !!selectedProposal?.project.id && selectedProposal?.status !== 'draft',
      staleTime: 1 * 60 * 1000,
    }
  )

  // Set up real-time updates for rankings (Requirements: 5.5)
  useRealtimeRankings({
    projectId: selectedProposal?.project.id || '',
    onRankingUpdated: () => {
      refetchRankings()
      refetchScores()
    },
    onRankingInserted: () => {
      refetchRankings()
      refetchScores()
    },
  })

  // Get scores and ranking for the selected proposal
  const proposalScores = scoresData?.proposalScores || []
  const proposalRanking = rankingsData?.proposalRankings?.find(
    (r: any) => r.proposal.id === selectedProposalId
  )

  // Determine if proposal has been scored
  const hasScores = proposalScores.length > 0
  const isScored = hasScores && proposalScores.every((s: any) => s.isFinal)

  // Update URL when proposal is selected
  React.useEffect(() => {
    if (selectedProposalId) {
      router.replace(`/workspace?proposal=${selectedProposalId}`, { scroll: false })
    } else {
      router.replace('/workspace', { scroll: false })
    }
  }, [selectedProposalId, router])

  const handleProposalClick = (proposalId: string) => {
    setSelectedProposalId(proposalId)
  }

  const handleViewProject = (projectId: string) => {
    router.push(`/projects/${projectId}`)
  }

  const handleSaveProposal = async (data: ProposalFormData) => {
    if (!selectedProposal) return

    try {
      const response = await fetch("/api/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: UPDATE_PROPOSAL,
          variables: {
            proposalId: selectedProposal.id,
            ...data,
          },
        }),
      })

      const result = await response.json()

      if (result.errors) {
        throw new Error(result.errors[0]?.message || "Failed to save proposal")
      }

      alert("Proposal saved successfully!")
      // Refresh data
      window.location.reload()
    } catch (error) {
      console.error("Error saving proposal:", error)
      alert(error instanceof Error ? error.message : "Failed to save proposal")
    }
  }

  const handleSubmitProposal = async (data: ProposalFormData) => {
    if (!selectedProposal) return

    // First save the proposal
    await handleSaveProposal(data)

    try {
      const response = await fetch("/api/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: SUBMIT_PROPOSAL,
          variables: {
            input: {
              proposalId: selectedProposal.id,
              projectId: selectedProposal.project.id,
              title: data.title,
              budgetEstimate: data.budgetEstimate || 0,
              timelineEstimate: data.timelineEstimate,
              executiveSummary: data.content,
              additionalInfo: Object.entries(data.additionalInfo || {}).map(([fieldId, fieldValue]) => {
                const req = selectedProposal.project.additionalInfoRequirements?.find(r => r.id === fieldId)
                return {
                  fieldId,
                  fieldName: req?.fieldName || fieldId,
                  fieldValue
                }
              })
            }
          },
        }),
      })

      const result = await response.json()

      if (result.errors) {
        throw new Error(result.errors[0]?.message || "Failed to submit proposal")
      }

      if (!result.data?.submitProposal?.success) {
        throw new Error(result.data?.submitProposal?.errors?.join(', ') || "Failed to submit proposal")
      }

      alert("Proposal submitted successfully!")
      router.push("/lead-dashboard")
    } catch (error) {
      console.error("Error submitting proposal:", error)
      alert(error instanceof Error ? error.message : "Failed to submit proposal")
    }
  }

  if (userLoading || isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-yellow-400" />
        </div>
      </div>
    )
  }

  if (error && shouldFetch) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="p-6 border-yellow-400/20 bg-yellow-50 dark:bg-yellow-950/10">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-400 rounded-full">
                <AlertCircle className="h-5 w-5 text-black" />
              </div>
              <div>
                <h3 className="font-semibold text-black dark:text-white">
                  Unable to Load Proposals
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  We're having trouble loading your proposals. Please try refreshing the page.
                </p>
              </div>
            </div>
            <Button
              onClick={() => window.location.reload()}
              className="bg-yellow-400 hover:bg-yellow-500 text-black"
            >
              Refresh Page
            </Button>
          </div>
        </Card>
      </div>
    )
  }

  if (!user || user.user_metadata?.role !== 'bidding_lead') {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="p-6 border-yellow-400/20">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-yellow-400" />
            <p className="text-muted-foreground">
              This workspace is only available for bidding leads.
            </p>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-[1800px]">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-black dark:text-white mb-2">Workspace</h1>
        <p className="text-muted-foreground">
          Manage your proposals and view project requirements
        </p>
      </div>

      {proposals.length === 0 ? (
        <Card className="p-12 border-yellow-400/20 text-center">
          <FileText className="h-12 w-12 text-yellow-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-black dark:text-white mb-2">
            No Proposals Yet
          </h3>
          <p className="text-muted-foreground">
            You don't have any proposals yet. Start by creating a proposal for an open project.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Proposals List */}
          <div className="lg:col-span-4 space-y-4">
            <h2 className="text-lg font-semibold text-black dark:text-white">
              Your Proposals ({proposals.length})
            </h2>
            <div className="space-y-3">
              {proposals.map((proposal) => {
                const statusInfo = statusColors[proposal.status] || statusColors.draft
                const isSelected = selectedProposalId === proposal.id

                return (
                  <Card
                    key={proposal.id}
                    className={`p-4 cursor-pointer transition-all border-yellow-400/20 hover:border-yellow-400/40 ${
                      isSelected ? "ring-2 ring-yellow-400 border-yellow-400" : ""
                    }`}
                    onClick={() => handleProposalClick(proposal.id)}
                  >
                    <div className="space-y-3">
                      <div>
                        <h3 className="font-semibold text-black dark:text-white mb-1">
                          {proposal.title || "Untitled Proposal"}
                        </h3>
                        <p className="text-sm text-muted-foreground line-clamp-1">
                          {proposal.project.title}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge
                          className={`${statusInfo.bg} ${statusInfo.text} flex items-center gap-1`}
                        >
                          {statusInfo.icon}
                          {proposal.status.replace(/_/g, " ")}
                        </Badge>
                      </div>

                      {proposal.budgetEstimate && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <DollarSign className="h-4 w-4" />
                          <span>${proposal.budgetEstimate.toLocaleString()}</span>
                        </div>
                      )}
                    </div>
                  </Card>
                )
              })}
            </div>
          </div>

          {/* Proposal Details & Editor */}
          <div className="lg:col-span-8">
            {selectedProposal ? (
              <div className="space-y-6">
                {/* Header with Mode Toggle */}
                <Card className="p-4 border-yellow-400/20">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1">
                      <h2 className="text-xl font-bold text-black dark:text-white">
                        {selectedProposal.project.title}
                      </h2>
                      <p className="text-sm text-muted-foreground mt-1">
                        {selectedProposal.status === "draft" ? "Draft Proposal" : "Submitted Proposal"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewProject(selectedProposal.project.id)}
                        className="border-yellow-400/20 hover:bg-yellow-400/10"
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        View Project
                      </Button>
                      {selectedProposal.status?.toLowerCase() === "draft" && (
                        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "view" | "edit")}>
                          <TabsList className="bg-yellow-400/10">
                            <TabsTrigger value="edit" className="data-[state=active]:bg-yellow-400 data-[state=active]:text-black">
                              <Edit3 className="h-4 w-4 mr-2" />
                              Edit
                            </TabsTrigger>
                            <TabsTrigger value="view" className="data-[state=active]:bg-yellow-400 data-[state=active]:text-black">
                              <Eye className="h-4 w-4 mr-2" />
                              Preview
                            </TabsTrigger>
                          </TabsList>
                        </Tabs>
                      )}
                    </div>
                  </div>
                </Card>

                {/* Edit Mode - Proposal Editor */}
                {viewMode === "edit" && selectedProposal.status?.toLowerCase() === "draft" && (
                  <ProposalEditor
                    proposalId={selectedProposal.id}
                    projectId={selectedProposal.project.id}
                    initialData={{
                      title: selectedProposal.title || "",
                      content: selectedProposal.content || "",
                      budgetEstimate: selectedProposal.budgetEstimate || undefined,
                      timelineEstimate: selectedProposal.timelineEstimate || "",
                      additionalInfo: selectedProposal.additionalInfo || {},
                    }}
                    requirements={selectedProposal.project.additionalInfoRequirements || []}
                    onSave={handleSaveProposal}
                    onSubmit={handleSubmitProposal}
                  />
                )}

                {/* View Mode - Read-only Display */}
                {(viewMode === "view" || selectedProposal.status?.toLowerCase() !== "draft") && (
                  <div className="space-y-6">
                    {/* Proposal Content */}
                    <Card className="p-6 border-yellow-400/20">
                      <div className="space-y-4">
                        <div>
                          <h3 className="text-lg font-semibold text-black dark:text-white mb-2">
                            {selectedProposal.title || "Untitled Proposal"}
                          </h3>
                          <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                            {selectedProposal.content || "No content provided yet."}
                          </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-yellow-400/20">
                          {selectedProposal.budgetEstimate && (
                            <div className="flex items-center gap-3 p-3 bg-yellow-400/5 rounded-lg border border-yellow-400/10">
                              <DollarSign className="h-5 w-5 text-yellow-400" />
                              <div>
                                <p className="text-xs text-muted-foreground">Budget</p>
                                <p className="font-semibold text-yellow-400">
                                  ${selectedProposal.budgetEstimate.toLocaleString()}
                                </p>
                              </div>
                            </div>
                          )}

                          {selectedProposal.timelineEstimate && (
                            <div className="flex items-center gap-3 p-3 bg-white dark:bg-black rounded-lg border border-yellow-400/10">
                              <Clock className="h-5 w-5 text-yellow-400" />
                              <div>
                                <p className="text-xs text-muted-foreground">Timeline</p>
                                <p className="font-semibold text-black dark:text-white">
                                  {selectedProposal.timelineEstimate}
                                </p>
                              </div>
                            </div>
                          )}

                          {selectedProposal.project.deadline && (
                            <div className="flex items-center gap-3 p-3 bg-white dark:bg-black rounded-lg border border-yellow-400/10">
                              <Calendar className="h-5 w-5 text-yellow-400" />
                              <div>
                                <p className="text-xs text-muted-foreground">Deadline</p>
                                <p className="font-semibold text-black dark:text-white">
                                  {new Date(selectedProposal.project.deadline).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </Card>

                    {/* Scoring Section - Only show for submitted proposals */}
                    {selectedProposal.status?.toLowerCase() !== 'draft' && (
                      <>
                        {scoresLoading ? (
                          <Card className="p-6 border-yellow-400/20">
                            <div className="flex items-center justify-center py-8">
                              <Loader2 className="h-6 w-6 animate-spin text-yellow-400" />
                            </div>
                          </Card>
                        ) : hasScores ? (
                          <LeadScoreCard 
                            scores={proposalScores} 
                            ranking={proposalRanking}
                          />
                        ) : (
                          <Card className="p-6 border-yellow-400/20 bg-yellow-50 dark:bg-yellow-950/10">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-yellow-400 rounded-full">
                                <Clock className="h-5 w-5 text-black" />
                              </div>
                              <div>
                                <h3 className="font-semibold text-black dark:text-white">
                                  Pending Evaluation
                                </h3>
                                <p className="text-sm text-muted-foreground mt-1">
                                  Your proposal is under review. The client will evaluate it soon.
                                </p>
                              </div>
                            </div>
                          </Card>
                        )}
                      </>
                    )}

                    {/* Additional Info Responses */}
                    {selectedProposal.additionalInfo && Object.keys(selectedProposal.additionalInfo).length > 0 && (
                      <Card className="p-6 border-yellow-400/20">
                        <h3 className="text-lg font-semibold text-black dark:text-white mb-4">
                          Additional Information Provided
                        </h3>
                        <div className="space-y-3">
                          {selectedProposal.project.additionalInfoRequirements
                            ?.sort((a, b) => a.order - b.order)
                            .map((req) => {
                              const value = selectedProposal.additionalInfo?.[req.id]
                              if (!value) return null
                              return (
                                <div key={req.id} className="p-3 bg-yellow-400/5 rounded-lg border border-yellow-400/10">
                                  <p className="text-sm font-medium text-black dark:text-white mb-1">
                                    {req.fieldName}
                                  </p>
                                  <p className="text-sm text-muted-foreground">
                                    {typeof value === "object" ? JSON.stringify(value) : value}
                                  </p>
                                </div>
                              )
                            })}
                        </div>
                      </Card>
                    )}

                    {/* Project Requirements Reference */}
                    {selectedProposal.project.additionalInfoRequirements &&
                      selectedProposal.project.additionalInfoRequirements.length > 0 && (
                        <ProjectRequirementsDisplay
                          requirements={selectedProposal.project.additionalInfoRequirements}
                        />
                      )}
                  </div>
                )}
              </div>
            ) : (
              <Card className="p-12 border-yellow-400/20 text-center">
                <FileText className="h-12 w-12 text-yellow-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-black dark:text-white mb-2">
                  Select a Proposal
                </h3>
                <p className="text-muted-foreground">
                  Choose a proposal from the list to edit or view its details.
                </p>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
