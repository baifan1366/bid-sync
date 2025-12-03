"use client"

import * as React from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"
import {
  Upload,
  File,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  FileText,
  Image as ImageIcon,
  FileSpreadsheet,
} from "lucide-react"

interface DeliverableUploadProps {
  projectId: string
  proposalId: string
  onUpload: (file: File, description?: string) => Promise<void>
  disabled?: boolean
  className?: string
}

interface FileItem {
  file: File
  description: string
  status: 'pending' | 'uploading' | 'success' | 'error'
  progress: number
  error?: string
}

/**
 * DeliverableUpload Component
 * 
 * Handles final deliverable uploads for project completion with:
 * - Drag and drop support
 * - File size validation (100MB limit)
 * - Description input field
 * - Upload progress indication
 * - Visual feedback for upload status
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4
 */
export function DeliverableUpload({
  projectId,
  proposalId,
  onUpload,
  disabled = false,
  className,
}: DeliverableUploadProps) {
  const [isDragging, setIsDragging] = React.useState(false)
  const [uploadQueue, setUploadQueue] = React.useState<FileItem[]>([])
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  // Maximum file size: 100MB (Requirement 1.3)
  const MAX_FILE_SIZE = 100 * 1024 * 1024

  const validateFile = (file: File): { valid: boolean; error?: string } => {
    // Requirement 1.3: Check file size (100MB limit)
    if (file.size > MAX_FILE_SIZE) {
      return {
        valid: false,
        error: `File size ${(file.size / 1024 / 1024).toFixed(2)}MB exceeds maximum 100MB`,
      }
    }

    if (file.size === 0) {
      return {
        valid: false,
        error: 'File is empty',
      }
    }

    return { valid: true }
  }

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0 || disabled) return

    const newFiles = Array.from(files).map((file) => ({
      file,
      description: '',
      status: 'pending' as const,
      progress: 0,
    }))

    setUploadQueue((prev) => [...prev, ...newFiles])
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    if (!disabled) {
      setIsDragging(true)
    }
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    handleFiles(e.dataTransfer.files)
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files)
    // Reset input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const updateDescription = (file: File, description: string) => {
    setUploadQueue((prev) =>
      prev.map((item) =>
        item.file === file ? { ...item, description } : item
      )
    )
  }

  const uploadFile = async (fileItem: FileItem) => {
    const validation = validateFile(fileItem.file)

    if (!validation.valid) {
      setUploadQueue((prev) =>
        prev.map((item) =>
          item.file === fileItem.file
            ? { ...item, status: 'error', error: validation.error }
            : item
        )
      )
      return
    }

    // Update status to uploading
    setUploadQueue((prev) =>
      prev.map((item) =>
        item.file === fileItem.file
          ? { ...item, status: 'uploading', progress: 0 }
          : item
      )
    )

    try {
      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadQueue((prev) =>
          prev.map((item) =>
            item.file === fileItem.file && item.progress < 90
              ? { ...item, progress: item.progress + 10 }
              : item
          )
        )
      }, 200)

      // Requirement 1.4: Pass description with upload
      await onUpload(fileItem.file, fileItem.description || undefined)

      clearInterval(progressInterval)

      // Update status to success
      setUploadQueue((prev) =>
        prev.map((item) =>
          item.file === fileItem.file
            ? { ...item, status: 'success', progress: 100 }
            : item
        )
      )

      // Remove from queue after 2 seconds
      setTimeout(() => {
        setUploadQueue((prev) => prev.filter((item) => item.file !== fileItem.file))
      }, 2000)
    } catch (error) {
      console.error('Upload error:', error)
      setUploadQueue((prev) =>
        prev.map((item) =>
          item.file === fileItem.file
            ? {
                ...item,
                status: 'error',
                error: error instanceof Error ? error.message : 'Upload failed',
              }
            : item
        )
      )
    }
  }

  const removeFromQueue = (file: File) => {
    setUploadQueue((prev) => prev.filter((item) => item.file !== file))
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

  return (
    <div className={cn("space-y-4", className)}>
      {/* Upload Area - Requirement 1.1: File upload interface with drag-and-drop */}
      <Card
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "p-8 border-2 border-dashed transition-colors",
          disabled
            ? "opacity-50 cursor-not-allowed"
            : "cursor-pointer",
          isDragging && !disabled
            ? "border-yellow-400 bg-yellow-400/10"
            : "border-yellow-400/20 hover:border-yellow-400/40"
        )}
        onClick={() => !disabled && fileInputRef.current?.click()}
      >
        <div className="flex flex-col items-center justify-center text-center space-y-3">
          <div className="p-3 rounded-full bg-yellow-400/10">
            <Upload className="h-8 w-8 text-yellow-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-black dark:text-white">
              Drop deliverable files here or click to browse
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Maximum file size: 100MB per file
            </p>
            <p className="text-xs text-muted-foreground">
              All file types accepted
            </p>
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileInputChange}
          className="hidden"
          disabled={disabled}
        />
      </Card>

      {/* Upload Queue */}
      {uploadQueue.length > 0 && (
        <div className="space-y-3">
          {uploadQueue.map((item, index) => (
            <Card
              key={`${item.file.name}-${index}`}
              className="p-4 border-yellow-400/20"
            >
              <div className="space-y-3">
                {/* File Info Header */}
                <div className="flex items-start gap-3">
                  {/* File Icon */}
                  <div className="mt-0.5">{getFileIcon(item.file.type)}</div>

                  {/* File Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-black dark:text-white truncate">
                          {item.file.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(item.file.size)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {item.status === 'uploading' && (
                          <Loader2 className="h-4 w-4 animate-spin text-yellow-400" />
                        )}
                        {item.status === 'success' && (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        )}
                        {item.status === 'error' && (
                          <AlertCircle className="h-4 w-4 text-red-500" />
                        )}
                        {(item.status === 'pending' || item.status === 'error') && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation()
                              removeFromQueue(item.file)
                            }}
                            className="h-6 w-6 p-0"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Progress Bar - Requirement 1.1: Upload progress indicator */}
                    {item.status === 'uploading' && (
                      <Progress value={item.progress} className="h-1" />
                    )}

                    {/* Error Message - Requirement 1.3: File size validation feedback */}
                    {item.status === 'error' && item.error && (
                      <p className="text-xs text-red-500 mt-1">{item.error}</p>
                    )}

                    {/* Success Message */}
                    {item.status === 'success' && (
                      <p className="text-xs text-green-500 mt-1">Upload complete</p>
                    )}
                  </div>
                </div>

                {/* Description Input - Requirement 1.1, 1.4: Description input field */}
                {item.status === 'pending' && (
                  <div className="space-y-2">
                    <Label htmlFor={`description-${index}`} className="text-xs">
                      Description (optional)
                    </Label>
                    <Textarea
                      id={`description-${index}`}
                      placeholder="Add a description for this deliverable..."
                      value={item.description}
                      onChange={(e) => updateDescription(item.file, e.target.value)}
                      className="min-h-[60px] text-sm border-yellow-400/20 focus:border-yellow-400"
                      disabled={disabled}
                    />
                    <Button
                      onClick={() => uploadFile(item)}
                      className="w-full bg-yellow-400 hover:bg-yellow-500 text-black"
                      disabled={disabled}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Deliverable
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
