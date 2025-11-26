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
  File,
  FileText,
  Image as ImageIcon,
  FileSpreadsheet,
  Download,
  Trash2,
  ExternalLink,
  Loader2,
  User,
  Calendar,
} from "lucide-react"
import type { ProposalDocument } from "@/lib/document-service"

interface DocumentListProps {
  documents: ProposalDocument[]
  onDelete?: (documentId: string) => Promise<void>
  onDownload?: (document: ProposalDocument) => void
  showActions?: boolean
  className?: string
}

/**
 * DocumentList Component
 * 
 * Displays a list of uploaded proposal documents with:
 * - File metadata (name, type, size, uploader, date)
 * - Download and delete actions
 * - Required document indicators
 * - File type icons
 * - Responsive layout
 * 
 * Requirements: 9.3, 9.4
 */
export function DocumentList({
  documents,
  onDelete,
  onDownload,
  showActions = true,
  className,
}: DocumentListProps) {
  const [deletingDocId, setDeletingDocId] = React.useState<string | null>(null)
  const [isDeleting, setIsDeleting] = React.useState(false)

  const handleDelete = async () => {
    if (!deletingDocId || !onDelete) return

    setIsDeleting(true)
    try {
      await onDelete(deletingDocId)
      setDeletingDocId(null)
    } catch (error) {
      console.error("Error deleting document:", error)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleDownload = (document: ProposalDocument) => {
    if (onDownload) {
      onDownload(document)
    } else {
      // Default download behavior
      window.open(document.url, '_blank')
    }
  }

  const getFileIcon = (docType: string) => {
    if (docType.startsWith('image/')) {
      return <ImageIcon className="h-5 w-5 text-blue-500" />
    } else if (docType.includes('spreadsheet') || docType.includes('excel')) {
      return <FileSpreadsheet className="h-5 w-5 text-green-500" />
    } else if (docType.includes('pdf')) {
      return <FileText className="h-5 w-5 text-red-500" />
    }
    return <File className="h-5 w-5 text-muted-foreground" />
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  }

  const getFileExtension = (fileName: string) => {
    const parts = fileName.split('.')
    return parts.length > 1 ? parts[parts.length - 1].toUpperCase() : 'FILE'
  }

  if (documents.length === 0) {
    return (
      <Card className={cn("p-8 border-yellow-400/20 text-center", className)}>
        <File className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
        <p className="text-muted-foreground">No documents uploaded yet</p>
      </Card>
    )
  }

  return (
    <div className={cn("space-y-3", className)}>
      {documents.map((document) => (
        <Card
          key={document.id}
          className="p-4 border-yellow-400/20 hover:border-yellow-400/40 transition-colors"
        >
          <div className="flex items-start gap-3">
            {/* File Icon */}
            <div className="mt-0.5">{getFileIcon(document.docType)}</div>

            {/* Document Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-sm font-medium text-black dark:text-white truncate">
                      {document.fileName}
                    </h4>
                    {document.isRequired && (
                      <Badge className="bg-red-500 text-white text-xs">
                        Required
                      </Badge>
                    )}
                    <Badge
                      variant="outline"
                      className="border-yellow-400/20 text-xs"
                    >
                      {getFileExtension(document.fileName)}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(document.fileSize)}
                  </p>
                </div>

                {/* Actions */}
                {showActions && (
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDownload(document)}
                      className="h-8 w-8 p-0"
                      title="Download"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => window.open(document.url, '_blank')}
                      className="h-8 w-8 p-0"
                      title="Open in new tab"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                    {onDelete && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setDeletingDocId(document.id)}
                        className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {/* Metadata */}
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  <span>Uploaded by {document.uploadedBy}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  <span>
                    {new Date(document.uploadedAt).toLocaleDateString()} at{' '}
                    {new Date(document.uploadedAt).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </Card>
      ))}

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deletingDocId}
        onOpenChange={(open) => !open && setDeletingDocId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Document</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this document? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Document"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
