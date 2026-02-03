'use client'

import { useState, useCallback } from 'react'
import { TipTapEditor } from '@/components/editor/tiptap-editor'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, Save, Users } from 'lucide-react'
import { JSONContent } from '@tiptap/core'

interface WorkspaceSectionEditorProps {
  section: {
    id: string
    title: string
    content: any
    status: string
    assignedToUser?: { id: string; email: string; fullName: string }
    deadline?: string
    lockedBy?: string
    lockedByUser?: { id: string; email: string; fullName: string }
  }
  currentUserId?: string
  onSave: (content: JSONContent) => Promise<void>
  isSaving?: boolean
}

export function WorkspaceSectionEditor({
  section,
  currentUserId,
  onSave,
  isSaving = false,
}: WorkspaceSectionEditorProps) {
  const [hasChanges, setHasChanges] = useState(false)
  const [editorContent, setEditorContent] = useState<JSONContent | null>(null)

  const isLocked = section.lockedBy && section.lockedBy !== currentUserId
  const isEditable = !isLocked

  // Parse initial content
  const initialContent = (() => {
    const content = section.content
    if (!content) return ""
    if (typeof content === 'string') {
      try {
        return JSON.parse(content) as JSONContent
      } catch {
        return content
      }
    }
    return content as JSONContent
  })()

  const handleUpdate = useCallback((content: JSONContent) => {
    setEditorContent(content)
    setHasChanges(true)
  }, [])

  const handleSave = useCallback(async () => {
    if (!editorContent) return
    
    try {
      await onSave(editorContent)
      setHasChanges(false)
    } catch (error) {
      console.error('Failed to save section:', error)
    }
  }, [editorContent, onSave])

  return (
    <div className="space-y-4">
      {/* Section Info */}
      <div className="flex items-center justify-between pb-4 border-b border-yellow-400/20">
        <div>
          <h3 className="text-lg font-semibold text-black dark:text-white">
            {section.title}
          </h3>
          {section.assignedToUser && (
            <p className="text-sm text-muted-foreground mt-1">
              Assigned to: {section.assignedToUser.fullName || section.assignedToUser.email}
            </p>
          )}
          {section.deadline && (
            <p className="text-sm text-muted-foreground">
              Deadline: {new Date(section.deadline).toLocaleDateString()}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isLocked && section.lockedByUser && (
            <Badge variant="outline" className="border-yellow-400 text-yellow-400">
              <Users className="h-3 w-3 mr-1" />
              Locked by {section.lockedByUser.fullName || section.lockedByUser.email}
            </Badge>
          )}
          {hasChanges && (
            <Badge variant="outline" className="border-yellow-400 text-yellow-400">
              Unsaved changes
            </Badge>
          )}
        </div>
      </div>

      {/* Section Editor */}
      <TipTapEditor
        content={initialContent}
        editable={isEditable}
        onUpdate={handleUpdate}
        placeholder={`Write content for ${section.title}...`}
        minHeight="400px"
        className="border-yellow-400/20"
      />

      {/* Save Button */}
      {isEditable && (
        <div className="flex justify-end pt-4">
          <Button
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
            className="bg-yellow-400 hover:bg-yellow-500 text-black disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                {hasChanges ? 'Save Changes' : 'Saved'}
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  )
}
