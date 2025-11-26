"use client"

import * as React from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
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

interface DocumentUploaderProps {
  proposalId: string
  onUpload: (file: File, metadata: { fileName: string; fileSize: number; fileType: string; isRequired?: boolean }) => Promise<void>
  maxFileSize?: number // in bytes
  allowedFileTypes?: string[]
  isRequired?: boolean
  className?: string
}

/**
 * DocumentUploader Component
 * 
 * Handles file uploads for proposal documents with:
 * - Drag and drop support
 * - File type and size validation
 * - Upload progress indication
 * - Multiple file selection
 * - Visual feedback for upload status
 * 
 * Requirements: 9.1, 9.2, 9.3
 */
export function DocumentUploader({
  proposalId,
  onUpload,
  maxFileSize = 10 * 1024 * 1024, // 10MB default
  allowedFileTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'image/jpeg',
    'image/png',
    'image/gif',
    'text/plain',
    'text/csv',
  ],
  isRequired = false,
  className,
}: DocumentUploaderProps) {
  const [isDragging, setIsDragging] = React.useState(false)
  const [uploadQueue, setUploadQueue] = React.useState<Array<{
    file: File
    status: 'pending' | 'uploading' | 'success' | 'error'
    progress: number
    error?: string
  }>>([])
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const validateFile = (file: File): { valid: boolean; error?: string } => {
    // Check file type
    if (!allowedFileTypes.includes(file.type)) {
      return {
        valid: false,
        error: `File type ${file.type} is not allowed`,
      }
    }

    // Check file size
    if (file.size > maxFileSize) {
      return {
        valid: false,
        error: `File size ${(file.size / 1024 / 1024).toFixed(2)}MB exceeds maximum ${(maxFileSize / 1024 / 1024)}MB`,
      }
    }

    return { valid: true }
  }

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return

    const newFiles = Array.from(files).map((file) => ({
      file,
      status: 'pending' as const,
      progress: 0,
    }))

    setUploadQueue((prev) => [...prev, ...newFiles])

    // Process uploads sequentially
    for (let i = 0; i < newFiles.length; i++) {
      const fileItem = newFiles[i]
      const validation = validateFile(fileItem.file)

      if (!validation.valid) {
        setUploadQueue((prev) =>
          prev.map((item) =>
            item.file === fileItem.file
              ? { ...item, status: 'error', error: validation.error }
              : item
          )
        )
        continue
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
        // Simulate progress (in real implementation, use XMLHttpRequest or similar for actual progress)
        const progressInterval = setInterval(() => {
          setUploadQueue((prev) =>
            prev.map((item) =>
              item.file === fileItem.file && item.progress < 90
                ? { ...item, progress: item.progress + 10 }
                : item
            )
          )
        }, 200)

        await onUpload(fileItem.file, {
          fileName: fileItem.file.name,
          fileSize: fileItem.file.size,
          fileType: fileItem.file.type,
          isRequired,
        })

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
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
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
      {/* Upload Area */}
      <Card
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "p-8 border-2 border-dashed transition-colors cursor-pointer",
          isDragging
            ? "border-yellow-400 bg-yellow-400/10"
            : "border-yellow-400/20 hover:border-yellow-400/40"
        )}
        onClick={() => fileInputRef.current?.click()}
      >
        <div className="flex flex-col items-center justify-center text-center space-y-3">
          <div className="p-3 rounded-full bg-yellow-400/10">
            <Upload className="h-8 w-8 text-yellow-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-black dark:text-white">
              Drop files here or click to browse
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Maximum file size: {(maxFileSize / 1024 / 1024).toFixed(0)}MB
            </p>
            <p className="text-xs text-muted-foreground">
              Supported: PDF, Word, Excel, PowerPoint, Images, Text, CSV
            </p>
          </div>
          {isRequired && (
            <Badge className="bg-red-500 text-white">Required</Badge>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={allowedFileTypes.join(',')}
          onChange={handleFileInputChange}
          className="hidden"
        />
      </Card>

      {/* Upload Queue */}
      {uploadQueue.length > 0 && (
        <div className="space-y-2">
          {uploadQueue.map((item, index) => (
            <Card
              key={`${item.file.name}-${index}`}
              className="p-4 border-yellow-400/20"
            >
              <div className="flex items-start gap-3">
                {/* File Icon */}
                <div className="mt-0.5">{getFileIcon(item.file.type)}</div>

                {/* File Info */}
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

                  {/* Progress Bar */}
                  {item.status === 'uploading' && (
                    <Progress value={item.progress} className="h-1" />
                  )}

                  {/* Error Message */}
                  {item.status === 'error' && item.error && (
                    <p className="text-xs text-red-500 mt-1">{item.error}</p>
                  )}

                  {/* Success Message */}
                  {item.status === 'success' && (
                    <p className="text-xs text-green-500 mt-1">Upload complete</p>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
