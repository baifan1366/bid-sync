/**
 * React Hook for Auto-save Service
 * 
 * Provides a React hook interface for the auto-save service with:
 * - Automatic initialization and cleanup
 * - Save status tracking
 * - Manual save trigger
 * - Pending queue count
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
 */

'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { AutoSaveService, SaveStatus, SaveResult, AutoSaveConfig } from '@/lib/auto-save-service'
import { JSONContent } from '@/types/document'

export interface UseAutoSaveOptions {
  documentId: string
  getContent: () => JSONContent
  saveFunction: (content: JSONContent) => Promise<void>
  enabled?: boolean
  debounceDelay?: number
  onSaveSuccess?: (result: SaveResult) => void
  onSaveError?: (error: string) => void
}

export interface UseAutoSaveReturn {
  saveStatus: SaveStatus
  pendingCount: number
  save: () => void
  forceSave: () => Promise<SaveResult>
  isEnabled: boolean
}

/**
 * Hook for auto-save functionality
 * 
 * @example
 * ```tsx
 * const { saveStatus, save, forceSave } = useAutoSave({
 *   documentId: 'doc-123',
 *   getContent: () => editor.getJSON(),
 *   saveFunction: async (content) => {
 *     await updateDocument({ content })
 *   },
 *   enabled: true,
 * })
 * 
 * // Trigger save on content change
 * useEffect(() => {
 *   save()
 * }, [content])
 * ```
 */
export function useAutoSave({
  documentId,
  getContent,
  saveFunction,
  enabled = true,
  debounceDelay = 2000,
  onSaveSuccess,
  onSaveError,
}: UseAutoSaveOptions): UseAutoSaveReturn {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved')
  const [pendingCount, setPendingCount] = useState(0)
  const serviceRef = useRef<AutoSaveService | null>(null)

  // Initialize auto-save service
  useEffect(() => {
    if (!enabled) return

    const config: Partial<AutoSaveConfig> = {
      debounceDelay,
      onSaveStatusChange: (status) => {
        setSaveStatus(status)
      },
      onSaveSuccess,
      onSaveError,
    }

    const service = new AutoSaveService(
      documentId,
      getContent,
      saveFunction,
      config
    )

    service.start()
    serviceRef.current = service

    // Update pending count periodically
    const updatePendingCount = async () => {
      const count = await service.getPendingCount()
      setPendingCount(count)
    }

    updatePendingCount()
    const interval = setInterval(updatePendingCount, 5000) // Check every 5 seconds

    return () => {
      clearInterval(interval)
      service.destroy()
      serviceRef.current = null
    }
  }, [documentId, enabled, debounceDelay, onSaveSuccess, onSaveError])

  // Trigger save
  const save = useCallback(() => {
    if (!enabled || !serviceRef.current) return
    serviceRef.current.save()
  }, [enabled])

  // Force immediate save
  const forceSave = useCallback(async (): Promise<SaveResult> => {
    if (!enabled || !serviceRef.current) {
      return { success: false, error: 'Auto-save not enabled' }
    }
    return serviceRef.current.forceSave()
  }, [enabled])

  return {
    saveStatus,
    pendingCount,
    save,
    forceSave,
    isEnabled: enabled,
  }
}
