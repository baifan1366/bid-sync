'use client'

import { useState, useEffect, useCallback } from 'react'
import { TipTapEditor } from './tiptap-editor'
import { EditorToolbar } from './editor-toolbar'
import { useTipTapEditor } from '@/hooks/use-tiptap-editor'
import { useSupabaseCollaboration } from '@/hooks/use-supabase-collaboration'
import { useAutoSave } from '@/hooks/use-auto-save'
import { JSONContent } from '@tiptap/core'
import { cn } from '@/lib/utils'
import { 
  CheckCircle2, 
  Loader2, 
  AlertCircle, 
  WifiOff, 
  Clock,
  Save
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export interface CollaborativeEditorProps {
  documentId?: string
  initialContent?: JSONContent | string
  placeholder?: string
  editable?: boolean
  onSave?: (content: JSONContent) => void | Promise<void>
  autoSave?: boolean
  autoSaveDelay?: number
  className?: string
  showToolbar?: boolean
  // Collaboration options
  collaborationEnabled?: boolean
  userId?: string
  userName?: string
  userColor?: string
  websocketUrl?: string // Kept for backward compatibility, but ignored
}

/**
 * Collaborative Editor Component
 * 
 * A complete rich text editor with toolbar and auto-save functionality.
 * Designed for collaborative proposal editing with real-time sync capabilities.
 * 
 * Features:
 * - Rich text formatting (bold, italic, strikethrough, code)
 * - Headings (H1-H6)
 * - Lists (bullet, ordered, task lists)
 * - Tables for structured data
 * - Code blocks
 * - Blockquotes
 * - Undo/Redo history
 * - Auto-save functionality
 * - Real-time collaborative editing with Yjs CRDT (optional)
 * - Presence tracking and cursor positions (optional)
 * 
 * Requirements: 3.1, 3.3, 3.5, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7
 */
export function CollaborativeEditor({
  documentId,
  initialContent,
  placeholder = 'Start writing your proposal...',
  editable = true,
  onSave,
  autoSave = true,
  autoSaveDelay = 2000,
  className,
  showToolbar = true,
  collaborationEnabled = false,
  userId = 'anonymous',
  userName = 'Anonymous',
  userColor = '#000000',
  websocketUrl,
}: CollaborativeEditorProps) {
  const [lastSaved, setLastSaved] = useState<Date | null>(null)

  // Set up Supabase Realtime collaboration if enabled
  const collaboration = useSupabaseCollaboration({
    documentId: documentId || 'default',
    userId,
    userName,
    userColor,
    enabled: collaborationEnabled && !!documentId,
  })

  const editor = useTipTapEditor({
    content: initialContent,
    placeholder,
    editable,
    onUpdate: undefined, // Will be handled by auto-save
    autofocus: false,
    // No longer using Yjs - collaboration handled via Supabase Realtime
    collaborationEnabled,
    userName,
    userColor,
  })

  // Enhanced auto-save with retry logic and offline support
  const autoSaveService = useAutoSave({
    documentId: documentId || 'default',
    getContent: () => editor?.getJSON() || {},
    saveFunction: async (content) => {
      if (onSave) {
        await onSave(content)
      }
    },
    enabled: autoSave && !collaborationEnabled && !!onSave && !!editor,
    debounceDelay: autoSaveDelay,
    onSaveSuccess: (result) => {
      if (result.savedAt) {
        setLastSaved(result.savedAt)
      }
    },
    onSaveError: (error) => {
      console.error('Auto-save error:', error)
    },
  })

  // Trigger save on editor update
  useEffect(() => {
    if (!editor || !autoSave || collaborationEnabled) return

    const handleUpdate = () => {
      autoSaveService.save()
    }

    editor.on('update', handleUpdate)

    return () => {
      editor.off('update', handleUpdate)
    }
  }, [editor, autoSave, collaborationEnabled, autoSaveService])

  // Manual save handler
  const handleManualSave = useCallback(async () => {
    if (!editor || !onSave) return

    try {
      const content = editor.getJSON()
      await onSave(content)
      setLastSaved(new Date())
    } catch (error) {
      console.error('Manual save error:', error)
    }
  }, [editor, onSave])

  // Get save status icon and text
  const getSaveStatusDisplay = () => {
    switch (autoSaveService.saveStatus) {
      case 'saving':
        return {
          icon: <Loader2 className="h-3 w-3 animate-spin text-yellow-400" />,
          text: 'Saving...',
          color: 'text-yellow-400',
        }
      case 'pending':
        return {
          icon: <Clock className="h-3 w-3 text-yellow-400" />,
          text: 'Pending...',
          color: 'text-yellow-400',
        }
      case 'saved':
        return {
          icon: <CheckCircle2 className="h-3 w-3 text-green-500" />,
          text: lastSaved ? `Saved at ${lastSaved.toLocaleTimeString()}` : 'Saved',
          color: 'text-green-500',
        }
      case 'error':
        return {
          icon: <AlertCircle className="h-3 w-3 text-red-500" />,
          text: 'Save failed - retrying...',
          color: 'text-red-500',
        }
      case 'offline':
        return {
          icon: <WifiOff className="h-3 w-3 text-yellow-400" />,
          text: 'Offline - changes queued',
          color: 'text-yellow-400',
        }
      default:
        return {
          icon: <CheckCircle2 className="h-3 w-3 text-muted-foreground" />,
          text: 'Ready',
          color: 'text-muted-foreground',
        }
    }
  }

  const saveStatusDisplay = getSaveStatusDisplay()

  return (
    <div className={cn('flex flex-col', className)}>
      {/* Toolbar */}
      {showToolbar && (
        <div className="rounded-t-md border border-b-0 border-yellow-400/20 bg-white dark:bg-black">
          <EditorToolbar editor={editor} />
        </div>
      )}

      {/* Editor */}
      <div className={cn(showToolbar ? 'rounded-b-md' : 'rounded-md')}>
        <TipTapEditor
          content={initialContent}
          placeholder={placeholder}
          editable={editable}
          className={cn(
            'border-yellow-400/20',
            showToolbar && 'rounded-t-none border-t-0'
          )}
          minHeight="400px"
        />
      </div>

      {/* Enhanced Status Bar */}
      <div className="mt-2 flex items-center justify-between text-xs">
        <div className="flex items-center gap-4">
          {/* Enhanced Save Status */}
          {autoSave && !collaborationEnabled && (
            <div className="flex items-center gap-3">
              {/* Status Indicator */}
              <div className={cn('flex items-center gap-1.5', saveStatusDisplay.color)}>
                {saveStatusDisplay.icon}
                <span className="font-medium">{saveStatusDisplay.text}</span>
              </div>

              {/* Offline Queue Status */}
              {autoSaveService.pendingCount > 0 && (
                <Badge variant="outline" className="border-yellow-400 text-yellow-400">
                  {autoSaveService.pendingCount} queued
                </Badge>
              )}

              {/* Manual Save Button */}
              <Button
                size="sm"
                variant="ghost"
                onClick={handleManualSave}
                disabled={!editor || !onSave}
                className="h-6 px-2 text-xs hover:bg-yellow-400/10"
              >
                <Save className="h-3 w-3 mr-1" />
                Save Now
              </Button>
            </div>
          )}

          {/* Collaboration status */}
          {collaborationEnabled && (
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  'h-2 w-2 rounded-full',
                  collaboration.connectionStatus === 'connected' && 'bg-green-500',
                  collaboration.connectionStatus === 'disconnected' && 'bg-red-500',
                  collaboration.connectionStatus === 'reconnecting' && 'bg-yellow-400'
                )}
              />
              <span className="text-muted-foreground">
                {collaboration.connectionStatus === 'connected' && 'Connected'}
                {collaboration.connectionStatus === 'disconnected' && 'Disconnected'}
                {collaboration.connectionStatus === 'reconnecting' && 'Reconnecting...'}
              </span>
              {collaboration.synced && collaboration.connectionStatus === 'connected' && (
                <span className="text-green-500">• Synced</span>
              )}
            </div>
          )}

          {/* Active users */}
          {collaborationEnabled && collaboration.activeUsers.length > 0 && (
            <div className="flex items-center gap-1 text-muted-foreground">
              <span>{collaboration.activeUsers.length} active user(s)</span>
            </div>
          )}
        </div>

        {/* Document ID */}
        {documentId && (
          <div className="text-xs text-muted-foreground">
            Document ID: {documentId.slice(0, 8)}...
          </div>
        )}
      </div>
    </div>
  )
}
