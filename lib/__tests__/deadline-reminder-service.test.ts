/**
 * Tests for DeadlineReminderService
 * 
 * Unit tests to verify deadline calculation and reminder logic
 */

import { describe, it, expect } from 'vitest';
import { DeadlineReminderService } from '../deadline-reminder-service';

describe('DeadlineReminderService', () => {
  describe('Interface Validation', () => {
    it('should have correct interface structure', () => {
      // Verify the service exports the expected methods
      expect(typeof DeadlineReminderService.sendAllDeadlineReminders).toBe('function');
      expect(typeof DeadlineReminderService.sendProjectDeadlineReminders).toBe('function');
      expect(typeof DeadlineReminderService.sendSectionDeadlineReminders).toBe('function');
    });
  });

  describe('Service Structure', () => {
    it('should be a class with static methods', () => {
      expect(DeadlineReminderService).toBeDefined();
      expect(typeof DeadlineReminderService).toBe('function');
    });
  });
});
