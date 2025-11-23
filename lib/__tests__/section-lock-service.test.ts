/**
 * Unit tests for Section Lock Service
 * 
 * Tests core functionality of the section lock manager including
 * lock acquisition, release, status checking, and heartbeat mechanism.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SectionLockManager, createLockManager } from '../section-lock-service';

// Create mock functions
const mockRpc = vi.fn();
const mockChannel = vi.fn(() => ({
  on: vi.fn().mockReturnThis(),
  subscribe: vi.fn()
}));
const mockRemoveChannel = vi.fn();

// Mock Supabase client
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    rpc: mockRpc,
    channel: mockChannel,
    removeChannel: mockRemoveChannel
  })
}));

describe('SectionLockManager', () => {
  let lockManager: SectionLockManager;
  const mockUserId = 'user-123';
  const mockSectionId = 'section-456';
  const mockDocumentId = 'doc-789';

  beforeEach(() => {
    lockManager = createLockManager();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await lockManager.cleanup();
  });

  describe('initialization', () => {
    it('should initialize with user ID', async () => {
      await expect(lockManager.initialize(mockUserId)).resolves.not.toThrow();
    });

    it('should throw error when acquiring lock without initialization', async () => {
      await expect(
        lockManager.acquireLock(mockSectionId, mockDocumentId)
      ).rejects.toThrow('Lock manager not initialized');
    });
  });

  describe('lock acquisition', () => {
    beforeEach(async () => {
      await lockManager.initialize(mockUserId);
    });

    it('should return success false when lock acquisition fails', async () => {
      mockRpc.mockResolvedValueOnce({ data: null, error: new Error('DB error') });

      const result = await lockManager.acquireLock(mockSectionId, mockDocumentId);
      
      expect(result.success).toBe(false);
    });

    it('should return lock details on successful acquisition', async () => {
      const mockLockData = [{
        success: true,
        lock_id: 'lock-123',
        locked_by: mockUserId,
        expires_at: new Date().toISOString()
      }];
      
      mockRpc.mockResolvedValueOnce({ data: mockLockData, error: null });

      const result = await lockManager.acquireLock(mockSectionId, mockDocumentId);
      
      expect(result.success).toBe(true);
      expect(result.lockId).toBe('lock-123');
      expect(result.lockedBy).toBe(mockUserId);
    });
  });

  describe('lock release', () => {
    beforeEach(async () => {
      await lockManager.initialize(mockUserId);
    });

    it('should release lock successfully', async () => {
      mockRpc.mockResolvedValueOnce({ data: true, error: null });

      await expect(lockManager.releaseLock(mockSectionId)).resolves.not.toThrow();
    });

    it('should handle release errors gracefully', async () => {
      mockRpc.mockResolvedValueOnce({ data: null, error: new Error('DB error') });

      await expect(lockManager.releaseLock(mockSectionId)).resolves.not.toThrow();
    });
  });

  describe('lock status', () => {
    beforeEach(async () => {
      await lockManager.initialize(mockUserId);
    });

    it('should return unlocked status when no lock exists', async () => {
      mockRpc.mockResolvedValueOnce({ data: [], error: null });

      const status = await lockManager.getLockStatus(mockSectionId);
      
      expect(status.isLocked).toBe(false);
    });

    it('should return lock details when lock exists', async () => {
      const mockStatusData = [{
        is_locked: true,
        locked_by: mockUserId,
        locked_at: new Date().toISOString(),
        expires_at: new Date().toISOString()
      }];
      
      mockRpc.mockResolvedValueOnce({ data: mockStatusData, error: null });

      const status = await lockManager.getLockStatus(mockSectionId);
      
      expect(status.isLocked).toBe(true);
      expect(status.lockedBy).toBe(mockUserId);
    });
  });

  describe('lock change callbacks', () => {
    beforeEach(async () => {
      await lockManager.initialize(mockUserId);
    });

    it('should register and unregister callbacks', () => {
      const callback = vi.fn();
      const unsubscribe = lockManager.onLockChange(callback);
      
      expect(typeof unsubscribe).toBe('function');
      
      unsubscribe();
    });
  });

  describe('heartbeat', () => {
    beforeEach(async () => {
      await lockManager.initialize(mockUserId);
    });

    it('should return true on successful heartbeat', async () => {
      mockRpc.mockResolvedValueOnce({ data: true, error: null });

      const result = await lockManager.heartbeat('lock-123');
      
      expect(result).toBe(true);
    });

    it('should return false on failed heartbeat', async () => {
      mockRpc.mockResolvedValueOnce({ data: false, error: null });

      const result = await lockManager.heartbeat('lock-123');
      
      expect(result).toBe(false);
    });
  });

  describe('cleanup', () => {
    beforeEach(async () => {
      await lockManager.initialize(mockUserId);
    });

    it('should clean up all resources', async () => {
      mockRpc.mockResolvedValueOnce({ data: 0, error: null });

      await expect(lockManager.cleanup()).resolves.not.toThrow();
    });
  });
});
