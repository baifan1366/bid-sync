/**
 * TipTap Conflict Indicator Extension
 * 
 * Adds visual indicators for merge conflicts in the editor.
 * Highlights conflicting content with yellow borders and warning icons.
 * 
 * Requirements: 3.3
 */

import { Mark, mergeAttributes } from '@tiptap/core'

export interface ConflictIndicatorOptions {
  HTMLAttributes: Record<string, any>
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    conflictIndicator: {
      /**
       * Set conflict indicator mark
       */
      setConflictIndicator: () => ReturnType
      /**
       * Toggle conflict indicator mark
       */
      toggleConflictIndicator: () => ReturnType
      /**
       * Unset conflict indicator mark
       */
      unsetConflictIndicator: () => ReturnType
    }
  }
}

/**
 * Conflict Indicator Extension
 * 
 * Marks text that has conflicts with a visual indicator.
 * Useful for showing users where conflicts exist in the document.
 */
export const ConflictIndicator = Mark.create<ConflictIndicatorOptions>({
  name: 'conflictIndicator',

  addOptions() {
    return {
      HTMLAttributes: {},
    }
  },

  addAttributes() {
    return {
      conflictId: {
        default: null,
        parseHTML: element => element.getAttribute('data-conflict-id'),
        renderHTML: attributes => {
          if (!attributes.conflictId) {
            return {}
          }

          return {
            'data-conflict-id': attributes.conflictId,
          }
        },
      },
      conflictType: {
        default: 'content',
        parseHTML: element => element.getAttribute('data-conflict-type'),
        renderHTML: attributes => {
          return {
            'data-conflict-type': attributes.conflictType,
          }
        },
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-conflict-indicator]',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-conflict-indicator': '',
        class: 'conflict-indicator',
        style: 'background-color: rgba(251, 191, 36, 0.2); border-bottom: 2px solid rgb(251, 191, 36); position: relative; padding: 2px 4px; border-radius: 2px;',
      }),
      0,
    ]
  },

  addCommands() {
    return {
      setConflictIndicator:
        () =>
        ({ commands }) => {
          return commands.setMark(this.name)
        },
      toggleConflictIndicator:
        () =>
        ({ commands }) => {
          return commands.toggleMark(this.name)
        },
      unsetConflictIndicator:
        () =>
        ({ commands }) => {
          return commands.unsetMark(this.name)
        },
    }
  },
})

/**
 * Helper function to mark conflicting ranges in the editor
 * 
 * @param editor - TipTap editor instance
 * @param ranges - Array of conflict ranges { from: number, to: number, conflictId: string }
 */
export function markConflictRanges(
  editor: any,
  ranges: Array<{ from: number; to: number; conflictId: string; type?: string }>
): void {
  if (!editor) return

  ranges.forEach(range => {
    editor
      .chain()
      .focus()
      .setTextSelection({ from: range.from, to: range.to })
      .setConflictIndicator()
      .run()
  })
}

/**
 * Helper function to clear all conflict indicators
 * 
 * @param editor - TipTap editor instance
 */
export function clearConflictIndicators(editor: any): void {
  if (!editor) return

  editor.chain().focus().unsetConflictIndicator().run()
}

/**
 * Helper function to find conflict ranges in document
 * 
 * @param localContent - Local document content
 * @param serverContent - Server document content
 * @returns Array of conflict ranges
 */
export function detectConflictRanges(
  localContent: string,
  serverContent: string
): Array<{ from: number; to: number; conflictId: string }> {
  const conflicts: Array<{ from: number; to: number; conflictId: string }> = []

  // Simple diff algorithm - in production, use a proper diff library
  const localLines = localContent.split('\n')
  const serverLines = serverContent.split('\n')

  let position = 0
  const maxLines = Math.max(localLines.length, serverLines.length)

  for (let i = 0; i < maxLines; i++) {
    const localLine = localLines[i] || ''
    const serverLine = serverLines[i] || ''

    if (localLine !== serverLine) {
      const from = position
      const to = position + Math.max(localLine.length, serverLine.length)

      conflicts.push({
        from,
        to,
        conflictId: `conflict-${i}-${Date.now()}`,
      })
    }

    position += localLine.length + 1 // +1 for newline
  }

  return conflicts
}
