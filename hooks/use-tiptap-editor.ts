'use client'

import { useEditor, Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableCell } from '@tiptap/extension-table-cell'
import { TableHeader } from '@tiptap/extension-table-header'
import { Placeholder } from '@tiptap/extension-placeholder'
import { TaskList } from '@tiptap/extension-task-list'
import { TaskItem } from '@tiptap/extension-task-item'
import { Collaboration } from '@tiptap/extension-collaboration'
import { CollaborationCaret } from '@tiptap/extension-collaboration-caret'
import { JSONContent } from '@tiptap/core'
import * as Y from 'yjs'

export interface UseTipTapEditorOptions {
  content?: JSONContent | string
  placeholder?: string
  editable?: boolean
  onUpdate?: (content: JSONContent) => void
  onBlur?: () => void
  autofocus?: boolean
  // Yjs collaboration options
  ydoc?: Y.Doc
  collaborationEnabled?: boolean
  userName?: string
  userColor?: string
}

/**
 * Custom hook to configure and initialize TipTap editor with all required extensions
 * 
 * Extensions included:
 * - StarterKit: Bold, Italic, Strike, Code, Headings (H1-H6), Lists, Blockquote, Code Block, Horizontal Rule, Hard Break, History (Undo/Redo)
 * - Table: Structured data tables with rows, cells, and headers
 * - Placeholder: Empty state placeholder text
 * - TaskList: Interactive checklists with checkboxes
 * - Collaboration: Yjs CRDT integration for real-time collaborative editing (optional)
 * - CollaborationCaret: Show cursor positions of other collaborators (optional)
 * 
 * @param options Configuration options for the editor
 * @returns TipTap Editor instance
 */
export function useTipTapEditor(options: UseTipTapEditorOptions = {}): Editor | null {
  const {
    content = '',
    placeholder = 'Start writing your proposal...',
    editable = true,
    onUpdate,
    onBlur,
    autofocus = false,
    ydoc,
    collaborationEnabled = false,
    userName = 'Anonymous',
    userColor = '#000000',
  } = options

  const editor = useEditor({
    extensions: [
      // StarterKit includes:
      // - Bold, Italic, Strike, Code (text formatting)
      // - Heading (H1-H6)
      // - Paragraph
      // - BulletList, OrderedList, ListItem
      // - Blockquote
      // - CodeBlock
      // - HorizontalRule
      // - HardBreak
      // - Dropcursor
      // - Gapcursor
      // - History (undo/redo)
      // Note: When collaboration is enabled, Yjs provides its own undo/redo
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3, 4, 5, 6], // Enable all heading levels
        },
        bulletList: {
          keepMarks: true,
          keepAttributes: false,
        },
        orderedList: {
          keepMarks: true,
          keepAttributes: false,
        },
        codeBlock: {
          languageClassPrefix: 'language-',
        },
      }),

      // Table extension for structured data
      Table.configure({
        resizable: true,
        handleWidth: 5,
        cellMinWidth: 50,
        lastColumnResizable: true,
        allowTableNodeSelection: true,
      }),
      TableRow,
      TableCell,
      TableHeader,

      // Placeholder extension for empty state
      Placeholder.configure({
        placeholder,
        showOnlyWhenEditable: true,
        showOnlyCurrent: false,
        emptyEditorClass: 'is-editor-empty',
      }),

      // TaskList extension for checklists
      TaskList.configure({
        HTMLAttributes: {
          class: 'task-list',
        },
      }),
      TaskItem.configure({
        nested: true,
        HTMLAttributes: {
          class: 'task-item',
        },
      }),

      // Collaboration extensions (only when enabled)
      ...(collaborationEnabled && ydoc
        ? [
            // Collaboration extension for Yjs CRDT integration
            // This enables real-time collaborative editing
            Collaboration.configure({
              document: ydoc,
              // Use a specific fragment name for the document content
              field: 'default',
            }),
            // CollaborationCaret shows cursor positions of other users
            CollaborationCaret.configure({
              provider: null, // Provider is managed separately
              user: {
                name: userName,
                color: userColor,
              },
            }),
          ]
        : []),
    ],

    content: collaborationEnabled ? undefined : content,
    editable,
    autofocus,

    // Handle content updates
    onUpdate: ({ editor }) => {
      if (onUpdate) {
        const json = editor.getJSON()
        onUpdate(json)
      }
    },

    // Handle blur events
    onBlur: () => {
      if (onBlur) {
        onBlur()
      }
    },

    // Editor props for additional configuration
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose lg:prose-lg xl:prose-xl focus:outline-none max-w-none',
        spellcheck: 'true',
      },
    },
  })

  return editor
}

/**
 * Helper function to check if editor has content
 */
export function isEditorEmpty(editor: Editor | null): boolean {
  if (!editor) return true
  return editor.isEmpty
}

/**
 * Helper function to get editor content as JSON
 */
export function getEditorJSON(editor: Editor | null): JSONContent | null {
  if (!editor) return null
  return editor.getJSON()
}

/**
 * Helper function to get editor content as HTML
 */
export function getEditorHTML(editor: Editor | null): string {
  if (!editor) return ''
  return editor.getHTML()
}

/**
 * Helper function to get editor content as plain text
 */
export function getEditorText(editor: Editor | null): string {
  if (!editor) return ''
  return editor.getText()
}

/**
 * Helper function to set editor content
 */
export function setEditorContent(
  editor: Editor | null,
  content: JSONContent | string
): void {
  if (!editor) return
  editor.commands.setContent(content)
}

/**
 * Helper function to clear editor content
 */
export function clearEditorContent(editor: Editor | null): void {
  if (!editor) return
  editor.commands.clearContent()
}

/**
 * Helper function to focus the editor
 */
export function focusEditor(editor: Editor | null): void {
  if (!editor) return
  editor.commands.focus()
}
