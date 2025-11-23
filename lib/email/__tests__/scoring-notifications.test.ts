/**
 * Tests for Scoring Notification Functions
 * 
 * These tests verify that scoring notification emails are properly generated
 * and sent to the correct recipients.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Scoring Notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Email Template Generation', () => {
    it('should generate proposal scored email with correct content', async () => {
      const { getProposalScoredEmail } = await import('../templates');
      
      const result = getProposalScoredEmail({
        leadName: 'John Doe',
        proposalTitle: 'Test Proposal',
        projectTitle: 'Test Project',
        totalScore: 85.5,
        rank: 2,
        proposalUrl: 'https://example.com/proposals/123',
      });

      expect(result.subject).toContain('Test Proposal');
      expect(result.html).toContain('John Doe');
      expect(result.html).toContain('85.50');
      expect(result.html).toContain('#2');
      expect(result.text).toContain('Test Project');
    });

    it('should generate score updated email with score increase', async () => {
      const { getScoreUpdatedEmail } = await import('../templates');
      
      const result = getScoreUpdatedEmail({
        leadName: 'Jane Smith',
        proposalTitle: 'Updated Proposal',
        projectTitle: 'Test Project',
        previousScore: 75.0,
        newScore: 85.0,
        previousRank: 3,
        newRank: 2,
        proposalUrl: 'https://example.com/proposals/456',
      });

      expect(result.subject).toContain('Updated Proposal');
      expect(result.html).toContain('Jane Smith');
      expect(result.html).toContain('75.00');
      expect(result.html).toContain('85.00');
      expect(result.html).toContain('+10.00');
      expect(result.text).toContain('improved');
    });

    it('should generate score updated email with score decrease', async () => {
      const { getScoreUpdatedEmail } = await import('../templates');
      
      const result = getScoreUpdatedEmail({
        leadName: 'Bob Johnson',
        proposalTitle: 'Revised Proposal',
        projectTitle: 'Test Project',
        previousScore: 90.0,
        newScore: 80.0,
        previousRank: 1,
        newRank: 2,
        proposalUrl: 'https://example.com/proposals/789',
      });

      expect(result.subject).toContain('Revised Proposal');
      expect(result.html).toContain('Bob Johnson');
      expect(result.html).toContain('90.00');
      expect(result.html).toContain('80.00');
      expect(result.html).toContain('-10.00');
    });

    it('should generate all proposals scored email', async () => {
      const { getAllProposalsScoredEmail } = await import('../templates');
      
      const result = getAllProposalsScoredEmail({
        clientName: 'Alice Client',
        projectTitle: 'Complete Project',
        proposalCount: 5,
        topProposalTitle: 'Winning Proposal',
        topProposalScore: 95.5,
        projectUrl: 'https://example.com/projects/999',
      });

      expect(result.subject).toContain('Complete Project');
      expect(result.html).toContain('Alice Client');
      expect(result.html).toContain('5 proposals');
      expect(result.html).toContain('Winning Proposal');
      expect(result.html).toContain('95.50');
      expect(result.text).toContain('Congratulations');
    });

    it('should handle singular proposal count correctly', async () => {
      const { getAllProposalsScoredEmail } = await import('../templates');
      
      const result = getAllProposalsScoredEmail({
        clientName: 'Test Client',
        projectTitle: 'Single Proposal Project',
        proposalCount: 1,
        topProposalTitle: 'Only Proposal',
        topProposalScore: 88.0,
        projectUrl: 'https://example.com/projects/111',
      });

      expect(result.html).toContain('1 proposal');
      expect(result.html).not.toContain('1 proposals');
    });
  });

  describe('Notification Logic', () => {
    it('should correctly identify rank improvements', async () => {
      const { getScoreUpdatedEmail } = await import('../templates');
      
      // Rank improved from 3 to 1 (lower rank number is better)
      const result = getScoreUpdatedEmail({
        leadName: 'Test Lead',
        proposalTitle: 'Test',
        projectTitle: 'Test',
        previousScore: 70.0,
        newScore: 95.0,
        previousRank: 3,
        newRank: 1,
        proposalUrl: 'https://example.com',
      });

      expect(result.html).toContain('⬆️');
    });

    it('should correctly identify rank declines', async () => {
      const { getScoreUpdatedEmail } = await import('../templates');
      
      // Rank declined from 1 to 3 (higher rank number is worse)
      const result = getScoreUpdatedEmail({
        leadName: 'Test Lead',
        proposalTitle: 'Test',
        projectTitle: 'Test',
        previousScore: 95.0,
        newScore: 70.0,
        previousRank: 1,
        newRank: 3,
        proposalUrl: 'https://example.com',
      });

      expect(result.html).toContain('⬇️');
    });

    it('should handle unchanged ranks', async () => {
      const { getScoreUpdatedEmail } = await import('../templates');
      
      // Rank stayed the same
      const result = getScoreUpdatedEmail({
        leadName: 'Test Lead',
        proposalTitle: 'Test',
        projectTitle: 'Test',
        previousScore: 80.0,
        newScore: 82.0,
        previousRank: 2,
        newRank: 2,
        proposalUrl: 'https://example.com',
      });

      expect(result.html).toContain('➡️');
    });
  });

  describe('Email Content Validation', () => {
    it('should include all required sections in proposal scored email', async () => {
      const { getProposalScoredEmail } = await import('../templates');
      
      const result = getProposalScoredEmail({
        leadName: 'Test Lead',
        proposalTitle: 'Test Proposal',
        projectTitle: 'Test Project',
        totalScore: 85.0,
        rank: 1,
        proposalUrl: 'https://example.com/proposals/123',
      });

      // Check HTML content
      expect(result.html).toContain('Your Proposal Has Been Scored');
      expect(result.html).toContain('Scoring Results:');
      expect(result.html).toContain('View Your Scores');
      expect(result.html).toContain('What\'s Next?');
      expect(result.html).toContain('BidSync');

      // Check text content
      expect(result.text).toContain('Your Proposal Has Been Scored');
      expect(result.text).toContain('Scoring Results:');
      expect(result.text).toContain('View Your Scores:');
      expect(result.text).toContain('What\'s Next?');
    });

    it('should include all required sections in all proposals scored email', async () => {
      const { getAllProposalsScoredEmail } = await import('../templates');
      
      const result = getAllProposalsScoredEmail({
        clientName: 'Test Client',
        projectTitle: 'Test Project',
        proposalCount: 3,
        topProposalTitle: 'Top Proposal',
        topProposalScore: 92.0,
        projectUrl: 'https://example.com/projects/123',
      });

      // Check HTML content
      expect(result.html).toContain('All Proposals Have Been Scored');
      expect(result.html).toContain('Scoring Complete:');
      expect(result.html).toContain('View Rankings & Make Decision');
      expect(result.html).toContain('Next Steps:');

      // Check text content
      expect(result.text).toContain('All Proposals Have Been Scored');
      expect(result.text).toContain('Scoring Complete:');
      expect(result.text).toContain('Next Steps:');
    });
  });

  describe('URL Generation', () => {
    it('should include correct proposal URL in scored notification', async () => {
      const { getProposalScoredEmail } = await import('../templates');
      
      const proposalUrl = 'https://bidsync.com/proposals/abc123';
      const result = getProposalScoredEmail({
        leadName: 'Test',
        proposalTitle: 'Test',
        projectTitle: 'Test',
        totalScore: 80.0,
        rank: 1,
        proposalUrl,
      });

      expect(result.html).toContain(proposalUrl);
      expect(result.text).toContain(proposalUrl);
    });

    it('should include correct project URL in all scored notification', async () => {
      const { getAllProposalsScoredEmail } = await import('../templates');
      
      const projectUrl = 'https://bidsync.com/projects/xyz789';
      const result = getAllProposalsScoredEmail({
        clientName: 'Test',
        projectTitle: 'Test',
        proposalCount: 2,
        topProposalTitle: 'Test',
        topProposalScore: 90.0,
        projectUrl,
      });

      expect(result.html).toContain(projectUrl);
      expect(result.text).toContain(projectUrl);
    });
  });
});
