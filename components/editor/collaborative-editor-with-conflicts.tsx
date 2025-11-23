/**
 * Collaborative Editor with Conflict Detection
 * 
 * Example component showing how to integrate conflict detection
 * with the collaborative editor.
 * 
 * Requirements: 3.3, 3.5
 */

'use client'

import { useState, useEffect } from 'react'
import { TipTapEditor } from './tiptap-editor'
import { ConflictResolutionDialog } from './conflict-resolution-dialog'
import { useConflictDetection } from '@/hooks/use-conflict-detection'
import { useTipTapEditor } from '@/hooks/use-tiptap-editor'
import { ConflictIndicator } from '@/lib/tiptap/conflict-indicator-extension'
import { JSONContent } from '@/types/document'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertTriangle } from 'lucide-react'

export interface CollaborativeEditorWithConflictsProps {
  documentId: string
  userId: string
  initialContent?: JSONContent
  onSave?: (content: JSONContent) => Promise<void>
  className?: string
}

/**
 * Collaborative Editor with Conflict Detection
 * 
 * Features:
 * - Real-time collaborative editing
 * - Automatic conflict detection
 * - Visual conflict indicators
 * - Conflict resolution dialog
 * - Conflict logging and notifications
 */
export function CollaborativeEditorWithConflicts({
  documentId,
  userId,
  initialContent,
  onSave,
  className,
}: CollaborativeEditorWithConflictsProps) {
  const [content, setContent] = useState<JSONContent | undefined>(initialContent)
  const [showConflictDialog, setShowConflictDialog] = useState(false)

  // Initialize editor with conflict indicator extension
  const editor = useTipTapEditor({
    content: initialContent,
    onUpdate: (newContent) => {
      setContent(newContent)
    },
  })

  // Add conflict indicator extension to editor
  useEffect(() => {
    if (editor && !editor.extensionManager.extensions.find(ext => ext.name === 'conflictIndicator')) {
      editor.extensionManager.extensions.push(ConflictIndicator)
    }
  }, [editor])

  // Conflict detection hook
  const {
    conflicts,
    hasConflicts,
    checkForConflicts,
    resolveConflict,
    resolveAllConflicts,
  } = useConflictDetection({
    documentId,
    editor,
    enabled: true,
  })

  // Show conflict dialog when conflicts are detected
  useEffect(() => {
    if (hasConflicts) {
      setShowConflictDialog(true)
    }
  }, [hasConflicts])

  // Handle conflict resolution
  const handleResolveConflict = async (conflictId: string, resolvedContent: JSONContent) => {
    await resolveConflict(conflictId, resolvedContent)
    
    // Update editor content
    if (editor) {
      editor.commands.setContent(resolvedContent)
    }
    
    // Save resolved content
    if (onSave) {
      await onSave(resolvedContent)
    }
  }

  // Handle resolve all conflicts
  const handleResolveAll = async (resolution: 'local' | 'server') => {
    await resolveAllConflicts(resolution)
    
    // Get the resolved content
    const resolvedContent = resolution === 'local' 
      ? content 
      : conflicts[0]?.serverVersion

    // Update editor content
    if (editor && resolvedContent) {
      editor.commands.setContent(resolvedContent)
    }
    
    // Save resolved content
    if (onSave && resolvedContent) {
      await onSave(resolvedContent)
    }
  }

  return (
    <div className={className}>
      {/* Conflict Alert */}
      {hasConflicts && (
        <Alert className="mb-4 border-yellow-400/20 bg-yellow-400/10">
          <AlertTriangle className="h-4 w-4 text-yellow-400" />
          <AlertDescription>
            <strong>Sync conflicts detected!</strong> Your changes conflict with changes on the server.
            Click to resolve conflicts.
          </AlertDescription>
        </Alert>
      )}

      {/* Editor */}
      <TipTapEditor
        content={content}
        onUpdate={setContent}
        className="min-h-[500px]"
      />

      {/* Conflict Resolution Dialog */}
      <ConflictResolutionDialog
        open={showConflictDialog}
        onOpenChange={setShowConflictDialog}
        conflicts={conflicts}
        onResolve={handleResolveConflict}
        onResolveAll={handleResolveAll}
        documentId={documentId}
        userId={userId}
      />
    </div>
  )
}
