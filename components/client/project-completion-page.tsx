"use client"

import * as React from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { createGraphQLClient } from "@/lib/graphql/client"
import { CompletionReview, type Deliverable } from "./completion-review"
import { RevisionHistory, type CompletionRevision } from "./revision-history"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/components/ui/use-toast"
import { AlertCircle, CheckCircle2, Clock } from "lucide-react"

const GET_PROJECT_COMPLETION = `
  query GetProjectCompletion($projectId: ID!) {
    projectCompletion(projectId: $projectId) {
      id
      projectId
      proposalId
      reviewStatus
      reviewComments
      revisionCount
      deliverables {
        id
        projectId
        proposalId
        uploadedBy
        fileName
        filePath
        fileType
        fileSize
        description
        version
        isFinal
        uploadedAt
        uploadedBy {
          id
          fullName
        }
      }
      revisions {
        id
        revisionNumber
        requestedBy
        requestedAt
        revisionNotes
        resolvedBy
        resolvedAt
        requestedBy {
          id
          fullName
        }
        resolvedBy {
          id
          fullName
        }
      }
    }
  }
`

const ACCEPT_COMPLETION_MUTATION = `
  mutation AcceptCompletion($completionId: ID!, $comments: String) {
    acceptCompletion(completionId: $completionId, comments: $comments) {
      id
      reviewStatus
      completedAt
    }
  }
`

const REQUEST_REVISION_MUTATION = `
  mutation RequestRevision($completionId: ID!, $revisionNotes: String!) {
    requestRevision(input: {
      completionId: $completionId
      revisionNotes: $revisionNotes
    }) {
      id
      revisionNumber
      revisionNotes
      requestedAt
    }
  }
`

interface ProjectCompletionPageProps {
  projectId: string
}

/**
 * ProjectCompletionPage Component
 * 
 * Full-featured page for clients to review project deliverables and manage completion.
 * Integrates CompletionReview and RevisionHistory components with GraphQL.
 */
