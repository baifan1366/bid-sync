'use client'

import { useState, useEffect, useCallback } from 'react'
import { TipTapEditor } from './tiptap-editor'
import { EditorToolbar } from './editor-toolbar'
import { useTipTapEditor } from '@/hooks/use-tiptap-editor'
import { useSectionLock } from '@/hooks/use-section-lock'
import { JSONContent } from '@tiptap/core'
import { cn } from '@/lib/utils'
import { Lock, LockOpen, User, AlertCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

export interface SectionEditorProps {
  sectionId: string
  documentId: string
  title: string
  initialContent?: JSONContent | string
  placeholder?: string
  editable?: boolean
  onSave?: (content: JSONContent) => void | Promise<void>
  className?: string
  showToolbar?: boolean
  // Section metadata
  assignedTo?: {
    id: string
    name: string
    email: string
    avatarUrl?: string
  }
  status?: 'not_started' | 'in_progress' | 'in_review' | 'completed'
  deadline?: Date
  // Lock options
  autoLockOnFocus?: boolean
  autoReleaseOnBlur?: boolean
}

/**
 * Section-based Editor Component
 * 
 * A rich text editor with section-level locking awareness.
 * Prevents simultaneous editing of the same section by multiple users.
 * 
 * Features:
 * - Automatic lock acquisition on focus
 * - Visual lock indicators with yellow accent
 * - Section assignment display
 * - Lock request/release UI interactions
 * - Integration with TipTap editor
 * 
 * Requirements: 1.1, 1.2, 2.1, 2.2, 6.2
 */
export function SectionEditor({
  sectionId,
  documentId,
  title,
  initialContent,
  placeholder = 'Start writing this section...',
  editable = true,
  onSave,
  className,
  showToolbar = true,
  assignedTo,
  status = 'not_started',
  deadline,
  autoLockOnFocus = true,
  autoReleaseOnBlur = true,
}: SectionEditorProps) {
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  // Section lock management
  const {
    isLocked,
    isLockedByMe,
    lockedBy,
    isAcquiring,
    isReleasing,
    error: lockError,
    acquireLock,
    releaseLock,
    handleFocus,
    handleBlur,
  } = useSectionLock({
    sectionId,
    documentId,
    enabled: editable,
    autoAcquireOnFocus,
    autoReleaseOnBlur,
  })

  // Determine if editor should be editable
  const isEditorEditable = editable && (!isLocked || isLockedByMe)

  // TipTap editor
  const editor = useTipTapEditor({
    content: initialContent,
    placeholder,
    editable: isEditorEditable,
    onUpdate: () => {
      setHasUnsavedChanges(true)
    },
    autofocus: false,
  })

  // Update editor editable state when lock status changes
  useEffect(() => {
    if (editor) {
      editor.setEditable(isEditorEditable)
    }
  }, [editor, isEditorEditable])

  // Handle save
  const handleSave = useCallback(async () => {
    if (!editor || !onSave) return

    try {
      const content = editor.getJSON()
      await onSave(content)
      setHasUnsavedChanges(false)
    } catch (error) {
      console.error('Failed to save section:', error)
    }
  }, [editor, onSave])

  // Handle editor focus
  const handleEditorFocus = useCallback(() => {
    if (autoLockOnFocus) {
      handleFocus()
    }
  }, [autoLockOnFocus, handleFocus])

  // Handle editor blur
  const handleEditorBlur = useCallback(() => {
    if (autoReleaseOnBlur) {
      handleBlur()
    }
    
    // Auto-save on blur if there are unsaved changes
    if (hasUnsavedChanges) {
      handleSave()
    }
  }, [autoReleaseOnBlur, handleBlur, hasUnsavedChanges, handleSave])

  // Manual lock request
  const handleLockRequest = useCallback(async () => {
    const success = await acquireLock()
    if (success && editor) {
      editor.commands.focus()
    }
  }, [acquireLock, editor])

  // Manual lock release
  const handleLockRelease = useCallback(async () => {
    if (hasUnsavedChanges) {
      await handleSave()
    }
    await releaseLock()
  }, [releaseLock, hasUnsavedChanges, handleSave])

  // Get status badge color
  const getStatusColor = () => {
    switch (status) {
      case 'completed':
        return 'bg-green-500 text-white'
      case 'in_review':
        return 'bg-blue-500 text-white'
      case 'in_progress':
        return 'bg-yellow-400 text-black'
      default:
        return 'bg-gray-300 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
    }
  }

  // Check if deadline is approaching or overdue
  const getDeadlineStatus = () => {
    if (!deadline) return null

    const now = new Date()
    const hoursRemaining = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60)

    if (hoursRemaining < 0) {
      return { type: 'overdue', color: 'text-red-500', label: 'Overdue' }
    } else if (hoursRemaining < 24) {
      return { type: 'warning', color: 'text-yellow-400', label: 'Due soon' }
    }
    return null
  }

  const deadlineStatus = getDeadlineStatus()

  return (
    <div className={cn('flex flex-col space-y-3', className)}>
      {/* Section Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-lg font-semibold text-black dark:text-white">
              {title}
            </h3>
            
            {/* Status Badge */}
            <Badge className={cn('text-xs', getStatusColor())}>
              {status.replace('_', ' ')}
            </Badge>

            {/* Deadline Warning */}
            {deadlineStatus && (
              <Badge variant="outline" className={cn('text-xs', deadlineStatus.color)}>
                {deadlineStatus.label}
              </Badge>
            )}
          </div>

          {/* Assignment Info */}
          {assignedTo && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <User className="h-4 w-4" />
              <span>Assigned to:</span>
              <div className="flex items-center gap-1">
                <Avatar className="h-5 w-5">
                  <AvatarFallback className="text-xs bg-yellow-400 text-black">
                    {assignedTo.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="font-medium text-black dark:text-white">
                  {assignedTo.name}
                </span>
              </div>
            </div>
          )}

          {/* Deadline Info */}
          {deadline && (
            <div className="text-sm text-muted-foreground">
              Deadline: {deadline.toLocaleDateString()} at {deadline.toLocaleTimeString()}
            </div>
          )}
        </div>

        {/* Lock Status & Actions */}
        <div className="flex items-center gap-2">
          {isLocked && !isLockedByMe && (
            <Badge variant="outline" className="border-yellow-400 text-yellow-400">
              <Lock className="h-3 w-3 mr-1" />
              Locked by {lockedBy || 'another user'}
            </Badge>
          )}

          {isLockedByMe && (
            <Badge className="bg-yellow-400 text-black hover:bg-yellow-500">
              <LockOpen className="h-3 w-3 mr-1" />
              Editing
            </Badge>
          )}

          {!isLocked && !isLockedByMe && editable && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleLockRequest}
              disabled={isAcquiring}
              className="border-yellow-400 text-yellow-400 hover:bg-yellow-400/10"
            >
              {isAcquiring ? (
                <>
                  <Lock className="h-3 w-3 mr-1 animate-pulse" />
                  Acquiring...
                </>
              ) : (
                <>
                  <LockOpen className="h-3 w-3 mr-1" />
                  Start Editing
                </>
              )}
            </Button>
          )}

          {isLockedByMe && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleLockRelease}
              disabled={isReleasing}
            >
              {isReleasing ? 'Releasing...' : 'Stop Editing'}
            </Button>
          )}
        </div>
      </div>

      {/* Lock Error Alert */}
      {lockError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{lockError}</AlertDescription>
        </Alert>
      )}

      {/* Locked Section Notice */}
      {isLocked && !isLockedByMe && (
        <Alert className="border-yellow-400/20 bg-yellow-400/5">
          <Lock className="h-4 w-4 text-yellow-400" />
          <AlertDescription>
            This section is currently being edited by {lockedBy || 'another user'}.
            You can view the content but cannot make changes until they finish.
          </AlertDescription>
        </Alert>
      )}

      {/* Editor */}
      <div className={cn('flex flex-col', isLocked && !isLockedByMe && 'opacity-60')}>
        {/* Toolbar */}
        {showToolbar && isEditorEditable && (
          <div className="rounded-t-md border border-b-0 border-yellow-400/20 bg-white dark:bg-black">
            <EditorToolbar editor={editor} />
          </div>
        )}

        {/* Editor Content */}
        <div
          className={cn(showToolbar && isEditorEditable ? 'rounded-b-md' : 'rounded-md')}
          onFocus={handleEditorFocus}
          onBlur={handleEditorBlur}
        >
          <TipTapEditor
            content={initialContent}
            placeholder={placeholder}
            editable={isEditorEditable}
            className={cn(
              'border-yellow-400/20',
              showToolbar && isEditorEditable && 'rounded-t-none border-t-0',
              isLockedByMe && 'ring-2 ring-yellow-400/30'
            )}
            minHeight="300px"
          />
        </div>
      </div>

      {/* Status Bar */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-4">
          {/* Unsaved changes indicator */}
          {hasUnsavedChanges && isLockedByMe && (
            <span className="text-yellow-400">Unsaved changes</span>
          )}

          {/* Lock status */}
          {isLockedByMe && (
            <span className="text-green-500">You are editing this section</span>
          )}
        </div>

        {/* Section ID */}
        <div className="text-xs text-muted-foreground">
          Section ID: {sectionId.slice(0, 8)}...
        </div>
      </div>
    </div>
  )
}
