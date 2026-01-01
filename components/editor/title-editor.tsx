'use client'

import * as React from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import { cn } from '@/lib/utils'

export interface TitleEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}

/**
 * Title Editor Component
 * 
 * A minimal rich text editor optimized for single-line title editing.
 * Provides a clean, focused editing experience without toolbar clutter.
 */
export function TitleEditor({
  value,
  onChange,
  placeholder = 'Enter a title...',
  className,
  disabled = false,
}: TitleEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        // Disable block-level elements for title
        heading: false,
        bulletList: false,
        orderedList: false,
        blockquote: false,
        codeBlock: false,
        horizontalRule: false,
        listItem: false,
        code: false,
      }),
      Placeholder.configure({
        placeholder,
        emptyEditorClass: 'is-editor-empty',
      }),
    ],
    content: value ? `<p>${value}</p>` : '',
    editable: !disabled,
    onUpdate: ({ editor }) => {
      // Extract plain text from editor
      const text = editor.getText()
      onChange(text)
    },
    editorProps: {
      attributes: {
        class: cn(
          'prose prose-sm dark:prose-invert max-w-none',
          'focus:outline-none',
          'min-h-[40px] py-2 px-3',
          '[&_p]:m-0 [&_p]:text-lg [&_p]:font-semibold',
          '[&_p]:text-black [&_p]:dark:text-white',
        ),
      },
      handleKeyDown: (_view, event) => {
        // Prevent Enter key to keep it single line
        if (event.key === 'Enter') {
          event.preventDefault()
          return true
        }
        return false
      },
    },
  })

  // Update editor content when value changes externally
  React.useEffect(() => {
    if (editor && value !== editor.getText()) {
      editor.commands.setContent(value ? `<p>${value}</p>` : '')
    }
  }, [editor, value])

  // Update editable state
  React.useEffect(() => {
    if (editor) {
      editor.setEditable(!disabled)
    }
  }, [editor, disabled])

  if (!editor) {
    return (
      <div
        className={cn(
          'rounded-lg border-2 border-yellow-400/30 bg-yellow-400/5 dark:bg-yellow-400/5',
          'min-h-[48px] py-2 px-3 animate-pulse',
          className
        )}
      >
        <div className="h-6 bg-yellow-400/20 rounded w-2/3"></div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'rounded-lg border-2 border-yellow-400/30 bg-yellow-400/5 dark:bg-yellow-400/5',
        'focus-within:border-yellow-400 focus-within:ring-2 focus-within:ring-yellow-400/20',
        'focus-within:bg-white dark:focus-within:bg-black',
        'transition-all duration-200',
        'hover:border-yellow-400/50',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      <EditorContent editor={editor} />
      <style jsx global>{`
        .is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: #9ca3af;
          pointer-events: none;
          height: 0;
          font-size: 1.125rem;
          font-weight: 600;
        }
      `}</style>
    </div>
  )
}
