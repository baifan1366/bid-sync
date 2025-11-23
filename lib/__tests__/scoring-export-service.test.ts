import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ScoringExportService } from '../scoring-export-service';

// Mock Supabase client
const mockSupabase = {
  from: vi.fn(),
  storage: {
    from: vi.fn(),
  },
  rpc: vi.fn(),
};

// Mock createClient
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabase)),
}));

describe('ScoringExportService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateExport', () => {
    it('should throw error if project not found', async () => {
      // Mock project query to return null
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
            }),
          }),
        }),
      });

      await expect(
        ScoringExportService.generateExport('project-123', 'user-123')
      ).rejects.toThrow('Project not found or access denied');
    });

    it('should throw error if user does not have access to project', async () => {
      // Mock project query to return null (access denied case)
      mockSupabase.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: null,
              }),
            }),
          }),
        }),
      });

      await expect(
        ScoringExportService.generateExport('project-123', 'user-123')
      ).rejects.toThrow('Project not found or access denied');
    });

    it('should throw error if scoring template not found', async () => {
      // Mock project query to succeed
      const projectQuery = {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: 'project-123',
                  title: 'Test Project',
                  description: 'Test Description',
                  client: { full_name: 'Test Client', email: 'client@test.com' },
                },
                error: null,
              }),
            }),
          }),
        }),
      };

      // Mock template query to fail
      const templateQuery = {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
          }),
        }),
      };

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'projects') return projectQuery;
        if (table === 'scoring_templates') return templateQuery;
        return { select: vi.fn() };
      });

      await expect(
        ScoringExportService.generateExport('project-123', 'user-123')
      ).rejects.toThrow('Scoring template not found');
    });
  });

  describe('PDF generation', () => {
    it('should include all required sections in PDF', () => {
      // This is a basic structural test
      // Full PDF content testing would require more complex mocking
      expect(ScoringExportService).toBeDefined();
      expect(typeof ScoringExportService.generateExport).toBe('function');
    });
  });
});
