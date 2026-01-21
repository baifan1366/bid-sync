/**
 * Version History Sidebar Component
 * 
 * Displays version history with:
 * - Version list with timestamps and authors
 * - Change summaries for each version
 * - Version comparison view
 * - Version preview
 * - Rollback button with confirmation dialog
 * 
 * Requirements: 5.1, 5.2, 5.3, 5.4, 6.1, 6.2, 6.3, 6.4, 6.5
 */

'use client'

import { useState } from 'react'
import { useGraphQLQuery, useGraphQLMutation } from '@/hooks/use-graphql'
import { GET_VERSION_HISTORY, GET_VERSION } from '@/lib/graphql/queries'
import { ROLLBACK_TO_VERSION } from '@/lib/graphql/mutations'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Clock,
  User,
  RotateCcw,
  Eye,
  GitCompare,
  Loader2,
  AlertCircle,
  History,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { JSONContent } from '@/types/document'

interface DocumentVersion {
  id: string
  documentId: string
  versionNumber: number
  content: JSONContent
  createdBy: string
  createdByName: string
  changesSummary: string
  isRollback: boolean
  rolledBackFrom?: string
  createdAt: string
}

interface VersionHistorySidebarProps {
  documentId: string
  isOpen: boolean
  onClose: () => void
  onVersionRestored?: () => void
  canEdit: boolean
}

