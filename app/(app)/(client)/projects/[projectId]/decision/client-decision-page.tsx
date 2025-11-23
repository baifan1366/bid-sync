"use client"

import * as React from "react"
import dynamic from "next/dynamic"
import { useRouter, useSearchParams } from "next/navigation"
import { ProjectHeader } from "@/components/client/project-header"
import { ProgressTracker } from "@/components/client/progress-tracker"
import { ProposalsControls } from "@/components/client/proposals-controls"
import { ProposalsList } from "@/components/client/proposals-list"
import { ConnectionStatus } from "@/components/client/connection-status"
import { ProjectRequirementsDisplay } from "@/components/client/project-requirements-display"
import { useUser } from "@/hooks/use-user"
import { useGraphQLQuery } from "@/hooks/use-graphql"
import { useRealtimeProposals } from "@/hooks/use-realtime-proposals"
import { useToast } from "@/components/ui/use-toast"
import { gql } from "graphql-request"
import { ProjectWithProposals } from "@/lib/graphql/types"

// Lazy load heavy components
const ProposalDetailView = dynamic(
  () => import("@/components/client/proposal-detail-view").then(mod => ({ default: mod.ProposalDetailView })),
  {
    loading: () => (
      <div className="flex h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading proposal details...</div>
      </div>
    ),
    ssr: false,
  }
)

const ProposalComparisonView = dynamic(
  () => import("@/components/client/proposal-comparison-view").then(mod => ({ default: mod.ProposalComparisonView })),
  {
    loading: () => (
      <div className="flex h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading comparison view...</div>
      </div>
    ),
    ssr: false,
  }
)

const ChatSection = dynamic(
  () => import("@/components/client/chat-section").then(mod => ({ default: mod.ChatSection })),
  {
    loading: () => (
      <div className="h-full flex items-center justify-center">
        <div className="text-muted-foreground">Loading chat...</div>
      </div>
    ),
    ssr: false,
  }
)

interface ClientDecisionPageProps {
  projectId: string
}

type ProposalStatus = 'draft' | 'submitted' | 'under_review' | 'accepted' | 'rejected'
type SortField = 'submission_date' | 'budget' | 'team_size'
type SortOrder = 'asc' | 'desc'
type ViewMode = 'list' | 'comparison'

// GraphQL query for project with proposals
const GET_PROJECT_WITH_PROPOSALS = gql`
  query GetProjectWithProposals($projectId: ID!) {
    projectWithProposals(projectId: $projectId) {
      project {
        id
        title
        description
        budget
        deadline
        status
        createdAt
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
      proposals {
        id
        title
        biddingTeamName
        biddingLead {
          id
          name
          email
          avatarUrl
          role
          assignedSections
        }
        teamSize
        budgetEstimate
        timelineEstimate
        submissionDate
        status
        complianceScore
        unreadMessages
      }
      totalProposals
      submittedProposals
      underReviewProposals
      acceptedProposals
      rejectedProposals
    }
  }
`

