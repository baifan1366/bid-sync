'use client'

import { EditorContent, Editor } from '@tiptap/react'
import { useTipTapEditor } from '@/hooks/use-tiptap-editor'
import { JSONContent } from '@tiptap/core'
import { cn } from '@/lib/utils'

export interface TipTapEditorProps {
  content?: JSONContent | string
  placeholder?: string
  editable?: boolean
  onUpdate?: (content: JSONContent) => void
  onBlur?: () => void
  autofocus?: boolean
  className?: string
  minHeight?: string
}

/**
 * TipTap Editor Component
 * 
 * A rich text editor with the following features:
 * - Text formatting (bold, italic, underline, strikethrough)
 * - Headings (H1-H6)
 * - Lists (ordered and unordered)
 * - Tables for structured data
 * - Task lists with checkboxes
 * - Code blocks
 * - Undo/Redo functionality
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7
 */
export function TipTapEditor({
  content,
  placeholder,
  editable = true,
  onUpdate,
  onBlur,
  autofocus = false,
  className,
  minHeight = '300px',
}: TipTapEditorProps) {
  const editor = useTipTapEditor({
    content,
    placeholder,
    editable,
    onUpdate,
    onBlur,
    autofocus,
  })

  if (!editor) {
    return (
      <div
        className={cn(
          'rounded-md border border-yellow-400/20 bg-white dark:bg-black p-4',
          className
        )}
        style={{ minHeight }}
      >
        <div className="animate-pulse">
          <div className="h-4 bg-yellow-400/10 rounded w-3/4 mb-2"></div>
          <div className="h-4 bg-yellow-400/10 rounded w-1/2"></div>
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'rounded-md border border-yellow-400/20 bg-white dark:bg-black',
        'focus-within:border-yellow-400/40 transition-colors',
        className
      )}
      style={{ minHeight }}
    >
      <EditorContent
        editor={editor}
        className="tiptap-editor-content p-4"
      />
    </div>
  )
}

export { Editor }
