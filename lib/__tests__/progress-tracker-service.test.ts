/**
 * Unit tests for Progress Tracker Service
 * 
 * Tests core functionality of the progress tracker including
 * status updates, progress calculation, deadline management, and real-time updates.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ProgressTrackerService, createProgressTracker } from '../progress-tracker-service';

// Create mock functions
const mockFrom = vi.fn(() => ({
  select: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  not: vi.fn().mockReturnThis(),
  order: vi.fn().mockResolvedValue({ data: [], error: null })
}));

const mockRpc = vi.fn();
const mockChannel = vi.fn(() => ({
  on: vi.fn().mockReturnThis(),
  subscribe: vi.fn()
}));
const mockRemoveChannel = vi.fn();

// Mock Supabase client
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: mockFrom,
    rpc: mockRpc,
    channel: mockChannel,
    removeChannel: mockRemoveChannel
  })
}));

describe('ProgressTrackerService', () => {
  let progressTracker: ProgressTrackerService;
  const mockUserId = 'user-123';
  const mockSectionId = 'section-456';
  const mockDocumentId = 'doc-789';

  beforeEach(() => {
    progressTracker = createProgressTracker();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await progressTracker.cleanup();
  });

  describe('initialization', () => {
    it('should initialize with user ID', async () => {
      await expect(progressTracker.initialize(mockUserId)).resolves.not.toThrow();
    });
  });

  describe('status updates', () => {
    beforeEach(async () => {
      await progressTracker.initialize(mockUserId);
    });

    it('should update section status successfully', async () => {
      const mockUpdate = vi.fn().mockReturnThis();
      const mockEq = vi.fn().mockResolvedValue({ error: null });
      
      mockFrom.mockReturnValueOnce({
        update: mockUpdate,
        eq: mockEq
      } as any);

      mockUpdate.mockReturnValueOnce({ eq: mockEq });

      await expect(
        progressTracker.updateSectionStatus(mockSectionId, 'in_progress')
      ).resolves.not.toThrow();
    });

    it('should throw error when status update fails', async () => {
      const mockUpdate = vi.fn().mockReturnThis();
      const mockEq = vi.fn().mockResolvedValue({ error: new Error('DB error') });
      
      mockFrom.mockReturnValueOnce({
        update: mockUpdate,
        eq: mockEq
      } as any);

      mockUpdate.mockReturnValueOnce({ eq: mockEq });

      await expect(
        progressTracker.updateSectionStatus(mockSectionId, 'in_progress')
      ).rejects.toThrow();
    });
  });

  describe('progress calculation', () => {
    beforeEach(async () => {
      await progressTracker.initialize(mockUserId);
    });

    it('should calculate document progress correctly', async () => {
      const mockProgressData = [{
        total_sections: 10,
        not_started: 2,
        in_progress: 3,
        in_review: 2,
        completed: 3,
        completion_percentage: '30.00'
      }];
      
      mockRpc.mockResolvedValueOnce({ data: mockProgressData, error: null });

      const progress = await progressTracker.getOverallProgress(mockDocumentId);
      
      expect(progress.totalSections).toBe(10);
      expect(progress.completed).toBe(3);
      expect(progress.completionPercentage).toBe(30);
    });

    it('should return zero progress for empty document', async () => {
      mockRpc.mockResolvedValueOnce({ data: [], error: null });

      const progress = await progressTracker.getOverallProgress(mockDocumentId);
      
      expect(progress.totalSections).toBe(0);
      expect(progress.completionPercentage).toBe(0);
    });
  });

  describe('deadline management', () => {
    beforeEach(async () => {
      await progressTracker.initialize(mockUserId);
    });

    it('should set section deadline successfully', async () => {
      const mockUpdate = vi.fn().mockReturnThis();
      const mockEq = vi.fn().mockResolvedValue({ error: null });
      
      mockFrom.mockReturnValueOnce({
        update: mockUpdate,
        eq: mockEq
      } as any);

      mockUpdate.mockReturnValueOnce({ eq: mockEq });

      const deadline = new Date('2024-12-31');
      await expect(
        progressTracker.setDeadline(mockSectionId, deadline)
      ).resolves.not.toThrow();
    });

    it('should get upcoming deadlines', async () => {
      const mockDeadlineData = [{
        section_id: mockSectionId,
        title: 'Test Section',
        deadline: new Date().toISOString(),
        assigned_to: mockUserId,
        status: 'in_progress',
        is_overdue: false,
        hours_remaining: '12.50'
      }];
      
      mockRpc.mockResolvedValueOnce({ data: mockDeadlineData, error: null });

      const deadlines = await progressTracker.getUpcomingDeadlines(mockDocumentId);
      
      expect(deadlines).toHaveLength(1);
      expect(deadlines[0].sectionId).toBe(mockSectionId);
      expect(deadlines[0].isOverdue).toBe(false);
    });
  });

  describe('section assignment', () => {
    beforeEach(async () => {
      await progressTracker.initialize(mockUserId);
    });

    it('should assign section to user', async () => {
      const mockUpdate = vi.fn().mockReturnThis();
      const mockEq = vi.fn().mockResolvedValue({ error: null });
      
      mockFrom.mockReturnValueOnce({
        update: mockUpdate,
        eq: mockEq
      } as any);

      mockUpdate.mockReturnValueOnce({ eq: mockEq });

      await expect(
        progressTracker.assignSection(mockSectionId, mockUserId)
      ).resolves.not.toThrow();
    });

    it('should unassign section', async () => {
      const mockUpdate = vi.fn().mockReturnThis();
      const mockEq = vi.fn().mockResolvedValue({ error: null });
      
      mockFrom.mockReturnValueOnce({
        update: mockUpdate,
        eq: mockEq
      } as any);

      mockUpdate.mockReturnValueOnce({ eq: mockEq });

      await expect(
        progressTracker.unassignSection(mockSectionId)
      ).resolves.not.toThrow();
    });
  });

  describe('progress change callbacks', () => {
    beforeEach(async () => {
      await progressTracker.initialize(mockUserId);
    });

    it('should register and unregister callbacks', () => {
      const callback = vi.fn();
      const unsubscribe = progressTracker.onProgressChange(callback);
      
      expect(typeof unsubscribe).toBe('function');
      
      unsubscribe();
    });
  });

  describe('cleanup', () => {
    beforeEach(async () => {
      await progressTracker.initialize(mockUserId);
    });

    it('should clean up all resources', async () => {
      await expect(progressTracker.cleanup()).resolves.not.toThrow();
    });
  });
});
