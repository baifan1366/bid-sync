'use client'

import * as React from 'react'
import { EditorContent, Editor } from '@tiptap/react'
import { useTipTapEditor } from '@/hooks/use-tiptap-editor'
import { JSONContent } from '@tiptap/core'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Bold,
  Italic,
  Strikethrough,
  List,
  ListOrdered,
  Quote,
  Code,
  Undo,
  Redo,
  Minus,
  CheckSquare,
} from 'lucide-react'

export interface TipTapEditorProps {
  content?: JSONContent | string
  placeholder?: string
  editable?: boolean
  onUpdate?: (content: JSONContent) => void
  onBlur?: () => void
  autofocus?: boolean
  className?: string
  minHeight?: string
  showToolbar?: boolean
}

interface ToolbarButtonProps {
  onClick: () => void
  isActive?: boolean
  disabled?: boolean
  children: React.ReactNode
  title: string
}

function ToolbarButton({ onClick, isActive, disabled, children, title }: ToolbarButtonProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        'h-8 w-8 p-0',
        isActive && 'bg-yellow-400/20 text-yellow-600 dark:text-yellow-400'
      )}
    >
      {children}
    </Button>
  )
}

function EditorToolbar({ editor }: { editor: Editor }) {
  if (!editor) return null

  const currentHeading = editor.isActive('heading', { level: 1 })
    ? '1'
    : editor.isActive('heading', { level: 2 })
    ? '2'
    : editor.isActive('heading', { level: 3 })
    ? '3'
    : 'p'

  return (
    <div className="flex flex-wrap items-center gap-1 p-2 border-b border-yellow-400/20 bg-yellow-400/5">
      {/* Text Style Dropdown */}
      <Select
        value={currentHeading}
        onValueChange={(value) => {
          if (value === 'p') {
            editor.chain().focus().setParagraph().run()
          } else {
            editor.chain().focus().toggleHeading({ level: parseInt(value) as 1 | 2 | 3 }).run()
          }
        }}
      >
        <SelectTrigger className="h-8 w-[120px] text-xs border-yellow-400/20">
          <SelectValue placeholder="Style" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="p">Normal</SelectItem>
          <SelectItem value="1">Heading 1</SelectItem>
          <SelectItem value="2">Heading 2</SelectItem>
          <SelectItem value="3">Heading 3</SelectItem>
        </SelectContent>
      </Select>

      <div className="w-px h-6 bg-yellow-400/20 mx-1" />

      {/* Text Formatting */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        isActive={editor.isActive('bold')}
        title="Bold (Ctrl+B)"
      >
        <Bold className="h-4 w-4" />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        isActive={editor.isActive('italic')}
        title="Italic (Ctrl+I)"
      >
        <Italic className="h-4 w-4" />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleStrike().run()}
        isActive={editor.isActive('strike')}
        title="Strikethrough"
      >
        <Strikethrough className="h-4 w-4" />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleCode().run()}
        isActive={editor.isActive('code')}
        title="Inline Code"
      >
        <Code className="h-4 w-4" />
      </ToolbarButton>

      <div className="w-px h-6 bg-yellow-400/20 mx-1" />

      {/* Lists */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        isActive={editor.isActive('bulletList')}
        title="Bullet List"
      >
        <List className="h-4 w-4" />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        isActive={editor.isActive('orderedList')}
        title="Numbered List"
      >
        <ListOrdered className="h-4 w-4" />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().toggleTaskList().run()}
        isActive={editor.isActive('taskList')}
        title="Task List"
      >
        <CheckSquare className="h-4 w-4" />
      </ToolbarButton>

      <div className="w-px h-6 bg-yellow-400/20 mx-1" />

      {/* Block Elements */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        isActive={editor.isActive('blockquote')}
        title="Quote"
      >
        <Quote className="h-4 w-4" />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        title="Horizontal Rule"
      >
        <Minus className="h-4 w-4" />
      </ToolbarButton>

      <div className="w-px h-6 bg-yellow-400/20 mx-1" />

      {/* Undo/Redo */}
      <ToolbarButton
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!editor.can().undo()}
        title="Undo (Ctrl+Z)"
      >
        <Undo className="h-4 w-4" />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!editor.can().redo()}
        title="Redo (Ctrl+Y)"
      >
        <Redo className="h-4 w-4" />
      </ToolbarButton>
    </div>
  )
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
  showToolbar = true,
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
    >
      {showToolbar && editable && <EditorToolbar editor={editor} />}
      <div style={{ minHeight }}>
        <EditorContent
          editor={editor}
          className="tiptap-editor-content p-4"
        />
      </div>
    </div>
  )
}

export { Editor }
