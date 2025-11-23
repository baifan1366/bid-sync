/**
 * Conflict Detection Hook
 * 
 * Manages conflict detection and resolution in collaborative editing.
 * Integrates with sync service and TipTap editor.
 * 
 * Requirements: 3.3, 3.5
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import { Editor } from '@tiptap/react'
import { syncService, SyncConflict } from '@/lib/sync-service'
import { JSONContent } from '@/types/document'
import {
  markConflictRanges,
  clearConflictIndicators,
  detectConflictRanges,
} from '@/lib/tiptap/conflict-indicator-extension'

export interface UseConflictDetectionOptions {
  documentId: string
  editor: Editor | null
  enabled?: boolean
}

export interface UseConflictDetectionReturn {
  conflicts: SyncConflict[]
  hasConflicts: boolean
  isCheckingConflicts: boolean
  checkForConflicts: (localContent: JSONContent, serverContent: JSONContent) => Promise<void>
  resolveConflict: (conflictId: string, resolvedContent: JSONContent) => Promise<void>
  resolveAllConflicts: (resolution: 'local' | 'server') => Promise<void>
  clearConflicts: () => void
}

/**
 * Hook for managing conflict detection and resolution
 * 
 * Features:
 * - Automatic conflict detection
 * - Visual conflict indicators in editor
 * - Conflict resolution management
 * - Integration with sync service
 */
export function useConflictDetection({
  documentId,
  editor,
  enabled = true,
}: UseConflictDetectionOptions): UseConflictDetectionReturn {
  const [conflicts, setConflicts] = useState<SyncConflict[]>([])
  const [isCheckingConflicts, setIsCheckingConflicts] = useState(false)

  /**
   * Check for conflicts between local and server content
   */
  const checkForConflicts = useCallback(
    async (localContent: JSONContent, serverContent: JSONContent) => {
      if (!enabled) return

      setIsCheckingConflicts(true)
      try {
        const conflict = await syncService.detectConflict(
          documentId,
          localContent,
          serverContent
        )

        if (conflict) {
          setConflicts(prev => {
            // Avoid duplicates
            const exists = prev.some(c => c.id === conflict.id)
            if (exists) return prev
            return [...prev, conflict]
          })

          // Mark conflict ranges in editor
          if (editor) {
            const localText = JSON.stringify(localContent)
            const serverText = JSON.stringify(serverContent)
            const ranges = detectConflictRanges(localText, serverText)
            markConflictRanges(editor, ranges)
          }
        }
      } catch (error) {
        console.error('Error checking for conflicts:', error)
      } finally {
        setIsCheckingConflicts(false)
      }
    },
    [documentId, editor, enabled]
  )

  /**
   * Resolve a single conflict
   */
  const resolveConflict = useCallback(
    async (conflictId: string, resolvedContent: JSONContent) => {
      try {
        await syncService.resolveConflict(conflictId, resolvedContent)

        // Remove from local state
        setConflicts(prev => prev.filter(c => c.id !== conflictId))

        // Clear conflict indicators if no more conflicts
        if (conflicts.length === 1 && editor) {
          clearConflictIndicators(editor)
        }
      } catch (error) {
        console.error('Error resolving conflict:', error)
        throw error
      }
    },
    [conflicts.length, editor]
  )

  /**
   * Resolve all conflicts with a single resolution strategy
   */
  const resolveAllConflicts = useCallback(
    async (resolution: 'local' | 'server') => {
      try {
        // Resolve each conflict
        for (const conflict of conflicts) {
          const resolvedContent =
            resolution === 'local' ? conflict.localVersion : conflict.serverVersion
          await syncService.resolveConflict(conflict.id, resolvedContent)
        }

        // Clear all conflicts
        setConflicts([])

        // Clear conflict indicators
        if (editor) {
          clearConflictIndicators(editor)
        }
      } catch (error) {
        console.error('Error resolving all conflicts:', error)
        throw error
      }
    },
    [conflicts, editor]
  )

  /**
   * Clear all conflicts without resolving
   */
  const clearConflicts = useCallback(() => {
    setConflicts([])
    if (editor) {
      clearConflictIndicators(editor)
    }
  }, [editor])

  /**
   * Load existing conflicts on mount
   */
  useEffect(() => {
    if (!enabled) return

    const loadConflicts = async () => {
      try {
        const existingConflicts = await syncService.getConflicts(documentId)
        setConflicts(existingConflicts)
      } catch (error) {
        console.error('Error loading conflicts:', error)
      }
    }

    loadConflicts()
  }, [documentId, enabled])

  return {
    conflicts,
    hasConflicts: conflicts.length > 0,
    isCheckingConflicts,
    checkForConflicts,
    resolveConflict,
    resolveAllConflicts,
    clearConflicts,
  }
}
