"use client"

import * as React from "react"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { DeliverableUpload } from "./deliverable-upload"
import { DeliverablesList, Deliverable } from "./deliverables-list"
import { ReadyForDeliveryButton } from "./ready-for-delivery-button"
import { useToast } from "@/components/ui/use-toast"

interface DeliverableManagementExampleProps {
  projectId: string
  proposalId: string
  initialDeliverables?: Deliverable[]
}

/**
 * DeliverableManagementExample Component
 * 
 * Example implementation showing how to use the deliverable management components together.
 * This demonstrates the complete workflow for:
 * 1. Uploading deliverables
 * 2. Viewing and managing deliverables
 * 3. Marking project ready for delivery
 * 
 * In a real implementation, you would:
 * - Use GraphQL mutations for upload/delete/markReady
 * - Fetch deliverables from the API
 * - Handle authentication and authorization
 * - Integrate with the project status system
 */
export function DeliverableManagementExample({
  projectId,
  proposalId,
  initialDeliverables = [],
}: DeliverableManagementExampleProps) {
  const [deliverables, setDeliverables] = React.useState<Deliverable[]>(initialDeliverables)
  const [loading, setLoading] = React.useState(false)
  const { toast } = useToast()

  // Handle file upload
  const handleUpload = async (file: File, description?: string) => {
    try {
      // In a real implementation, you would:
      // 1. Upload file to Supabase Storage
      // 2. Call uploadDeliverable GraphQL mutation
      // 3. Update the deliverables list
      
      // Simulated upload
      await new Promise(resolve => setTimeout(resolve, 1500))

      const newDeliverable: Deliverable = {
        id: `deliverable-${Date.now()}`,
        projectId,
        proposalId,
        uploadedBy: 'current-user-id',
        uploaderName: 'Current User',
        fileName: file.name,
        filePath: `${projectId}/${file.name}`,
        fileType: file.type,
        fileSize: file.size,
        description,
        version: 1,
        isFinal: false,
        uploadedAt: new Date(),
      }

      setDeliverables(prev => [...prev, newDeliverable])

      toast({
        title: "Deliverable uploaded",
        description: `${file.name} has been uploaded successfully.`,
      })
    } catch (error) {
      console.error('Upload error:', error)
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Failed to upload deliverable",
        variant: "destructive",
      })
      throw error
    }
  }

  // Handle file download
  const handleDownload = async (deliverable: Deliverable) => {
    try {
      // In a real implementation, you would:
      // 1. Call generateDownloadUrl from DeliverableService
      // 2. Open the signed URL in a new tab or trigger download
      
      toast({
        title: "Download started",
        description: `Downloading ${deliverable.fileName}...`,
      })

      // Simulated download
      await new Promise(resolve => setTimeout(resolve, 500))
      
      // In real implementation: window.open(signedUrl, '_blank')
    } catch (error) {
      console.error('Download error:', error)
      toast({
        title: "Download failed",
        description: error instanceof Error ? error.message : "Failed to download deliverable",
        variant: "destructive",
      })
      throw error
    }
  }

  // Handle file deletion
  const handleDelete = async (deliverableId: string) => {
    try {
      // In a real implementation, you would:
      // 1. Call deleteDeliverable GraphQL mutation
      // 2. Update the deliverables list
      
      // Simulated deletion
      await new Promise(resolve => setTimeout(resolve, 500))

      setDeliverables(prev => prev.filter(d => d.id !== deliverableId))

      toast({
        title: "Deliverable deleted",
        description: "The deliverable has been removed.",
      })
    } catch (error) {
      console.error('Delete error:', error)
      toast({
        title: "Delete failed",
        description: error instanceof Error ? error.message : "Failed to delete deliverable",
        variant: "destructive",
      })
      throw error
    }
  }

  // Handle marking ready for delivery
  const handleMarkReady = async () => {
    try {
      setLoading(true)

      // In a real implementation, you would:
      // 1. Call markReadyForDelivery GraphQL mutation
      // 2. Update project status
      // 3. Send notifications to client
      
      // Simulated API call
      await new Promise(resolve => setTimeout(resolve, 1000))

      toast({
        title: "Project marked ready",
        description: "The client has been notified that deliverables are ready for review.",
      })
    } catch (error) {
      console.error('Mark ready error:', error)
      toast({
        title: "Failed to mark ready",
        description: error instanceof Error ? error.message : "Failed to mark project ready",
        variant: "destructive",
      })
      throw error
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto p-6">
      <div>
        <h2 className="text-2xl font-bold text-black dark:text-white mb-2">
          Project Deliverables
        </h2>
        <p className="text-sm text-muted-foreground">
          Upload your final work products and mark the project ready for client review
        </p>
      </div>

      <Separator className="bg-yellow-400/20" />

      {/* Upload Section */}
      <Card className="p-6 border-yellow-400/20">
        <h3 className="text-lg font-semibold text-black dark:text-white mb-4">
          Upload Deliverables
        </h3>
        <DeliverableUpload
          projectId={projectId}
          proposalId={proposalId}
          onUpload={handleUpload}
        />
      </Card>

      {/* Deliverables List */}
      <Card className="p-6 border-yellow-400/20">
        <h3 className="text-lg font-semibold text-black dark:text-white mb-4">
          Uploaded Deliverables ({deliverables.length})
        </h3>
        <DeliverablesList
          deliverables={deliverables}
          onDownload={handleDownload}
          onDelete={handleDelete}
          canDelete={true}
        />
      </Card>

      {/* Ready for Delivery Button */}
      <Card className="p-6 border-yellow-400/20">
        <h3 className="text-lg font-semibold text-black dark:text-white mb-4">
          Submit for Review
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          Once you've uploaded all deliverables, mark the project ready for client review.
          The client will be notified and can accept the completion or request revisions.
        </p>
        <ReadyForDeliveryButton
          projectId={projectId}
          proposalId={proposalId}
          deliverablesCount={deliverables.length}
          onMarkReady={handleMarkReady}
          disabled={loading}
        />
      </Card>
    </div>
  )
}
