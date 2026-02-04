"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useUser } from "@/hooks/use-user"
import { useGraphQLQuery } from "@/hooks/use-graphql"
import { gql } from "graphql-request"
import { DocumentWorkspace } from "./document-workspace"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
   import { Badge } from "@/components/ui/badge"
import { Loader2, AlertCircle, FileText, FolderOpen, Clock, ExternalLink } from "lucide-react"

interface ProposalWithWorkspace {
  id: string
  title: string | null
  status: string
  project: {
    id: string
    title: string
    deadline: string | null
  }
}

interface WorkspaceWithDocuments {
  id: string
  projectId: string
  documents: Array<{
    id: string
    title: string
    updatedAt: string
  }>
}

const GET_LEAD_PROPOSALS_WITH_WORKSPACES = gql`
  query GetLeadProposalsWithWorkspaces($leadId: ID!) {
    leadProposals(leadId: $leadId) {
      id
      title
      status
      project {
        id
        title
        deadline
      }
    }
  }
`

const GET_MEMBER_PROPOSALS_WITH_WORKSPACES = gql`
  query GetMemberProposalsWithWorkspaces {
    myMemberProposals {
      id
      title
      status
      project {
        id
        title
        deadline
      }
    }
  }
`

const GET_WORKSPACE_BY_PROJECT = gql`
  query GetWorkspaceByProject($projectId: ID!) {
    workspaceByProject(projectId: $projectId) {
      id
      projectId
      documents {
        id
        title
        updatedAt
      }
    }
  }
`

export function DocumentsPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, loading: userLoading } = useUser()
  const workspaceId = searchParams.get("workspace")

  const isBiddingLead = user?.user_metadata?.role === 'bidding_lead'
  const isBiddingMember = user?.user_metadata?.role === 'bidding_member'
  const canAccessDocuments = isBiddingLead || isBiddingMember

  // Fetch proposals for the current lead
  const { data: leadData, isLoading: leadLoading } = useGraphQLQuery<{ 
    leadProposals: ProposalWithWorkspace[] 
  }>(
    ['lead-proposals-documents', user?.id || 'no-user'],
    GET_LEAD_PROPOSALS_WITH_WORKSPACES,
    { leadId: user?.id || 'placeholder' },
    {
      staleTime: 1 * 60 * 1000,
      enabled: !!user?.id && isBiddingLead,
    }
  )

  // Fetch proposals for members
  const { data: memberData, isLoading: memberLoading } = useGraphQLQuery<{ 
    myMemberProposals: ProposalWithWorkspace[] 
  }>(
    ['member-proposals-documents', user?.id || 'no-user'],
    GET_MEMBER_PROPOSALS_WITH_WORKSPACES,
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
  
  const proposalsLoading = isBiddingLead ? leadLoading : isBiddingMember ? memberLoading : false

  if (userLoading || proposalsLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-yellow-400" />
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="p-6 border-yellow-400/20">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-yellow-400" />
            <p className="text-muted-foreground">
              Please sign in to access documents.
            </p>
          </div>
        </Card>
      </div>
    )
  }

  if (!canAccessDocuments) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="p-6 border-yellow-400/20">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-yellow-400" />
            <p className="text-muted-foreground">
              Documents are only available for bidding team members.
            </p>
          </div>
        </Card>
      </div>
    )
  }

  if (workspaceId) {
    return <DocumentWorkspace workspaceId={workspaceId} />
  }

  // Show list of proposals with their documents
  return (
    <div className="container mx-auto px-4 py-8 max-w-[1800px]">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-black dark:text-white mb-2">Documents</h1>
        <p className="text-muted-foreground">
          {isBiddingMember 
            ? "Access documents for proposals you're part of" 
            : "Manage your collaborative proposal documents"}
        </p>
      </div>

      {proposals.length === 0 ? (
        <Card className="p-12 border-yellow-400/20 text-center">
          <FileText className="h-12 w-12 text-yellow-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-black dark:text-white mb-2">
            No Proposals Yet
          </h3>
          <p className="text-muted-foreground mb-4">
            You don't have any proposals yet. Start by creating a proposal for an open project.
          </p>
          <Button
            onClick={() => router.push("/lead-projects")}
            className="bg-yellow-400 hover:bg-yellow-500 text-black"
          >
            Browse Projects
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {proposals.map((proposal) => (
            <ProposalDocumentCard 
              key={proposal.id} 
              proposal={proposal} 
              router={router}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// Separate component to fetch workspace for each proposal
function ProposalDocumentCard({ 
  proposal, 
  router 
}: { 
  proposal: ProposalWithWorkspace
  router: ReturnType<typeof useRouter>
}) {
  const { data: workspaceData, isLoading } = useGraphQLQuery<{ 
    workspaceByProject: WorkspaceWithDocuments | null 
  }>(
    ['workspace-for-proposal', proposal.project.id],
    GET_WORKSPACE_BY_PROJECT,
    { projectId: proposal.project.id },
    {
      staleTime: 5 * 60 * 1000,
      enabled: !!proposal.project.id,
    }
  )

  const workspace = workspaceData?.workspaceByProject
  const documents = workspace?.documents || []
  const mainDocument = documents[0]

  const statusColors: Record<string, string> = {
    draft: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    submitted: "bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300",
    under_review: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300",
    pending_approval: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300",
    approved: "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300",
    accepted: "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300",
    rejected: "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-300",
  }

  const statusColor = statusColors[proposal.status.toLowerCase()] || statusColors.draft

  const handleOpenEditor = () => {
    if (mainDocument) {
      router.push(`/editor/${mainDocument.id}`)
    }
  }

  const handleOpenWorkspace = () => {
    router.push(`/workspace?proposal=${proposal.id}`)
  }

  return (
    <Card className="p-4 border-yellow-400/20 hover:border-yellow-400/40 transition-all">
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-black dark:text-white truncate">
              {proposal.project.title}
            </h3>
            <p className="text-sm text-muted-foreground truncate">
              {proposal.title || "Untitled Proposal"}
            </p>
          </div>
          <Badge className={statusColor}>
            {proposal.status.replace(/_/g, " ")}
          </Badge>
        </div>

        {proposal.project.deadline && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>Deadline: {new Date(proposal.project.deadline).toLocaleDateString()}</span>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Loading documents...</span>
          </div>
        ) : documents.length > 0 ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <FileText className="h-4 w-4 text-yellow-400" />
            <span>{documents.length} document{documents.length > 1 ? 's' : ''}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <FolderOpen className="h-4 w-4" />
            <span>No documents yet</span>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          {mainDocument && proposal.status.toLowerCase() === 'draft' && (
            <Button
              size="sm"
              onClick={handleOpenEditor}
              className="bg-yellow-400 hover:bg-yellow-500 text-black flex-1"
            >
              <FileText className="h-4 w-4 mr-2" />
              Open Editor
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={handleOpenWorkspace}
            className="border-yellow-400/20 hover:bg-yellow-400/10"
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  )
}
