"use client"

import * as React from "react"
import { CompletionReview, type Deliverable } from "./completion-review"
import { RevisionHistory, type CompletionRevision } from "./revision-history"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card } from "@/components/ui/card"

/**
 * Example usage of CompletionReview and RevisionHistory components
 * 
 * This demonstrates how to integrate these components into a client project view
 * for reviewing deliverables and managing project completion.
 */
export function CompletionReviewExample() {
  const [activeTab, setActiveTab] = React.useState("review")

  // Example deliverables data
  const deliverables: Deliverable[] = [
    {
      id: "del-1",
      projectId: "proj-123",
      proposalId: "prop-456",
      uploadedBy: "user-789",
      uploaderName: "John Smith",
      fileName: "final-design-mockups.pdf",
      filePath: "deliverables/proj-123/final-design-mockups.pdf",
      fileType: "application/pdf",
      fileSize: 5242880, // 5MB
      description: "Complete UI/UX design mockups for all application screens",
      version: 1,
      isFinal: true,
      uploadedAt: new Date("2024-01-15T10:30:00Z"),
    },
    {
      id: "del-2",
      projectId: "proj-123",
      proposalId: "prop-456",
      uploadedBy: "user-789",
      uploaderName: "Jane Doe",
      fileName: "source-code.zip",
      filePath: "deliverables/proj-123/source-code.zip",
      fileType: "application/zip",
      fileSize: 15728640, // 15MB
      description: "Complete source code with documentation and tests",
      version: 1,
      isFinal: true,
      uploadedAt: new Date("2024-01-15T14:45:00Z"),
    },
    {
      id: "del-3",
      projectId: "proj-123",
      proposalId: "prop-456",
      uploadedBy: "user-789",
      uploaderName: "John Smith",
      fileName: "deployment-guide.pdf",
      filePath: "deliverables/proj-123/deployment-guide.pdf",
      fileType: "application/pdf",
      fileSize: 1048576, // 1MB
      description: "Step-by-step deployment and configuration guide",
      version: 1,
      isFinal: true,
      uploadedAt: new Date("2024-01-15T16:00:00Z"),
    },
  ]

  // Example revision history data
  const revisions: CompletionRevision[] = [
    {
      id: "rev-1",
      revisionNumber: 1,
      requestedBy: "client-123",
      requestedByName: "Alice Johnson",
      requestedAt: new Date("2024-01-10T09:00:00Z"),
      revisionNotes:
        "The design mockups need to include dark mode variants for all screens. Also, please add accessibility annotations showing WCAG compliance.",
      resolvedBy: "user-789",
      resolvedByName: "John Smith",
      resolvedAt: new Date("2024-01-12T15:30:00Z"),
    },
    {
      id: "rev-2",
      revisionNumber: 2,
      requestedBy: "client-123",
      requestedByName: "Alice Johnson",
      requestedAt: new Date("2024-01-13T11:00:00Z"),
      revisionNotes:
        "The deployment guide is missing information about database migration steps and environment variable configuration. Please add these sections.",
      resolvedBy: "user-789",
      resolvedByName: "Jane Doe",
      resolvedAt: new Date("2024-01-14T10:00:00Z"),
    },
  ]

  const handleDownload = async (deliverable: Deliverable) => {
    // Simulate download
    console.log("Downloading:", deliverable.fileName)
    await new Promise((resolve) => setTimeout(resolve, 1000))
    alert(`Downloaded: ${deliverable.fileName}`)
  }

  const handleAccept = async (comments?: string) => {
    // Simulate accepting completion
    console.log("Accepting completion with comments:", comments)
    await new Promise((resolve) => setTimeout(resolve, 1500))
    alert("Project marked as completed!")
  }

  const handleRequestRevisions = async (revisionNotes: string) => {
    // Simulate requesting revisions
    console.log("Requesting revisions:", revisionNotes)
    await new Promise((resolve) => setTimeout(resolve, 1500))
    alert("Revisions requested. The team has been notified.")
  }

  return (
    <div className="max-w-[1200px] mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-black dark:text-white mb-2">
          Project Completion Review
        </h1>
        <p className="text-muted-foreground">
          Review the submitted deliverables and manage revision requests
        </p>
      </div>

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
            Revision History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="review" className="mt-6">
          <CompletionReview
            projectId="proj-123"
            completionId="comp-789"
            deliverables={deliverables}
            onAccept={handleAccept}
            onRequestRevisions={handleRequestRevisions}
            onDownload={handleDownload}
          />
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <RevisionHistory revisions={revisions} />
        </TabsContent>
      </Tabs>

      {/* Usage Instructions */}
      <Card className="p-6 border-yellow-400/20 bg-yellow-400/5">
        <h3 className="text-lg font-semibold text-black dark:text-white mb-3">
          Integration Guide
        </h3>
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>
            <strong className="text-black dark:text-white">CompletionReview:</strong> Use this
            component to display deliverables for client review. It provides download functionality
            and options to accept completion or request revisions.
          </p>
          <p>
            <strong className="text-black dark:text-white">RevisionHistory:</strong> Use this
            component to display the chronological history of revision requests, including notes
            and resolution status.
          </p>
          <p>
            <strong className="text-black dark:text-white">Integration:</strong> These components
            can be used together in a tabbed interface or separately depending on your UI needs.
            They work with GraphQL queries/mutations for real data.
          </p>
        </div>
      </Card>
    </div>
  )
}
