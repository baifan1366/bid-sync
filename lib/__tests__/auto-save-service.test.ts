/**
 * Tests for Auto-save Service
 * 
 * Tests the core functionality of the auto-save service including:
 * - Debounced save operations
 * - Retry logic with exponential backoff
 * - Offline queue management
 * - Save status tracking
 * 
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { AutoSaveService, SaveStatus } from '../auto-save-service'
import { JSONContent } from '@/types/document'

// Mock IndexedDB
const mockDB = {
  add: vi.fn(),
  delete: vi.fn(),
  put: vi.fn(),
  transaction: vi.fn(),
  close: vi.fn(),
}

vi.mock('idb', () => ({
  openDB: vi.fn(() => Promise.resolve(mockDB)),
}))

describe('AutoSaveService', () => {
  let service: AutoSaveService
  let mockGetContent: () => JSONContent
  let mockSaveFunction: (content: JSONContent) => Promise<void>
  let statusChanges: SaveStatus[] = []

  beforeEach(() => {
    vi.useFakeTimers()
    statusChanges = []

    mockGetContent = vi.fn(() => ({
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Test content' }] }],
    })) as () => JSONContent

    mockSaveFunction = vi.fn(() => Promise.resolve()) as (content: JSONContent) => Promise<void>

    service = new AutoSaveService(
      'test-doc-id',
      mockGetContent,
      mockSaveFunction,
      {
        debounceDelay: 2000,
        maxRetries: 3,
        retryDelays: [1000, 2000, 4000],
        onSaveStatusChange: (status) => {
          statusChanges.push(status)
        },
      }
    )

    service.start()
  })

  afterEach(async () => {
    await service.destroy()
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  describe('Debounced Save', () => {
    it('should debounce save operations', async () => {
      // Requirement 4.2: Batch changes while typing (2 second debounce)
      
      // Trigger multiple saves rapidly
      service.save()
      service.save()
      service.save()

      // Should not save immediately
      expect(mockSaveFunction).not.toHaveBeenCalled()

      // Fast-forward past debounce delay
      await vi.advanceTimersByTimeAsync(2000)

      // Should save only once
      expect(mockSaveFunction).toHaveBeenCalledTimes(1)
    })

    it('should update status to pending then saving then saved', async () => {
      // Requirement 4.1: Track save status
      
      service.save()

      // Should be pending
      expect(statusChanges).toContain('pending')

      // Fast-forward past debounce
      await vi.advanceTimersByTimeAsync(2000)

      // Should transition to saving then saved
      expect(statusChanges).toContain('saving')
      expect(statusChanges).toContain('saved')
    })

    it('should not save if content has not changed', async () => {
      // First save
      service.save()
      await vi.advanceTimersByTimeAsync(2000)
      expect(mockSaveFunction).toHaveBeenCalledTimes(1)

      // Reset mock
      vi.mocked(mockSaveFunction).mockClear()

      // Second save with same content
      service.save()
      await vi.advanceTimersByTimeAsync(2000)

      // Should not save again
      expect(mockSaveFunction).not.toHaveBeenCalled()
    })
  })

  describe('Force Save', () => {
    it('should save immediately without debouncing', async () => {
      // Requirement 4.1: Manual save trigger
      
      const result = await service.forceSave()

      // Should save immediately
      expect(mockSaveFunction).toHaveBeenCalledTimes(1)
      expect(result.success).toBe(true)
      expect(result.savedAt).toBeInstanceOf(Date)
    })

    it('should cancel pending debounced save', async () => {
      // Start debounced save
      service.save()

      // Force save before debounce completes
      await service.forceSave()

      // Fast-forward past debounce delay
      await vi.advanceTimersByTimeAsync(2000)

      // Should only save once (from force save)
      expect(mockSaveFunction).toHaveBeenCalledTimes(1)
    })
  })

  describe('Retry Logic', () => {
    it('should retry on failure with exponential backoff', async () => {
      // Requirement 4.3: Retry up to 3 times with exponential backoff (1s, 2s, 4s)
      
      // Make save function fail
      vi.mocked(mockSaveFunction).mockRejectedValue(new Error('Network error'))

      service.save()
      await vi.advanceTimersByTimeAsync(2000) // Initial attempt

      // Should have attempted once
      expect(mockSaveFunction).toHaveBeenCalledTimes(1)

      // First retry after 1s
      await vi.advanceTimersByTimeAsync(1000)
      expect(mockSaveFunction).toHaveBeenCalledTimes(2)

      // Second retry after 2s
      await vi.advanceTimersByTimeAsync(2000)
      expect(mockSaveFunction).toHaveBeenCalledTimes(3)

      // Third retry after 4s
      await vi.advanceTimersByTimeAsync(4000)
      expect(mockSaveFunction).toHaveBeenCalledTimes(4)

      // Should not retry again (max retries reached)
      await vi.advanceTimersByTimeAsync(10000)
      expect(mockSaveFunction).toHaveBeenCalledTimes(4)
    })

    it('should update status to error after all retries exhausted', async () => {
      // Requirement 4.4: Update status on failure
      
      vi.mocked(mockSaveFunction).mockRejectedValue(new Error('Network error'))

      service.save()
      
      // Wait for all retries
      await vi.advanceTimersByTimeAsync(2000 + 1000 + 2000 + 4000)

      // Should end with error status
      expect(statusChanges[statusChanges.length - 1]).toBe('error')
    })

    it('should stop retrying on success', async () => {
      // Requirement 4.3: Stop retrying when save succeeds
      
      // Fail first attempt, succeed on retry
      vi.mocked(mockSaveFunction)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValue(undefined)

      service.save()
      await vi.advanceTimersByTimeAsync(2000) // Initial attempt fails

      // First retry succeeds
      await vi.advanceTimersByTimeAsync(1000)
      expect(mockSaveFunction).toHaveBeenCalledTimes(2)

      // Should not retry again
      await vi.advanceTimersByTimeAsync(10000)
      expect(mockSaveFunction).toHaveBeenCalledTimes(2)

      // Should end with saved status
      expect(statusChanges[statusChanges.length - 1]).toBe('saved')
    })
  })

  describe('Save Status', () => {
    it('should return current save status', () => {
      expect(service.getSaveStatus()).toBe('saved')

      service.save()
      expect(service.getSaveStatus()).toBe('pending')
    })

    it('should track all status transitions', async () => {
      service.save()
      await vi.advanceTimersByTimeAsync(2000)

      // Should have transitioned: saved (initial) -> pending -> saving -> saved
      expect(statusChanges).toEqual(['saved', 'pending', 'saving', 'saved'])
    })
  })

  describe('Content Change Detection', () => {
    it('should detect when content changes', async () => {
      // First save
      service.save()
      await vi.advanceTimersByTimeAsync(2000)
      expect(mockSaveFunction).toHaveBeenCalledTimes(1)

      // Change content
      vi.mocked(mockGetContent).mockReturnValue({
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'New content' }] }],
      })

      // Second save with different content
      service.save()
      await vi.advanceTimersByTimeAsync(2000)

      // Should save again
      expect(mockSaveFunction).toHaveBeenCalledTimes(2)
    })
  })

  describe('Cleanup', () => {
    it('should stop timers on stop()', () => {
      service.save()
      service.stop()

      // Fast-forward time
      vi.advanceTimersByTime(5000)

      // Should not have saved
      expect(mockSaveFunction).not.toHaveBeenCalled()
    })

    it('should cleanup resources on destroy()', async () => {
      await service.destroy()

      // Should have closed DB
      expect(mockDB.close).toHaveBeenCalled()
    })
  })
})
