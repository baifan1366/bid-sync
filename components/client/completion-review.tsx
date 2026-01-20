"use client"

import * as React from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
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
import { useToast } from "@/components/ui/use-toast"
import {
  CheckCircle2,
  XCircle,
  Download,
  FileText,
  Calendar,
  User,
  HardDrive,
  FileType,
  Loader2,
  AlertCircle,
} from "lucide-react"
import { cn } from "@/lib/utils"

export interface Deliverable {
  id: string
  projectId: string
  proposalId: string
  uploadedBy: string
  uploaderName?: string
  fileName: string
  filePath: string
  fileType: string
  fileSize: number
  description?: string
  version: number
  isFinal: boolean
  uploadedAt: Date | string
}

export interface CompletionReviewProps {
  projectId: string
  completionId: string
  deliverables: Deliverable[]
  reviewComments?: string
  onAccept: (comments?: string) => Promise<void>
  onRequestRevisions: (revisionNotes: string) => Promise<void>
  onDownload: (deliverable: Deliverable) => Promise<void>
  loading?: boolean
  className?: string
}

/**
 * CompletionReview Component
 * 
 * Displays deliverables for client review with options to accept or request revisions.
 * 
 * Requirements:
 * - 3.1: Display all deliverables with download links
 * - 3.4: Provide options to accept completion or request revisions
 * - 3.5: Allow adding review comments
 * - 4.1: Accept completion button
 * - 5.1, 5.2: Request revisions button with required notes
 */
