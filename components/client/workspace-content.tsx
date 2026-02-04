"use client"

import * as React from "react"
import dynamic from "next/dynamic"
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
import { useToast } from "@/components/ui/use-toast"
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
  Eye,
  Users2,
  MessageSquare,
  Pencil,
  Check,
  X
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { TipTapEditor } from "@/components/editor/tiptap-editor"
type JSONContent = Record<string, unknown>
import type { AdditionalInfoRequirement } from "@/lib/graphql/types"
import { WorkspaceSkeleton } from "./workspace-skeleton"

// Lazy load ChatSection for better performance
const ChatSection = dynamic(
  () => import("@/components/client/chat-section").then(mod => ({ default: mod.ChatSection })),
  {
    loading: () => (
      <Card className="h-full flex items-center justify-center border-yellow-400/20">
        <div className="text-muted-foreground">Loading chat...</div>
      </Card>
    ),
    ssr: false,
  }
)

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

const GET_MEMBER_PROPOSALS = gql`
  query GetMemberProposals {
    myMemberProposals {
      id
      title
      status
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

const GET_WORKSPACE_DOCUMENT = gql`
  query GetWorkspaceByProject($projectId: ID!) {
    workspaceByProject(projectId: $projectId) {
      id
      documents {
        id
        title
        content
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
  pending_approval: {
    bg: "bg-yellow-100 dark:bg-yellow-900/20",
    text: "text-yellow-700 dark:text-yellow-300",
    icon: <Clock className="h-4 w-4" />,
  },
  submitted: {
    bg: "bg-blue-100 dark:bg-blue-900/20",
    text: "text-blue-700 dark:text-blue-300",
    icon: <CheckCircle2 className="h-4 w-4" />,
  },
  under_review: {
    bg: "bg-purple-100 dark:bg-purple-900/20",
    text: "text-purple-700 dark:text-purple-300",
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

const statusLabels: Record<string, string> = {
  draft: "Draft",
  pending_approval: "Pending Approval",
  submitted: "Submitted",
  under_review: "Under Review",
  accepted: "Accepted",
  rejected: "Rejected",
}

export function WorkspaceContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, loading: userLoading } = useUser()
  const { toast } = useToast()
  const [selectedProposalId, setSelectedProposalId] = React.useState<string | null>(
    searchParams.get("proposal")
  )
  const [viewMode, setViewMode] = React.useState<"view" | "edit">("edit")
  const [editingProposalId, setEditingProposalId] = React.useState<string | null>(null)
  const [editingTitle, setEditingTitle] = React.useState<string>("")
  const [isSavingTitle, setIsSavingTitle] = React.useState(false)

  // Only fetch proposals if user is a bidding lead or member
  const isBiddingLead = user?.user_metadata?.role === 'bidding_lead'
  const isBiddingMember = user?.user_metadata?.role === 'bidding_member'
  
  // Fetch proposals for the current lead
  const { data: leadData, isLoading: leadLoading, error: leadError, refetch: refetchLeadProposals } = useGraphQLQuery<{ leadProposals: ProposalWithProject[] }>(
    ['lead-proposals', user?.id || 'no-user'],
    GET_LEAD_PROPOSALS,
    { leadId: user?.id || 'placeholder' },
    {
      staleTime: 1 * 60 * 1000,
      enabled: !!user?.id && isBiddingLead,
    }
  )

  // Fetch proposals for members (proposals they're part of)
  const { data: memberData, isLoading: memberLoading, error: memberError, refetch: refetchMemberProposals } = useGraphQLQuery<{ myMemberProposals: ProposalWithProject[] }>(
    ['member-proposals', user?.id || 'no-user'],
    GET_MEMBER_PROPOSALS,
    {},
    {
      staleTime: 1 * 60 * 1000,
      enabled: !!user?.id && isBiddingMember,
    }
  )

  const proposals = isBiddingLead 
    ? (leadData?.leadProposals || []) 
    : isBiddingMember 
    ? (memberData?.myMemberProposals || [])
    : []
  
  const isLoading = isBiddingLead ? leadLoading : isBiddingMember ? memberLoading : false
  const error = isBiddingLead ? leadError : isBiddingMember ? memberError : null

  // Get selected proposal
  const selectedProposal = React.useMemo(() => {
    if (!selectedProposalId) return null
    return proposals.find((p: ProposalWithProject) => p.id === selectedProposalId) || null
  }, [selectedProposalId, proposals])

  // Check if selected proposal is in draft status
  const isDraft = selectedProposal?.status?.toLowerCase() === 'draft'

  // Fetch workspace document for the selected proposal's project
  const { data: workspaceData, refetch: refetchWorkspace } = useGraphQLQuery<{ 
    workspaceByProject: { 
      id: string
      documents: Array<{ id: string; title: string; content: any }> 
    } 
  }>(
    ['workspace-document', selectedProposal?.project.id || 'none'],
    GET_WORKSPACE_DOCUMENT,
    { projectId: selectedProposal?.project.id || '' },
    {
      enabled: !!selectedProposal?.project.id,
      staleTime: 30 * 1000, // Reduce stale time to 30 seconds for fresher data
    }
  )

  // Get the first document ID from the workspace (main proposal document)
  const documentId = workspaceData?.workspaceByProject?.documents?.[0]?.id
  
  // Get document content from workspace_documents (source of truth for collaborative editor)
  const documentContent = workspaceData?.workspaceByProject?.documents?.[0]?.content

  // Fetch proposal scores for the selected proposal
  const { data: scoresData, isLoading: scoresLoading, refetch: refetchScores } = useGraphQLQuery<{ proposalScores: any[] }>(
    ['proposal-scores', selectedProposalId || 'none'],
    GET_PROPOSAL_SCORES,
    { proposalId: selectedProposalId || '' },
    {
      enabled: !!selectedProposalId && !isDraft,
      staleTime: 1 * 60 * 1000,
    }
  )

  // Fetch proposal rankings for the project
  const { data: rankingsData, refetch: refetchRankings } = useGraphQLQuery<{ proposalRankings: any[] }>(
    ['proposal-rankings', selectedProposal?.project.id || 'none'],
    GET_PROPOSAL_RANKINGS,
    { projectId: selectedProposal?.project.id || '' },
    {
      enabled: !!selectedProposal?.project.id && !isDraft,
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
    (r: { proposal: { id: string } }) => r.proposal.id === selectedProposalId
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

  const handleStartEditTitle = (e: React.MouseEvent, proposal: ProposalWithProject) => {
    e.stopPropagation()
    setEditingProposalId(proposal.id)
    setEditingTitle(
      typeof proposal.title === 'string' && !proposal.title.startsWith('[') && !proposal.title.startsWith('{')
        ? proposal.title
        : ""
    )
  }

  const handleCancelEditTitle = (e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingProposalId(null)
    setEditingTitle("")
  }

  const handleSaveTitle = async (e: React.MouseEvent, proposalId: string) => {
    e.stopPropagation()
    if (!editingTitle.trim()) {
      toast({
        title: "Validation Error",
        description: "Proposal title cannot be empty",
        variant: "destructive",
      })
      return
    }

    setIsSavingTitle(true)
    try {
      const response = await fetch("/api/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: UPDATE_PROPOSAL,
          variables: {
            proposalId,
            title: editingTitle.trim(),
          },
        }),
      })

      const result = await response.json()

      if (result.errors) {
        throw new Error(result.errors[0]?.message || "Failed to update title")
      }

      // Refresh data
      window.location.reload()
    } catch (error) {
      console.error("Error updating title:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update title",
        variant: "destructive",
      })
    } finally {
      setIsSavingTitle(false)
      setEditingProposalId(null)
      setEditingTitle("")
    }
  }

  const handleViewProject = (projectId: string) => {
    router.push(`/client-projects/${projectId}`)
  }

  const handleSaveProposal = async (data: ProposalFormData) => {
    if (!selectedProposal) {
      console.error('[Save] No selected proposal')
      throw new Error('No proposal selected')
    }

    console.log('[Save] Starting save for proposal:', selectedProposal.id)
    console.log('[Save] Form data:', {
      title: data.title,
      contentLength: data.content?.length,
      budgetEstimate: data.budgetEstimate,
      timelineEstimate: data.timelineEstimate,
      additionalInfoKeys: Object.keys(data.additionalInfo || {})
    })

    try {
      const variables = {
        proposalId: selectedProposal.id,
        title: data.title,
        content: data.content,
        budgetEstimate: data.budgetEstimate,
        timelineEstimate: data.timelineEstimate,
        additionalInfo: data.additionalInfo,
      }
      console.log('[Save] Variables:', JSON.stringify(variables, null, 2))

      const response = await fetch("/api/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: UPDATE_PROPOSAL,
          variables,
        }),
      })

      console.log('[Save] Response status:', response.status)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const result = await response.json()
      console.log('[Save] Result:', JSON.stringify(result, null, 2))

      if (result.errors) {
        console.error('[Save] GraphQL errors:', result.errors)
        throw new Error(result.errors[0]?.message || "Failed to save proposal")
      }

      if (!result.data?.updateProposal) {
        throw new Error("No data returned from save operation")
      }

      console.log('[Save] Save successful')
      return result.data.updateProposal
    } catch (error) {
      console.error("[Save] Error saving proposal:", error)
      throw error // Re-throw to let caller handle it
    }
  }

  // Wrapper for direct save button (shows toast without reload)
  const handleDirectSave = async (data: ProposalFormData) => {
    console.log('[DirectSave] Starting direct save...')
    try {
      await handleSaveProposal(data)
      console.log('[DirectSave] Save successful, showing toast')
      toast({
        title: "Success",
        description: "Proposal saved successfully!",
      })
      // Don't reload - user may want to continue editing or submit
    } catch (error) {
      console.error('[DirectSave] Save failed:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save proposal",
        variant: "destructive",
      })
    }
  }

  const handleSubmitProposal = async (data: ProposalFormData) => {
    if (!selectedProposal) {
      console.error('[Submit] No selected proposal')
      return
    }

    console.log('[Submit] Starting submission for proposal:', selectedProposal.id)
    console.log('[Submit] Form data:', {
      title: data.title,
      contentLength: data.content?.length,
      budgetEstimate: data.budgetEstimate,
      timelineEstimate: data.timelineEstimate,
      additionalInfoKeys: Object.keys(data.additionalInfo || {})
    })

    // First save the proposal
    console.log('[Submit] Saving proposal first...')
    await handleSaveProposal(data)
    console.log('[Submit] Save completed, now submitting...')

    try {
      const submitInput = {
        proposalId: selectedProposal.id,
        projectId: selectedProposal.project.id,
        title: data.title,
        budgetEstimate: data.budgetEstimate || 0,
        timelineEstimate: data.timelineEstimate,
        executiveSummary: data.content,
        additionalInfo: Object.entries(data.additionalInfo || {}).map(([fieldId, fieldValue]) => {
          const req = selectedProposal.project.additionalInfoRequirements?.find((r: AdditionalInfoRequirement) => r.id === fieldId)
          return {
            fieldId,
            fieldName: req?.fieldName || fieldId,
            fieldValue
          }
        })
      }
      
      console.log('[Submit] Submit input:', JSON.stringify(submitInput, null, 2))

      const response = await fetch("/api/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: SUBMIT_PROPOSAL,
          variables: { input: submitInput },
        }),
      })

      console.log('[Submit] Response status:', response.status)
      const result = await response.json()
      console.log('[Submit] Response result:', JSON.stringify(result, null, 2))

      if (result.errors) {
        console.error('[Submit] GraphQL errors:', result.errors)
        throw new Error(result.errors[0]?.message || "Failed to submit proposal")
      }

      if (!result.data?.submitProposal?.success) {
        console.error('[Submit] Submission failed:', result.data?.submitProposal)
        throw new Error(result.data?.submitProposal?.errors?.join(', ') || "Failed to submit proposal")
      }

      console.log('[Submit] Success!')
      
      // Update local state immediately to reflect new status
      if (selectedProposal) {
        selectedProposal.status = 'pending_approval'
      }
      
      // Refresh the proposal list to get updated status from server
      if (isBiddingLead) {
        await refetchLeadProposals()
      } else if (isBiddingMember) {
        await refetchMemberProposals()
      }
      
      toast({
        title: "Success",
        description: "Proposal submitted for admin approval!",
      })
      
      // Switch to view mode since proposal is no longer editable
      setViewMode('view')
      
    } catch (error) {
      console.error("[Submit] Error submitting proposal:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to submit proposal",
        variant: "destructive",
      })
    }
  }

  if (userLoading || isLoading) {
    return <WorkspaceSkeleton />
  }

  if (error && (isBiddingLead || isBiddingMember)) {
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

  if (!user || (!isBiddingLead && !isBiddingMember)) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="p-6 border-yellow-400/20">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-yellow-400" />
            <p className="text-muted-foreground">
              This workspace is only available for bidding team members.
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
          Manage your proposals and communicate with clients
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
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          {/* Proposals List */}
          <div className="xl:col-span-3 space-y-4">
            <h2 className="text-lg font-semibold text-black dark:text-white">
              Your Proposals ({proposals.length})
            </h2>
            <div className="space-y-3 max-h-[calc(100vh-200px)] overflow-y-auto pr-2">
              {proposals.map((proposal) => {
                const statusKey = proposal.status?.toLowerCase() || 'draft'
                const statusInfo = statusColors[statusKey] || statusColors.draft
                const isSelected = selectedProposalId === proposal.id

                return (
                  <Card
                    key={proposal.id}
                    className={`p-4 cursor-pointer transition-all border-yellow-400/20 hover:border-yellow-400/40 overflow-hidden ${
                      isSelected ? "ring-2 ring-yellow-400 border-yellow-400" : ""
                    }`}
                    onClick={() => handleProposalClick(proposal.id)}
                  >
                    <div className="space-y-3 overflow-hidden">
                      <div className="overflow-hidden">
                        {editingProposalId === proposal.id ? (
                          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                            <Input
                              value={editingTitle}
                              onChange={(e) => setEditingTitle(e.target.value)}
                              placeholder="Enter proposal title"
                              className="h-8 text-sm border-yellow-400/40 focus:border-yellow-400"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleSaveTitle(e as unknown as React.MouseEvent, proposal.id)
                                } else if (e.key === 'Escape') {
                                  handleCancelEditTitle(e as unknown as React.MouseEvent)
                                }
                              }}
                            />
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 shrink-0 hover:bg-green-500/10"
                              onClick={(e) => handleSaveTitle(e, proposal.id)}
                              disabled={isSavingTitle}
                            >
                              {isSavingTitle ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Check className="h-4 w-4 text-green-500" />
                              )}
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 shrink-0 hover:bg-red-500/10"
                              onClick={handleCancelEditTitle}
                              disabled={isSavingTitle}
                            >
                              <X className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="font-semibold text-black dark:text-white mb-1 truncate flex-1">
                              {typeof proposal.title === 'string' && !proposal.title.startsWith('[') && !proposal.title.startsWith('{') 
                                ? proposal.title 
                                : "Untitled Proposal"}
                            </h3>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 shrink-0 hover:bg-yellow-400/10"
                              onClick={(e) => handleStartEditTitle(e, proposal)}
                              title="Edit proposal title"
                            >
                              <Pencil className="h-3.5 w-3.5 text-muted-foreground hover:text-yellow-400" />
                            </Button>
                          </div>
                        )}
                        <p className="text-sm text-muted-foreground truncate">
                          {proposal.project.title}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge
                          className={`${statusInfo.bg} ${statusInfo.text} flex items-center gap-1`}
                        >
                          {statusInfo.icon}
                          {statusLabels[statusKey] || statusKey.replace(/_/g, " ")}
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
          <div className="xl:col-span-6">
            {selectedProposal ? (
              <div className="space-y-6">
                {/* Pending Approval Notice */}
                {selectedProposal.status === 'pending_approval' && (
                  <Card className="p-4 border-yellow-400 bg-yellow-50 dark:bg-yellow-950/10">
                    <div className="flex items-start gap-3">
                      <Clock className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5 shrink-0" />
                      <div>
                        <h3 className="font-semibold text-yellow-900 dark:text-yellow-100">
                          Pending Admin Approval
                        </h3>
                        <p className="text-sm text-yellow-800 dark:text-yellow-200 mt-1">
                          Your proposal has been submitted and is awaiting admin approval. You will be notified once it has been reviewed.
                        </p>
                      </div>
                    </div>
                  </Card>
                )}
                
                {/* Header with Mode Toggle */}
                <Card className="p-4 border-yellow-400/20">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <h2 className="text-xl font-bold text-black dark:text-white">
                        {selectedProposal.project.title}
                      </h2>
                      <p className="text-sm text-muted-foreground mt-1">
                        {isDraft ? "Draft Proposal" : statusLabels[selectedProposal.status?.toLowerCase() || ''] || "Proposal"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewProject(selectedProposal.project.id)}
                        className="border-yellow-400/20 hover:bg-yellow-400/10"
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        View Project
                      </Button>
                      {isDraft && (
                        <>
                          <Button
                            size="sm"
                            onClick={() => {
                              if (documentId) {
                                router.push(`/editor/${documentId}`)
                              } else {
                                toast({
                                  title: "Error",
                                  description: "Document not found. Please try again.",
                                  variant: "destructive",
                                })
                              }
                            }}
                            disabled={!documentId}
                            className="bg-yellow-400 hover:bg-yellow-500 text-black font-semibold disabled:opacity-50"
                          >
                            <Users2 className="h-4 w-4 mr-2" />
                            Collaborative Editor
                          </Button>
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
                        </>
                      )}
                    </div>
                  </div>
                </Card>

                {/* Edit Mode - Proposal Editor */}
                {viewMode === "edit" && isDraft && (
                  <ProposalEditor
                    proposalId={selectedProposal.id}
                    projectId={selectedProposal.project.id}
                    initialData={{
                      title: selectedProposal.title || "",
                      // Prefer document content from workspace_documents (collaborative editor source)
                      // Fall back to proposal content if document content is not available
                      content: documentContent 
                        ? (typeof documentContent === 'string' ? documentContent : JSON.stringify(documentContent))
                        : (selectedProposal.content || ""),
                      budgetEstimate: selectedProposal.budgetEstimate || undefined,
                      timelineEstimate: selectedProposal.timelineEstimate || "",
                      additionalInfo: selectedProposal.additionalInfo || {},
                    }}
                    requirements={selectedProposal.project.additionalInfoRequirements || []}
                    onSave={handleDirectSave}
                    onSubmit={handleSubmitProposal}
                  />
                )}

                {/* View Mode - Read-only Display */}
                {(viewMode === "view" || !isDraft) && (
                  <div className="space-y-6">
                    {/* Proposal Content */}
                    <Card className="p-6 border-yellow-400/20 overflow-hidden">
                      <div className="space-y-4 overflow-hidden">
                        <div className="overflow-hidden">
                          <h3 className="text-lg font-semibold text-black dark:text-white mb-2 wrap-break-word">
                            {(() => {
                              const title = selectedProposal.title
                              if (!title) return "Untitled Proposal"
                              if (typeof title === 'string' && (title.startsWith('{') || title.startsWith('['))) {
                                return "Untitled Proposal"
                              }
                              return title
                            })()}
                          </h3>
                          {(documentContent || selectedProposal.content) ? (
                            <div className="overflow-hidden">
                              <TipTapEditor
                                content={(() => {
                                  // Prefer document content from workspace_documents
                                  const content = documentContent || selectedProposal.content
                                  if (!content) return ""
                                  if (typeof content === 'string') {
                                    try {
                                      return JSON.parse(content) as JSONContent
                                    } catch {
                                      return content
                                    }
                                  }
                                  return content as JSONContent
                                })()}
                                editable={false}
                                minHeight="100px"
                                className="border-0"
                              />
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground">
                              No content provided yet.
                            </p>
                          )}
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
                    {!isDraft && (
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
                            ?.sort((a: AdditionalInfoRequirement, b: AdditionalInfoRequirement) => a.order - b.order)
                            .map((req: AdditionalInfoRequirement) => {
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

                {/* Chat Section (Mobile/Tablet) */}
                <div className="xl:hidden">
                  <div className="h-[500px]">
                    <ChatSection
                      projectId={selectedProposal.project.id}
                      proposalId={null}
                      projectTitle={selectedProposal.project.title}
                    />
                  </div>
                </div>
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

          {/* Chat Sidebar (Desktop) */}
          <aside className="hidden xl:block xl:col-span-3" aria-label="Client chat">
            <div className="sticky top-6">
              {selectedProposal ? (
                <div className="h-[calc(100vh-10rem)]">
                  <ChatSection
                    projectId={selectedProposal.project.id}
                    proposalId={null}
                    projectTitle={selectedProposal.project.title}
                  />
                </div>
              ) : (
                <Card className="p-6 border-yellow-400/20 text-center h-[400px] flex flex-col items-center justify-center">
                  <div className="p-4 bg-yellow-400/10 rounded-full mb-4">
                    <MessageSquare className="h-8 w-8 text-yellow-400" />
                  </div>
                  <h3 className="font-semibold text-black dark:text-white mb-2">
                    Client Chat
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Select a proposal to chat with the client
                  </p>
                </Card>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}
