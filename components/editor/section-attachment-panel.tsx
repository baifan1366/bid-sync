'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import {
  X,
  Upload,
  Paperclip,
  Download,
  Trash2,
  File,
  FileText,
  Image as ImageIcon,
  FileSpreadsheet,
  FileCode,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { SectionAttachmentService, type SectionAttachment } from '@/lib/section-attachment-service'
import { useToast } from '@/components/ui/use-toast'

interface SectionAttachmentPanelProps {
  sectionId: string
  documentId: string
  currentUserId: string
  isLead: boolean
  canUpload?: boolean // Whether user can upload files (editor/owner/team member)
  onClose: () => void
}

/**
 * Section Attachment Panel Component
 * 
 * Displays and manages file attachments for a specific section.
 * Similar to Microsoft Teams attachments with upload, download, and delete.
 * 
 * Features:
 * - All team members can view and download attachments
 * - Team members with editor role can upload attachments
 * - Only uploader and lead can delete attachments
 */
export function SectionAttachmentPanel({
  sectionId,
  documentId,
  currentUserId,
  isLead,
  canUpload = true,
  onClose,
}: SectionAttachmentPanelProps) {
  const [attachments, setAttachments] = useState<SectionAttachment[]>([])
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { toast } = useToast()

  useEffect(() => {
    loadAttachments()
  }, [sectionId])

  const loadAttachments = async () => {
    setLoading(true)
    const result = await SectionAttachmentService.getSectionAttachments(sectionId, currentUserId)
    if (result.success && result.attachments) {
      setAttachments(result.attachments)
    }
    setLoading(false)
  }

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    const file = files[0]

    // Validate file
    const validation = SectionAttachmentService.validateFile(file)
    if (!validation.valid) {
      toast({
        title: 'Invalid file',
        description: validation.error,
        variant: 'destructive',
      })
      return
    }

    setUploading(true)

    const result = await SectionAttachmentService.uploadAttachment(
      {
        sectionId,
        documentId,
        file,
      },
      currentUserId
    )

    setUploading(false)

    if (result.success) {
      await loadAttachments()
      toast({
        title: 'File uploaded',
        description: `${file.name} has been uploaded successfully`,
      })
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } else {
      toast({
        title: 'Upload failed',
        description: result.error || 'Failed to upload file',
        variant: 'destructive',
      })
    }
  }

  const handleDownload = (attachment: SectionAttachment) => {
    if (attachment.downloadUrl) {
      window.open(attachment.downloadUrl, '_blank')
    }
  }

  const handleDelete = async (attachmentId: string, fileName: string) => {
    const result = await SectionAttachmentService.deleteAttachment(attachmentId, currentUserId)

    if (result.success) {
      await loadAttachments()
      toast({
        title: 'File deleted',
        description: `${fileName} has been deleted`,
      })
    } else {
      toast({
        title: 'Delete failed',
        description: result.error || 'Failed to delete file',
        variant: 'destructive',
      })
    }
  }

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) {
      return <ImageIcon className="h-8 w-8 text-blue-500" />
    } else if (fileType.includes('pdf')) {
      return <FileText className="h-8 w-8 text-red-500" />
    } else if (fileType.includes('spreadsheet') || fileType.includes('excel')) {
      return <FileSpreadsheet className="h-8 w-8 text-green-500" />
    } else if (fileType.includes('word') || fileType.includes('document')) {
      return <FileText className="h-8 w-8 text-blue-600" />
    } else if (fileType.includes('text')) {
      return <FileCode className="h-8 w-8 text-gray-500" />
    }
    return <File className="h-8 w-8 text-gray-500" />
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 p-4 border-b border-yellow-400/20">
        <Paperclip className="h-5 w-5 text-yellow-400" />
        <h3 className="font-semibold">Attachments</h3>
        <Badge className="bg-yellow-400 text-black">{attachments.length}</Badge>
      </div>

      {/* Upload Area - Only show if user can upload */}
      {canUpload && (
        <div className="p-4 border-b border-yellow-400/20">
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileSelect}
            className="hidden"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.webp,.txt,.csv,.zip"
          />
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="w-full bg-yellow-400 hover:bg-yellow-500 text-black"
          >
            {uploading ? (
              <>
                <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-black border-t-transparent" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Upload File
              </>
            )}
          </Button>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Max file size: 100MB
          </p>
        </div>
      )}

      {/* Attachments List */}
      <ScrollArea className="flex-1 p-4">
        {loading ? (
          <div className="text-center text-muted-foreground py-8">Loading attachments...</div>
        ) : attachments.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            <Paperclip className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>No attachments yet</p>
            {canUpload && <p className="text-sm">Upload files to share with your team</p>}
          </div>
        ) : (
          <div className="space-y-2">
            {attachments.map((attachment) => {
              const isOwner = attachment.uploadedBy === currentUserId

              return (
                <div
                  key={attachment.id}
                  className="p-3 rounded-lg border border-yellow-400/20 hover:border-yellow-400/40 transition-colors bg-white dark:bg-black"
                >
                  <div className="flex items-start gap-3">
                    {/* File Icon */}
                    <div className="shrink-0">
                      {getFileIcon(attachment.fileType)}
                    </div>

                    {/* File Info and Actions */}
                    <div className="flex-1 min-w-0">
                      {/* File Name */}
                      <button
                        onClick={() => handleDownload(attachment)}
                        className="font-medium text-sm truncate hover:text-yellow-400 transition-colors text-left w-full block"
                        title="Click to download"
                      >
                        {attachment.fileName}
                      </button>
                      
                      {/* File Metadata */}
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(attachment.fileSize)}
                        </p>
                        <span className="text-xs text-muted-foreground">•</span>
                        <p className="text-xs text-muted-foreground">
                          {attachment.uploader?.name || 'Unknown'}
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(attachment.createdAt).toLocaleString()}
                      </p>
                      {attachment.description && (
                        <p className="text-xs text-muted-foreground mt-1 italic">
                          {attachment.description}
                        </p>
                      )}

                      {/* Action Buttons */}
                      <div className="flex items-center gap-2 mt-2">
                        {/* Download Button - Always visible for all users */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDownload(attachment)}
                          className="h-7 px-2 text-xs border-yellow-400 text-yellow-400 hover:bg-yellow-400 hover:text-black"
                          title="Download file"
                        >
                          <Download className="h-3.5 w-3.5 mr-1" />
                          Download
                        </Button>

                        {/* Delete Button - Only for owner or lead */}
                        {(isOwner || isLead) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              if (confirm(`Are you sure you want to delete ${attachment.fileName}?`)) {
                                handleDelete(attachment.id, attachment.fileName)
                              }
                            }}
                            className="h-7 px-2 text-xs text-red-500 hover:bg-red-500/10 hover:text-red-600"
                            title="Delete file"
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-1" />
                            Delete
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </ScrollArea>

      {/* Footer Info */}
      <div className="p-4 border-t border-yellow-400/20">
        <p className="text-xs text-muted-foreground text-center">
          Supported formats: PDF, Word, Excel, PowerPoint, Images, Text, CSV, ZIP
        </p>
      </div>
    </div>
  )
}