export function CompletionReview({
  projectId,
  completionId,
  deliverables,
  reviewComments: initialComments,
  onAccept,
  onRequestRevisions,
  onDownload,
  loading = false,
  className,
}: CompletionReviewProps) {
  const { toast } = useToast()
  const [reviewComments, setReviewComments] = React.useState(initialComments || "")
  const [revisionNotes, setRevisionNotes] = React.useState("")
  const [downloadingId, setDownloadingId] = React.useState<string | null>(null)
  const [acceptDialogOpen, setAcceptDialogOpen] = React.useState(false)
  const [revisionDialogOpen, setRevisionDialogOpen] = React.useState(false)
  const [isAccepting, setIsAccepting] = React.useState(false)
  const [isRequestingRevision, setIsRequestingRevision] = React.useState(false)

  const handleDownload = async (deliverable: Deliverable) => {
    try {
      setDownloadingId(deliverable.id)
      await onDownload(deliverable)
    } catch (error) {
      console.error('Download error:', error)
      toast({
        title: "Download failed",
        description: error instanceof Error ? error.message : "Failed to download file",
        variant: "destructive",
      })
    } finally {
      setDownloadingId(null)
    }
  }

  const handleAcceptClick = () => {
    setAcceptDialogOpen(true)
  }

  const handleAcceptConfirm = async () => {
    try {
      setIsAccepting(true)
      await onAccept(reviewComments.trim() || undefined)
      toast({
        title: "Project completed",
        description: "The project has been marked as completed successfully.",
      })
      setAcceptDialogOpen(false)
    } catch (error) {
      console.error('Accept error:', error)
      toast({
        title: "Failed to accept completion",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      })
    } finally {
      setIsAccepting(false)
    }
  }

  const handleRequestRevisionsClick = () => {
    setRevisionDialogOpen(true)
  }

  const handleRequestRevisionsConfirm = async () => {
    // Requirement 5.2: Revision notes are required
    if (!revisionNotes.trim()) {
      toast({
        title: "Revision notes required",
        description: "Please provide notes explaining what needs to be revised.",
        variant: "destructive",
      })
      return
    }

    try {
      setIsRequestingRevision(true)
      await onRequestRevisions(revisionNotes.trim())
      toast({
        title: "Revisions requested",
        description: "The bidding team has been notified of the requested revisions.",
      })
      setRevisionDialogOpen(false)
      setRevisionNotes("")
    } catch (error) {
      console.error('Request revision error:', error)
      toast({
        title: "Failed to request revisions",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      })
    } finally {
      setIsRequestingRevision(false)
    }
  }

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) {
      return <FileText className="h-5 w-5 text-blue-500" />
    } else if (fileType.includes('pdf')) {
      return <FileText className="h-5 w-5 text-red-500" />
    }
    return <FileText className="h-5 w-5 text-yellow-400" />
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  }

  const formatDate = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d)
  }

  // Sort deliverables chronologically
  const sortedDeliverables = [...deliverables].sort((a, b) => {
    const dateA = typeof a.uploadedAt === 'string' ? new Date(a.uploadedAt) : a.uploadedAt
    const dateB = typeof b.uploadedAt === 'string' ? new Date(b.uploadedAt) : b.uploadedAt
    return dateA.getTime() - dateB.getTime()
  })

  if (loading) {
    return <CompletionReviewSkeleton />
  }

  return (
    <>
      <Card className={cn("border-yellow-400/20", className)}>
        <div className="p-6 space-y-6">
          {/* Header */}
          <div>
            <h3 className="text-lg font-semibold text-black dark:text-white mb-2">
              Review Deliverables
            </h3>
            <p className="text-sm text-muted-foreground">
              Review the submitted deliverables and decide whether to accept the completion or request revisions.
            </p>
          </div>

          {/* Deliverables List - Requirement 3.1: Display all deliverables with download links */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-medium text-black dark:text-white">
                Submitted Deliverables
              </h4>
              <Badge className="bg-yellow-400 text-black">
                {sortedDeliverables.length} {sortedDeliverables.length === 1 ? 'file' : 'files'}
              </Badge>
            </div>

            {sortedDeliverables.length === 0 ? (
              <div className="text-center py-8 border border-yellow-400/20 rounded-lg">
                <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No deliverables submitted</p>
              </div>
            ) : (
              <div className="space-y-3">
                {sortedDeliverables.map((deliverable, index) => (
                  <Card
                    key={deliverable.id}
                    className="p-4 border-yellow-400/20 hover:border-yellow-400/40 transition-colors"
                  >
                    <div className="space-y-3">
                      {/* File Info */}
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5">{getFileIcon(deliverable.fileType)}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-sm font-medium text-black dark:text-white truncate">
                              {deliverable.fileName}
                            </p>
                            <Badge variant="outline" className="text-xs border-yellow-400/40">
                              #{index + 1}
                            </Badge>
                          </div>
                          {deliverable.description && (
                            <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                              {deliverable.description}
                            </p>
                          )}

                          {/* Metadata */}
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <HardDrive className="h-3.5 w-3.5" />
                              <span>{formatFileSize(deliverable.fileSize)}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <FileType className="h-3.5 w-3.5" />
                              <span className="truncate">{deliverable.fileType}</span>
                            </div>
                            {deliverable.uploaderName && (
                              <div className="flex items-center gap-1.5 text-muted-foreground">
                                <User className="h-3.5 w-3.5" />
                                <span className="truncate">{deliverable.uploaderName}</span>
                              </div>
                            )}
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <Calendar className="h-3.5 w-3.5" />
                              <span className="truncate">{formatDate(deliverable.uploadedAt)}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Download Button */}
                      <Button
                        onClick={() => handleDownload(deliverable)}
                        disabled={downloadingId === deliverable.id}
                        className="w-full bg-yellow-400 hover:bg-yellow-500 text-black"
                        size="sm"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        {downloadingId === deliverable.id ? 'Downloading...' : 'Download'}
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Review Comments - Requirement 3.5: Review comments textarea */}
          <div>
            <label
              htmlFor="review-comments"
              className="block text-sm font-medium text-black dark:text-white mb-2"
            >
              Review Comments (Optional)
            </label>
            <Textarea
              id="review-comments"
              value={reviewComments}
              onChange={(e) => setReviewComments(e.target.value)}
              placeholder="Add any comments about the deliverables..."
              className="border-yellow-400/20 focus-visible:ring-yellow-400 min-h-[100px]"
              rows={4}
            />
            <p className="text-xs text-muted-foreground mt-1">
              These comments will be saved with your review decision.
            </p>
          </div>

          {/* Action Buttons - Requirements 3.4, 4.1, 5.1 */}
          <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-yellow-400/20">
            <Button
              onClick={handleAcceptClick}
              disabled={sortedDeliverables.length === 0}
              className="flex-1 bg-green-500 hover:bg-green-600 text-white"
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Accept Completion
            </Button>
            <Button
              onClick={handleRequestRevisionsClick}
              disabled={sortedDeliverables.length === 0}
              variant="outline"
              className="flex-1 border-yellow-400/40 hover:bg-yellow-400/10"
            >
              <XCircle className="h-4 w-4 mr-2" />
              Request Revisions
            </Button>
          </div>
        </div>
      </Card>

      {/* Accept Completion Dialog */}
      <AlertDialog open={acceptDialogOpen} onOpenChange={setAcceptDialogOpen}>
        <AlertDialogContent className="bg-white dark:bg-black border-yellow-400/20">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-black dark:text-white">
              Accept Project Completion
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to accept this project as completed? This will mark the project
              as finished and trigger the archival process. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-yellow-400/20" disabled={isAccepting}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleAcceptConfirm}
              disabled={isAccepting}
              className="bg-green-500 hover:bg-green-600 text-white"
            >
              {isAccepting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Accepting...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Accept Completion
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Request Revisions Dialog - Requirement 5.2: Require revision notes */}
      <AlertDialog open={revisionDialogOpen} onOpenChange={setRevisionDialogOpen}>
        <AlertDialogContent className="bg-white dark:bg-black border-yellow-400/20">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-black dark:text-white">
              Request Revisions
            </AlertDialogTitle>
            <AlertDialogDescription>
              Please provide detailed notes explaining what needs to be revised. The bidding team
              will be notified and can upload updated deliverables.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <label
              htmlFor="revision-notes"
              className="block text-sm font-medium text-black dark:text-white mb-2"
            >
              Revision Notes <span className="text-red-500">*</span>
            </label>
            <Textarea
              id="revision-notes"
              value={revisionNotes}
              onChange={(e) => setRevisionNotes(e.target.value)}
              placeholder="Describe what needs to be changed or improved..."
              className="border-yellow-400/20 focus-visible:ring-yellow-400 min-h-[120px]"
              rows={5}
            />
            {revisionNotes.trim().length === 0 && (
              <p className="text-xs text-red-500 mt-1">
                Revision notes are required
              </p>
            )}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-yellow-400/20" disabled={isRequestingRevision}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRequestRevisionsConfirm}
              disabled={isRequestingRevision || !revisionNotes.trim()}
              className="bg-yellow-400 hover:bg-yellow-500 text-black"
            >
              {isRequestingRevision ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Requesting...
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4 mr-2" />
                  Request Revisions
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
