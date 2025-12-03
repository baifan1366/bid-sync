"use client"

import * as React from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
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
import { cn } from "@/lib/utils"
import {
  Download,
  Trash2,
  File,
  FileText,
  Image as ImageIcon,
  FileSpreadsheet,
  Calendar,
  User,
  HardDrive,
  FileType,
} from "lucide-react"

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

interface DeliverablesListProps {
  deliverables: Deliverable[]
  onDownload: (deliverable: Deliverable) => Promise<void>
  onDelete?: (deliverableId: string) => Promise<void>
  canDelete?: boolean
  loading?: boolean
  className?: string
}

/**
 * DeliverablesList Component
 * 
 * Displays project deliverables with:
 * - Chronological ordering (oldest to newest)
 * - Metadata display (filename, size, type, uploader, date)
 * - Download buttons with signed URLs
 * - Delete functionality for team members
 * 
 * Requirements: 1.5, 3.2
 */
export function DeliverablesList({
  deliverables,
  onDownload,
  onDelete,
  canDelete = false,
  loading = false,
  className,
}: DeliverablesListProps) {
  const [downloadingId, setDownloadingId] = React.useState<string | null>(null)
  const [deletingId, setDeletingId] = React.useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const [deliverableToDelete, setDeliverableToDelete] = React.useState<Deliverable | null>(null)

  const handleDownload = async (deliverable: Deliverable) => {
    try {
      setDownloadingId(deliverable.id)
      await onDownload(deliverable)
    } catch (error) {
      console.error('Download error:', error)
    } finally {
      setDownloadingId(null)
    }
  }

  const handleDeleteClick = (deliverable: Deliverable) => {
    setDeliverableToDelete(deliverable)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!deliverableToDelete || !onDelete) return

    try {
      setDeletingId(deliverableToDelete.id)
      await onDelete(deliverableToDelete.id)
      setDeleteDialogOpen(false)
      setDeliverableToDelete(null)
    } catch (error) {
      console.error('Delete error:', error)
    } finally {
      setDeletingId(null)
    }
  }

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) {
      return <ImageIcon className="h-5 w-5 text-blue-500" />
    } else if (fileType.includes('spreadsheet') || fileType.includes('excel')) {
      return <FileSpreadsheet className="h-5 w-5 text-green-500" />
    } else if (fileType.includes('pdf')) {
      return <FileText className="h-5 w-5 text-red-500" />
    }
    return <File className="h-5 w-5 text-muted-foreground" />
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

  if (loading) {
    return (
      <div className={cn("space-y-3", className)}>
        {[1, 2, 3].map((i) => (
          <Card key={i} className="p-4 border-yellow-400/20 animate-pulse">
            <div className="flex items-start gap-3">
              <div className="h-5 w-5 bg-gray-300 dark:bg-gray-700 rounded" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-3/4" />
                <div className="h-3 bg-gray-300 dark:bg-gray-700 rounded w-1/2" />
              </div>
            </div>
          </Card>
        ))}
      </div>
    )
  }

  if (deliverables.length === 0) {
    return (
      <Card className={cn("p-8 border-yellow-400/20", className)}>
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <div className="p-3 rounded-full bg-yellow-400/10">
              <File className="h-8 w-8 text-yellow-400" />
            </div>
          </div>
          <p className="text-sm font-medium text-black dark:text-white">
            No deliverables uploaded yet
          </p>
          <p className="text-xs text-muted-foreground">
            Upload your final work products to complete the project
          </p>
        </div>
      </Card>
    )
  }

  // Requirement 1.5: Display deliverables in chronological order
  const sortedDeliverables = [...deliverables].sort((a, b) => {
    const dateA = typeof a.uploadedAt === 'string' ? new Date(a.uploadedAt) : a.uploadedAt
    const dateB = typeof b.uploadedAt === 'string' ? new Date(b.uploadedAt) : b.uploadedAt
    return dateA.getTime() - dateB.getTime()
  })

  return (
    <>
      <div className={cn("space-y-3", className)}>
        {sortedDeliverables.map((deliverable, index) => (
          <Card
            key={deliverable.id}
            className="p-4 border-yellow-400/20 hover:border-yellow-400/40 transition-colors"
          >
            <div className="space-y-3">
              {/* Header with file info */}
              <div className="flex items-start gap-3">
                {/* File Icon */}
                <div className="mt-0.5">{getFileIcon(deliverable.fileType)}</div>

                {/* File Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-medium text-black dark:text-white truncate">
                          {deliverable.fileName}
                        </p>
                        <Badge className="bg-yellow-400 text-black text-xs">
                          #{index + 1}
                        </Badge>
                      </div>
                      {deliverable.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                          {deliverable.description}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Metadata Grid - Requirement 1.5: Show metadata */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {/* File Size */}
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <HardDrive className="h-3.5 w-3.5" />
                      <span>{formatFileSize(deliverable.fileSize)}</span>
                    </div>

                    {/* File Type */}
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <FileType className="h-3.5 w-3.5" />
                      <span className="truncate">{deliverable.fileType}</span>
                    </div>

                    {/* Uploader */}
                    {deliverable.uploaderName && (
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <User className="h-3.5 w-3.5" />
                        <span className="truncate">{deliverable.uploaderName}</span>
                      </div>
                    )}

                    {/* Upload Date */}
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5" />
                      <span className="truncate">{formatDate(deliverable.uploadedAt)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions - Requirement 3.2: Download buttons with signed URLs */}
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => handleDownload(deliverable)}
                  disabled={downloadingId === deliverable.id}
                  className="flex-1 bg-yellow-400 hover:bg-yellow-500 text-black"
                  size="sm"
                >
                  <Download className="h-4 w-4 mr-2" />
                  {downloadingId === deliverable.id ? 'Downloading...' : 'Download'}
                </Button>

                {/* Delete button - Requirement 1.5: Delete functionality for team members */}
                {canDelete && onDelete && (
                  <Button
                    onClick={() => handleDeleteClick(deliverable)}
                    disabled={deletingId === deliverable.id}
                    variant="outline"
                    className="border-red-500/20 text-red-500 hover:bg-red-500/10 hover:border-red-500/40"
                    size="sm"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-white dark:bg-black border-yellow-400/20">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-black dark:text-white">
              Delete Deliverable
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deliverableToDelete?.fileName}"? This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-yellow-400/20">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deletingId !== null}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              {deletingId ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