export function VersionHistorySidebar({
  documentId,
  isOpen,
  onClose,
  onVersionRestored,
  canEdit,
}: VersionHistorySidebarProps) {
  const [selectedVersion, setSelectedVersion] = useState<DocumentVersion | null>(null)
  const [previewVersion, setPreviewVersion] = useState<DocumentVersion | null>(null)
  const [compareVersions, setCompareVersions] = useState<{
    version1: DocumentVersion | null
    version2: DocumentVersion | null
  }>({ version1: null, version2: null })
  const [showRollbackDialog, setShowRollbackDialog] = useState(false)
  const [showPreviewSheet, setShowPreviewSheet] = useState(false)
  const [showCompareSheet, setShowCompareSheet] = useState(false)

  // Fetch version history
  const { data, isLoading, error, refetch } = useGraphQLQuery<{
    documentVersionHistory: DocumentVersion[]
  }>(['versionHistory', documentId], GET_VERSION_HISTORY, { documentId }, {
    // Always refetch when sidebar opens
    staleTime: 0,
    refetchOnMount: true,
  })

  // Rollback mutation
  const rollbackMutation = useGraphQLMutation<any, any>(ROLLBACK_TO_VERSION, [
    ['versionHistory', documentId],
    ['document', documentId],
  ])

  const versions = data?.documentVersionHistory || []

  const handleRollback = async () => {
    if (!selectedVersion) return

    try {
      const result = await rollbackMutation.mutateAsync({
        documentId,
        versionId: selectedVersion.id,
      })

      if (result.rollbackToVersion.success) {
        setShowRollbackDialog(false)
        setSelectedVersion(null)
        refetch()
        onVersionRestored?.()
      } else {
        console.error('Rollback failed:', result.rollbackToVersion.error)
      }
    } catch (error) {
      console.error('Failed to rollback:', error)
    }
  }

  const handlePreview = (version: DocumentVersion) => {
    setPreviewVersion(version)
    setShowPreviewSheet(true)
  }

  const handleCompare = (version: DocumentVersion) => {
    // Always compare selected version with the current (latest) version
    const currentVersion = versions[0] // First version is the latest (current)
    
    if (currentVersion && version.id !== currentVersion.id) {
      // Compare selected version with current version
      setCompareVersions({ version1: version, version2: currentVersion })
      setShowCompareSheet(true)
    } else if (versions.length > 1) {
      // If clicking on current version, compare with previous version
      setCompareVersions({ version1: versions[1], version2: currentVersion })
      setShowCompareSheet(true)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
    
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const renderContent = (content: JSONContent): string => {
    if (!content) return ''
    
    const extractText = (node: JSONContent): string => {
      if (node.text) return node.text
      if (node.content && Array.isArray(node.content)) {
        return node.content.map(extractText).join(' ')
      }
      return ''
    }

    const text = extractText(content)
    return text.slice(0, 200) + (text.length > 200 ? '...' : '')
  }

  // Extract full text from JSONContent
  const extractFullText = (content: JSONContent): string => {
    if (!content) return ''
    
    const extractText = (node: JSONContent): string => {
      if (node.text) return node.text
      if (node.content && Array.isArray(node.content)) {
        return node.content.map(extractText).join('')
      }
      return ''
    }

    return extractText(content)
  }

  // Simple character-level diff algorithm for better accuracy
  const computeDiff = (oldText: string, newText: string): { type: 'same' | 'added' | 'removed'; text: string }[] => {
    const result: { type: 'same' | 'added' | 'removed'; text: string }[] = []
    
    // Find longest common prefix
    let prefixLen = 0
    while (prefixLen < oldText.length && prefixLen < newText.length && oldText[prefixLen] === newText[prefixLen]) {
      prefixLen++
    }
    
    // Find longest common suffix (after prefix)
    let suffixLen = 0
    while (
      suffixLen < oldText.length - prefixLen && 
      suffixLen < newText.length - prefixLen && 
      oldText[oldText.length - 1 - suffixLen] === newText[newText.length - 1 - suffixLen]
    ) {
      suffixLen++
    }
    
    // Common prefix
    if (prefixLen > 0) {
      result.push({ type: 'same', text: oldText.slice(0, prefixLen) })
    }
    
    // Middle part - what was removed from old
    const oldMiddle = oldText.slice(prefixLen, oldText.length - suffixLen)
    const newMiddle = newText.slice(prefixLen, newText.length - suffixLen)
    
    if (oldMiddle.length > 0) {
      result.push({ type: 'removed', text: oldMiddle })
    }
    
    if (newMiddle.length > 0) {
      result.push({ type: 'added', text: newMiddle })
    }
    
    // Common suffix
    if (suffixLen > 0) {
      result.push({ type: 'same', text: oldText.slice(oldText.length - suffixLen) })
    }
    
    return result
  }

  // Render diff with highlighting
  const renderDiffContent = (oldContent: JSONContent, newContent: JSONContent) => {
    const oldText = extractFullText(oldContent)
    const newText = extractFullText(newContent)
    const diff = computeDiff(oldText, newText)

    return (
      <div className="whitespace-pre-wrap">
        {diff.map((segment, index) => (
          <span
            key={index}
            className={cn(
              segment.type === 'added' && 'bg-green-400/30 text-green-700 dark:text-green-300',
              segment.type === 'removed' && 'bg-red-400/30 text-red-700 dark:text-red-300 line-through'
            )}
          >
            {segment.text}
          </span>
        ))}
      </div>
    )
  }

  if (!isOpen) return null

  return (
    <>
      <div
        className={cn(
          'fixed right-0 top-0 h-full w-80 bg-white dark:bg-black border-l border-yellow-400/20 shadow-lg z-50 transform transition-transform duration-300',
          isOpen ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        {/* Header */}
        <div className="border-b border-yellow-400/20 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="h-5 w-5 text-yellow-400" />
              <h2 className="text-lg font-bold">Version History</h2>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
              <X className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {versions.length} version{versions.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Content */}
        <ScrollArea className="h-[calc(100vh-80px)]">
          <div className="p-4 space-y-3">
            {isLoading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-yellow-400" />
              </div>
            )}

            {error && (
              <Card className="border-yellow-400/20 p-4">
                <div className="flex items-center gap-2 text-yellow-400">
                  <AlertCircle className="h-4 w-4" />
                  <p className="text-sm">Failed to load version history</p>
                </div>
              </Card>
            )}

            {!isLoading && !error && versions.length === 0 && (
              <Card className="border-yellow-400/20 p-6">
                <div className="text-center text-muted-foreground">
                  <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No versions yet</p>
                </div>
              </Card>
            )}

            {versions.map((version, index) => (
              <Card
                key={version.id}
                className={cn(
                  'border-yellow-400/20 p-3 hover:border-yellow-400/40 transition-colors cursor-pointer',
                  selectedVersion?.id === version.id && 'border-yellow-400 bg-yellow-400/5',
                  compareVersions.version1?.id === version.id && 'border-blue-400 bg-blue-400/5',
                  compareVersions.version2?.id === version.id && 'border-green-400 bg-green-400/5'
                )}
                onClick={() => setSelectedVersion(version)}
              >
                {/* Version header */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <Badge
                      className={cn(
                        'bg-yellow-400 text-black',
                        index === 0 && 'bg-yellow-400 text-black',
                        version.isRollback && 'bg-yellow-400/80 text-black'
                      )}
                    >
                      v{version.versionNumber}
                    </Badge>
                    {index === 0 && (
                      <Badge variant="secondary" className="text-xs">
                        Current
                      </Badge>
                    )}
                    {version.isRollback && (
                      <Badge variant="secondary" className="text-xs">
                        <RotateCcw className="h-3 w-3 mr-1" />
                        Rollback
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Author and time */}
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                  <User className="h-3 w-3" />
                  <span className="truncate">{version.createdByName}</span>
                  <span>•</span>
                  <Clock className="h-3 w-3" />
                  <span>{formatDate(version.createdAt)}</span>
                </div>

                {/* Changes summary */}
                <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                  {version.changesSummary}
                </p>

                {/* Actions */}
                {selectedVersion?.id === version.id && (
                  <>
                    <Separator className="my-2" />
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation()
                          handlePreview(version)
                        }}
                        className="flex-1 border-yellow-400/20 text-xs"
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        Preview
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleCompare(version)
                        }}
                        className="flex-1 border-yellow-400/20 text-xs"
                      >
                        <GitCompare className="h-3 w-3 mr-1" />
                        Compare
                      </Button>
                    </div>
                    {canEdit && index !== 0 && (
                      <Button
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          setShowRollbackDialog(true)
                        }}
                        className="w-full mt-2 bg-yellow-400 hover:bg-yellow-500 text-black text-xs"
                      >
                        <RotateCcw className="h-3 w-3 mr-1" />
                        Restore this version
                      </Button>
                    )}
                  </>
                )}
              </Card>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Rollback Confirmation Dialog */}
      <AlertDialog open={showRollbackDialog} onOpenChange={setShowRollbackDialog}>
        <AlertDialogContent className="border-yellow-400/20">
          <AlertDialogHeader>
            <AlertDialogTitle>Restore Version {selectedVersion?.versionNumber}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will restore the document to version {selectedVersion?.versionNumber}. A new
              version will be created with this content, and all version history will be preserved.
              All active collaborators will be notified of this change.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-yellow-400/20">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRollback}
              disabled={rollbackMutation.isPending}
              className="bg-yellow-400 hover:bg-yellow-500 text-black"
            >
              {rollbackMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Restoring...
                </>
              ) : (
                <>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Restore Version
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Preview Sheet */}
      <Sheet open={showPreviewSheet} onOpenChange={setShowPreviewSheet}>
        <SheetContent side="right" className="w-full sm:max-w-2xl border-yellow-400/20">
          <SheetHeader>
            <SheetTitle>
              Version {previewVersion?.versionNumber} Preview
            </SheetTitle>
            <SheetDescription>
              Created by {previewVersion?.createdByName} on{' '}
              {previewVersion && new Date(previewVersion.createdAt).toLocaleString()}
            </SheetDescription>
          </SheetHeader>
          <ScrollArea className="h-[calc(100vh-120px)] mt-4">
            <Card className="border-yellow-400/20 p-6">
              <div className="prose prose-sm max-w-none">
                {previewVersion && renderContent(previewVersion.content)}
              </div>
            </Card>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Compare Sheet */}
      <Sheet open={showCompareSheet} onOpenChange={setShowCompareSheet}>
        <SheetContent side="right" className="w-full sm:max-w-4xl border-yellow-400/20">
          <SheetHeader>
            <SheetTitle>Compare Versions</SheetTitle>
            <SheetDescription>
              {compareVersions.version1 && compareVersions.version2 ? (
                <>
                  Comparing v{compareVersions.version1.versionNumber} (older) with v
                  {compareVersions.version2.versionNumber} (current)
                </>
              ) : (
                'Select two versions to compare'
              )}
            </SheetDescription>
          </SheetHeader>
          
          {/* Legend */}
          <div className="flex items-center gap-4 mt-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="inline-block w-4 h-4 bg-green-400/30 rounded" />
              <span className="text-muted-foreground">Added</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block w-4 h-4 bg-red-400/30 rounded" />
              <span className="text-muted-foreground">Removed</span>
            </div>
          </div>

          <ScrollArea className="h-[calc(100vh-180px)] mt-4">
            {/* Unified Diff View */}
            <Card className="border-yellow-400/20 p-6 mb-4">
              <div className="flex items-center gap-2 mb-4">
                <Badge className="bg-yellow-400 text-black">Unified Diff</Badge>
                <span className="text-sm text-muted-foreground">
                  Changes from v{compareVersions.version1?.versionNumber} to v{compareVersions.version2?.versionNumber}
                </span>
              </div>
              <div className="prose prose-sm max-w-none">
                {compareVersions.version1 && compareVersions.version2 && 
                  renderDiffContent(compareVersions.version1.content, compareVersions.version2.content)}
              </div>
            </Card>

            {/* Side by Side View */}
            <div className="grid grid-cols-2 gap-4">
              {/* Version 1 (Older) */}
              <Card className="border-blue-400/20 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Badge className="bg-blue-400 text-white">
                    v{compareVersions.version1?.versionNumber}
                  </Badge>
                  <Badge variant="secondary" className="text-xs">Older</Badge>
                </div>
                <div className="text-xs text-muted-foreground mb-2">
                  {compareVersions.version1?.createdByName} • {compareVersions.version1 && formatDate(compareVersions.version1.createdAt)}
                </div>
                <Separator className="my-2" />
                <div className="prose prose-sm max-w-none text-sm">
                  {compareVersions.version1 && extractFullText(compareVersions.version1.content)}
                </div>
              </Card>

              {/* Version 2 (Current) */}
              <Card className="border-green-400/20 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Badge className="bg-green-400 text-white">
                    v{compareVersions.version2?.versionNumber}
                  </Badge>
                  <Badge variant="secondary" className="text-xs">Current</Badge>
                </div>
                <div className="text-xs text-muted-foreground mb-2">
                  {compareVersions.version2?.createdByName} • {compareVersions.version2 && formatDate(compareVersions.version2.createdAt)}
                </div>
                <Separator className="my-2" />
                <div className="prose prose-sm max-w-none text-sm">
                  {compareVersions.version2 && extractFullText(compareVersions.version2.content)}
                </div>
              </Card>
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </>
  )
}
