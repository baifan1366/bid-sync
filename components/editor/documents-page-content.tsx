"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useUser } from "@/hooks/use-user"
import { useGraphQLQuery } from "@/hooks/use-graphql"
import { gql } from "graphql-request"
import { DocumentWorkspace } from "./document-workspace"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, AlertCircle, FileText } from "lucide-react"

interface Workspace {
  id: string
  projectId: string
  name: string
  description: string | null
}

const GET_LEAD_WORKSPACES = gql`
  query GetLeadWorkspaces($leadId: ID!) {
    leadProposals(leadId: $leadId) {
      id
      project {
        id
        title
      }
    }
  }
`

export function DocumentsPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, loading: userLoading } = useUser()
  const workspaceId = searchParams.get("workspace")

  // For now, if no workspace is selected, show a message
  // In a full implementation, you'd fetch available workspaces and let the user select one
  
  if (userLoading) {
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

  if (!workspaceId) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-[1800px]">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-black dark:text-white mb-2">Documents</h1>
          <p className="text-muted-foreground">
            Manage your collaborative proposal documents
          </p>
        </div>

        <Card className="p-12 border-yellow-400/20 text-center">
          <FileText className="h-12 w-12 text-yellow-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-black dark:text-white mb-2">
            No Workspace Selected
          </h3>
          <p className="text-muted-foreground mb-4">
            To access documents, please select a workspace from your proposals.
          </p>
          <Button
            onClick={() => router.push("/workspace")}
            className="bg-yellow-400 hover:bg-yellow-500 text-black"
          >
            Go to Workspace
          </Button>
        </Card>
      </div>
    )
  }

  return <DocumentWorkspace workspaceId={workspaceId} />
}