export function ClientDecisionPage({ projectId }: ClientDecisionPageProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, loading: userLoading } = useUser()
  const { toast } = useToast()

  // URL state management
  const selectedProposalId = searchParams.get("proposal")
  const urlViewMode = searchParams.get("view") as ViewMode | null
  const urlFilterStatus = searchParams.get("status") as ProposalStatus | "all" | null
  const urlSortBy = searchParams.get("sortBy") as SortField | null
  const urlSortOrder = searchParams.get("sortOrder") as SortOrder | null

  // Local state for filters, sorts, and view mode
  const [filterStatus, setFilterStatus] = React.useState<ProposalStatus | 'all'>(
    urlFilterStatus || 'all'
  )
  const [sortBy, setSortBy] = React.useState<SortField>(
    urlSortBy || 'submission_date'
  )
  const [sortOrder, setSortOrder] = React.useState<SortOrder>(
    urlSortOrder || 'desc'
  )
  const [viewMode, setViewMode] = React.useState<ViewMode>(
    urlViewMode || 'list'
  )
  const [selectedProposals, setSelectedProposals] = React.useState<string[]>([])

  // Fetch project data with proposals
  const { data, isLoading, error, refetch } = useGraphQLQuery<{ projectWithProposals: ProjectWithProposals }>(
    ['project-with-proposals', projectId],
    GET_PROJECT_WITH_PROPOSALS,
    { projectId },
    {
      staleTime: 1 * 60 * 1000, // 1 minute - data is fresh for 1 minute
      cacheTime: 5 * 60 * 1000, // 5 minutes - keep in cache for 5 minutes
      refetchOnWindowFocus: true, // Refetch when user returns to tab
    }
  )

  const projectData = data?.projectWithProposals

  // Handle proposal updates from realtime
  const handleProposalUpdated = React.useCallback((proposal: any) => {
    // Refetch to get updated data
    refetch()
    
    // Show notification for status changes
    toast({
      title: "Proposal Updated",
      description: `A proposal has been updated to ${proposal.status}`,
    })
  }, [refetch, toast])

  // Handle new proposals from realtime
  const handleProposalInserted = React.useCallback((proposal: any) => {
    // Refetch to get new proposal
    refetch()
    
    // Show notification for new proposals
    toast({
      title: "New Proposal Received",
      description: "A new proposal has been submitted for this project",
    })
  }, [refetch, toast])

  // Set up realtime subscription for proposal updates
  const { connectionStatus: proposalConnectionStatus, reconnect: reconnectProposals } = useRealtimeProposals({
    projectId,
    onProposalUpdated: handleProposalUpdated,
    onProposalInserted: handleProposalInserted,
  })

  // Update URL when state changes
  React.useEffect(() => {
    const params = new URLSearchParams()
    
    if (selectedProposalId) {
      params.set("proposal", selectedProposalId)
    }
    
    if (viewMode !== 'list') {
      params.set("view", viewMode)
    }
    
    if (filterStatus !== 'all') {
      params.set("status", filterStatus)
    }
    
    if (sortBy !== 'submission_date') {
      params.set("sortBy", sortBy)
    }
    
    if (sortOrder !== 'desc') {
      params.set("sortOrder", sortOrder)
    }

    const newUrl = params.toString() 
      ? `/projects/${projectId}/decision?${params.toString()}`
      : `/projects/${projectId}/decision`
    
    router.replace(newUrl, { scroll: false })
  }, [selectedProposalId, viewMode, filterStatus, sortBy, sortOrder, projectId, router])

  // Handle filter change
  const handleFilterChange = (status: ProposalStatus | 'all') => {
    setFilterStatus(status)
  }

  // Handle sort change
  const handleSortChange = (field: SortField, order: SortOrder) => {
    setSortBy(field)
    setSortOrder(order)
  }

  // Handle view mode change
  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode)
    if (mode === 'list') {
      setSelectedProposals([])
    }
  }

  // Handle proposal selection for comparison
  const handleProposalSelect = (proposalId: string) => {
    setSelectedProposals((prev) => {
      if (prev.includes(proposalId)) {
        return prev.filter((id) => id !== proposalId)
      } else {
        // Max 4 proposals for comparison
        if (prev.length >= 4) {
          return prev
        }
        return [...prev, proposalId]
      }
    })
  }

  // Handle proposal click to view details
  const handleProposalClick = (proposalId: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set("proposal", proposalId)
    router.push(`/projects/${projectId}/decision?${params.toString()}`)
  }

  // Handle closing detail view
  const handleCloseDetail = () => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete("proposal")
    router.push(`/projects/${projectId}/decision?${params.toString()}`)
  }

  // Handle comparison click
  const handleCompareClick = () => {
    if (selectedProposals.length >= 2 && selectedProposals.length <= 4) {
      setViewMode('comparison')
    }
  }

  // Loading state
  if (userLoading || isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading project...</div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 mb-2">Error loading project</p>
          <p className="text-sm text-muted-foreground">{error.message}</p>
        </div>
      </div>
    )
  }

  // No data state
  if (!projectData) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-muted-foreground">Project not found</div>
      </div>
    )
  }

  // Show detail view if proposal is selected
  if (selectedProposalId && viewMode === 'list') {
    return (
      <ProposalDetailView
        proposalId={selectedProposalId}
        projectId={projectId}
        onClose={handleCloseDetail}
        onSubmissionComplete={() => {
          // Refetch project data after submission
          refetch()
        }}
      />
    )
  }

  // Show comparison view
  if (viewMode === 'comparison' && selectedProposals.length >= 2) {
    return (
      <ProposalComparisonView
        proposalIds={selectedProposals}
        onClose={() => handleViewModeChange('list')}
      />
    )
  }

  // Main page layout
  return (
    <div className="min-h-screen bg-white dark:bg-black">
      <div className="mx-auto max-w-[1800px] px-4 py-6 sm:px-6" role="main">
        {/* Connection Status Bar */}
        {proposalConnectionStatus.status !== "connected" && (
          <div 
            className="mb-4 flex items-center justify-between p-3 bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-400/20 rounded-lg"
            role="status"
            aria-live="polite"
          >
            <p className="text-sm text-muted-foreground">
              Real-time updates {proposalConnectionStatus.status === "connecting" ? "connecting" : "unavailable"}
            </p>
            <ConnectionStatus
              status={proposalConnectionStatus.status}
              error={proposalConnectionStatus.error}
              onReconnect={reconnectProposals}
              size="sm"
            />
          </div>
        )}
        
        {/* Page Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Main Content Area */}
          <main className="lg:col-span-8 space-y-6" aria-label="Project proposals">
            {/* Project Header */}
            <ProjectHeader
              project={projectData.project}
              proposalsCount={projectData.totalProposals}
            />

            {/* Progress Tracker */}
            <ProgressTracker
              totalProposals={projectData.totalProposals}
              submittedProposals={projectData.submittedProposals}
              underReviewProposals={projectData.underReviewProposals}
              acceptedProposals={projectData.acceptedProposals}
              rejectedProposals={projectData.rejectedProposals}
              projectStatus={projectData.project.status}
            />

            {/* Project Requirements */}
            {projectData.project.additionalInfoRequirements && 
             projectData.project.additionalInfoRequirements.length > 0 && (
              <ProjectRequirementsDisplay
                requirements={projectData.project.additionalInfoRequirements}
              />
            )}

            {/* Proposals Section */}
            <section className="space-y-4" aria-labelledby="proposals-heading">
              <h2 id="proposals-heading" className="sr-only">Proposals List</h2>
              <ProposalsControls
                filterStatus={filterStatus}
                onFilterChange={handleFilterChange}
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSortChange={handleSortChange}
                viewMode={viewMode}
                onViewModeChange={handleViewModeChange}
                selectedProposals={selectedProposals}
                onCompareClick={handleCompareClick}
              />

              <ProposalsList
                proposals={projectData.proposals}
                isLoading={isLoading}
                selectedProposals={selectedProposals}
                onProposalSelect={handleProposalSelect}
                onProposalClick={handleProposalClick}
                filterStatus={filterStatus}
                sortBy={sortBy}
                sortOrder={sortOrder}
              />
            </section>
          </main>

          {/* Chat Sidebar (Desktop) */}
          <aside className="lg:col-span-4" aria-label="Project chat">
            <div className="sticky top-6">
              <ChatSection
                projectId={projectId}
                proposalId={null}
                projectTitle={projectData.project.title}
              />
            </div>
          </aside>
        </div>

        {/* Chat Section (Mobile - Bottom) */}
        <aside className="lg:hidden mt-6" aria-label="Project chat">
          <ChatSection
            projectId={projectId}
            proposalId={null}
            projectTitle={projectData.project.title}
          />
        </aside>
      </div>
    </div>
  )
}