export function ProjectCompletionPage({ projectId }: ProjectCompletionPageProps) {
  const { toast } = useToast()
  const [activeTab, setActiveTab] = React.useState("review")

  // Fetch completion data
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["projectCompletion", projectId],
    queryFn: async () => {
      const client = createGraphQLClient()
      return await client.request<any>(GET_PROJECT_COMPLETION, { projectId })
    },
  })

  // Accept completion mutation
  const acceptMutation = useMutation({
    mutationFn: async ({ completionId, comments }: { completionId: string; comments?: string }) => {
      const client = createGraphQLClient()
      return await client.request(ACCEPT_COMPLETION_MUTATION, { completionId, comments })
    },
    onSuccess: () => {
      toast({
        title: "Project completed",
        description: "The project has been marked as completed successfully.",
      })
      refetch()
    },
    onError: (error: any) => {
      toast({
        title: "Failed to accept completion",
        description: error.message,
        variant: "destructive",
      })
    },
  })

  // Request revision mutation
  const revisionMutation = useMutation({
    mutationFn: async ({ completionId, revisionNotes }: { completionId: string; revisionNotes: string }) => {
      const client = createGraphQLClient()
      return await client.request(REQUEST_REVISION_MUTATION, { completionId, revisionNotes })
    },
    onSuccess: () => {
      toast({
        title: "Revisions requested",
        description: "The bidding team has been notified of the requested revisions.",
      })
      refetch()
    },
    onError: (error: any) => {
      toast({
        title: "Failed to request revisions",
        description: error.message,
        variant: "destructive",
      })
    },
  })

  const handleAccept = async (comments?: string) => {
    if (!data?.projectCompletion?.id) return
    await acceptMutation.mutateAsync({
      completionId: data.projectCompletion.id,
      comments,
    })
  }

  const handleRequestRevisions = async (revisionNotes: string) => {
    if (!data?.projectCompletion?.id) return
    await revisionMutation.mutateAsync({
      completionId: data.projectCompletion.id,
      revisionNotes,
    })
  }

  const handleDownload = async (deliverable: Deliverable) => {
    try {
      // Generate signed URL from Supabase Storage
      const client = createGraphQLClient()
      const response = await client.request<any>(
        `query GetDeliverableDownloadUrl($deliverableId: ID!) {
          deliverableDownloadUrl(deliverableId: $deliverableId)
        }`,
        { deliverableId: deliverable.id }
      )

      if (response.deliverableDownloadUrl) {
        window.open(response.deliverableDownloadUrl, '_blank')
      }
    } catch (error) {
      console.error('Download error:', error)
      throw error
    }
  }

  if (error) {
    return (
      <Card className="p-8 border-yellow-400/20">
        <div className="text-center space-y-3">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
          <h3 className="text-lg font-semibold text-black dark:text-white">
            Failed to load completion data
          </h3>
          <p className="text-sm text-muted-foreground">
            {error instanceof Error ? error.message : "An error occurred"}
          </p>
        </div>
      </Card>
    )
  }

  const completion = data?.projectCompletion
  const deliverables: Deliverable[] = completion?.deliverables?.map((d: any) => ({
    ...d,
    uploaderName: d.uploadedBy?.fullName,
  })) || []

  const revisions: CompletionRevision[] = completion?.revisions?.map((r: any) => ({
    ...r,
    requestedByName: r.requestedBy?.fullName,
    resolvedByName: r.resolvedBy?.fullName,
  })) || []

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <Badge className="bg-yellow-400 text-black">
            <Clock className="h-3 w-3 mr-1" />
            Pending Review
          </Badge>
        )
      case 'accepted':
        return (
          <Badge className="bg-green-500 text-white">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Completed
          </Badge>
        )
      case 'revision_requested':
        return (
          <Badge className="bg-orange-500 text-white">
            <AlertCircle className="h-3 w-3 mr-1" />
            Revisions Requested
          </Badge>
        )
      default:
        return null
    }
  }

  return (
    <div className="max-w-[1200px] mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-black dark:text-white mb-2">
            Project Completion Review
          </h1>
          <p className="text-muted-foreground">
            Review the submitted deliverables and manage the project completion
          </p>
        </div>
        {completion?.reviewStatus && getStatusBadge(completion.reviewStatus)}
      </div>

      {/* Stats */}
      {completion && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="p-4 border-yellow-400/20">
            <div className="text-center">
              <p className="text-2xl font-bold text-black dark:text-white">
                {deliverables.length}
              </p>
              <p className="text-xs text-muted-foreground">Deliverables</p>
            </div>
          </Card>
          <Card className="p-4 border-yellow-400/20">
            <div className="text-center">
              <p className="text-2xl font-bold text-black dark:text-white">
                {completion.revisionCount || 0}
              </p>
              <p className="text-xs text-muted-foreground">Revisions</p>
            </div>
          </Card>
          <Card className="p-4 border-yellow-400/20">
            <div className="text-center">
              <p className="text-2xl font-bold text-black dark:text-white">
                {revisions.filter((r) => r.resolvedAt).length}
              </p>
              <p className="text-xs text-muted-foreground">Resolved</p>
            </div>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-transparent border-b border-yellow-400/20 w-full justify-start rounded-none">
          <TabsTrigger
            value="review"
            className="data-[state=active]:bg-yellow-400 data-[state=active]:text-black"
          >
            Review Deliverables
          </TabsTrigger>
          <TabsTrigger
            value="history"
            className="data-[state=active]:bg-yellow-400 data-[state=active]:text-black"
          >
            Revision History ({revisions.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="review" className="mt-6">
          {completion ? (
            <CompletionReview
              projectId={projectId}
              completionId={completion.id}
              deliverables={deliverables}
              reviewComments={completion.reviewComments}
              onAccept={handleAccept}
              onRequestRevisions={handleRequestRevisions}
              onDownload={handleDownload}
              loading={isLoading}
            />
          ) : (
            <Card className="p-8 border-yellow-400/20">
              <div className="text-center space-y-2">
                <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto" />
                <p className="text-sm text-muted-foreground">
                  No completion data available for this project
                </p>
              </div>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <RevisionHistory revisions={revisions} loading={isLoading} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
