/**
 * Scoring Validation Tests
 * 
 * Tests for scoring system validation utilities
 */

import { describe, it, expect } from 'vitest';
import {
  validateRawScore,
  validateWeight,
  validateWeightSum,
  validateScoringCriterion,
  validateScoringTemplate,
  validateProposalScore,
  validateScoreRevision,
  validateComparisonSelection,
  validateProposalNotLocked,
  calculateWeightedScore,
  calculateTotalScore,
  SCORING_VALIDATION_CONFIG,
} from '../scoring-validation';

describe('validateRawScore', () => {
  it('should accept valid scores', () => {
    expect(validateRawScore(1).valid).toBe(true);
    expect(validateRawScore(5).valid).toBe(true);
    expect(validateRawScore(10).valid).toBe(true);
    expect(validateRawScore(7.5).valid).toBe(true);
  });

  it('should reject scores below minimum', () => {
    const result = validateRawScore(0);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('between');
  });

  it('should reject scores above maximum', () => {
    const result = validateRawScore(11);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('between');
  });

  it('should reject non-numeric values', () => {
    expect(validateRawScore('abc').valid).toBe(false);
    expect(validateRawScore(null).valid).toBe(false);
    expect(validateRawScore(undefined).valid).toBe(false);
  });

  it('should reject infinite values', () => {
    expect(validateRawScore(Infinity).valid).toBe(false);
    expect(validateRawScore(-Infinity).valid).toBe(false);
  });
});

describe('validateWeight', () => {
  it('should accept valid weights', () => {
    expect(validateWeight(0.01).valid).toBe(true);
    expect(validateWeight(25).valid).toBe(true);
    expect(validateWeight(50).valid).toBe(true);
    expect(validateWeight(100).valid).toBe(true);
  });

  it('should reject weights below minimum', () => {
    const result = validateWeight(0);
    expect(result.valid).toBe(false);
  });

  it('should reject weights above maximum', () => {
    const result = validateWeight(101);
    expect(result.valid).toBe(false);
  });

  it('should reject non-numeric values', () => {
    expect(validateWeight('abc').valid).toBe(false);
    expect(validateWeight(null).valid).toBe(false);
  });
});

describe('validateWeightSum', () => {
  it('should accept weights that sum to 100', () => {
    expect(validateWeightSum([25, 25, 25, 25]).valid).toBe(true);
    expect(validateWeightSum([30, 20, 25, 25]).valid).toBe(true);
    expect(validateWeightSum([100]).valid).toBe(true);
  });

  it('should accept weights that sum to approximately 100 within tolerance', () => {
    expect(validateWeightSum([33.33, 33.33, 33.34]).valid).toBe(true);
  });

  it('should reject weights that do not sum to 100', () => {
    const result = validateWeightSum([25, 25, 25]);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('100');
  });

  it('should reject empty weight arrays', () => {
    const result = validateWeightSum([]);
    expect(result.valid).toBe(false);
  });

  it('should provide current sum in error message', () => {
    const result = validateWeightSum([25, 25]);
    expect(result.error).toContain('50');
  });
});

describe('validateScoringCriterion', () => {
  it('should accept valid criterion', () => {
    const criterion = {
      name: 'Technical Approach',
      description: 'Evaluate technical approach',
      weight: 25,
      orderIndex: 0,
    };
    expect(validateScoringCriterion(criterion).valid).toBe(true);
  });

  it('should reject criterion without name', () => {
    const criterion = {
      name: '',
      weight: 25,
      orderIndex: 0,
    };
    const result = validateScoringCriterion(criterion);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('name');
  });

  it('should reject criterion with invalid weight', () => {
    const criterion = {
      name: 'Test',
      weight: 150,
      orderIndex: 0,
    };
    const result = validateScoringCriterion(criterion);
    expect(result.valid).toBe(false);
  });

  it('should reject criterion with negative order index', () => {
    const criterion = {
      name: 'Test',
      weight: 25,
      orderIndex: -1,
    };
    const result = validateScoringCriterion(criterion);
    expect(result.valid).toBe(false);
  });

  it('should accept criterion without description', () => {
    const criterion = {
      name: 'Test',
      weight: 25,
      orderIndex: 0,
    };
    expect(validateScoringCriterion(criterion).valid).toBe(true);
  });
});

describe('validateScoringTemplate', () => {
  it('should accept valid template', () => {
    const template = {
      name: 'Technical Template',
      description: 'For technical evaluation',
      criteria: [
        { name: 'Technical', weight: 50, orderIndex: 0 },
        { name: 'Innovation', weight: 50, orderIndex: 1 },
      ],
    };
    expect(validateScoringTemplate(template).valid).toBe(true);
  });

  it('should reject template without name', () => {
    const template = {
      name: '',
      criteria: [{ name: 'Test', weight: 100, orderIndex: 0 }],
    };
    const result = validateScoringTemplate(template);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('name');
  });

  it('should reject template without criteria', () => {
    const template = {
      name: 'Test',
      criteria: [],
    };
    const result = validateScoringTemplate(template);
    expect(result.valid).toBe(false);
  });

  it('should reject template with duplicate criterion names', () => {
    const template = {
      name: 'Test',
      criteria: [
        { name: 'Technical', weight: 50, orderIndex: 0 },
        { name: 'Technical', weight: 50, orderIndex: 1 },
      ],
    };
    const result = validateScoringTemplate(template);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('unique');
  });

  it('should reject template with weights not summing to 100', () => {
    const template = {
      name: 'Test',
      criteria: [
        { name: 'Technical', weight: 50, orderIndex: 0 },
        { name: 'Innovation', weight: 30, orderIndex: 1 },
      ],
    };
    const result = validateScoringTemplate(template);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('100');
  });

  it('should reject template with too many criteria', () => {
    const criteria = Array.from({ length: 25 }, (_, i) => ({
      name: `Criterion ${i}`,
      weight: 100 / 25,
      orderIndex: i,
    }));
    const template = {
      name: 'Test',
      criteria,
    };
    const result = validateScoringTemplate(template);
    expect(result.valid).toBe(false);
  });
});

describe('validateProposalScore', () => {
  it('should accept valid score', () => {
    const score = {
      proposalId: 'prop-123',
      criterionId: 'crit-456',
      rawScore: 8,
      notes: 'Good technical approach',
    };
    expect(validateProposalScore(score).valid).toBe(true);
  });

  it('should reject score without proposal ID', () => {
    const score = {
      proposalId: '',
      criterionId: 'crit-456',
      rawScore: 8,
    };
    const result = validateProposalScore(score);
    expect(result.valid).toBe(false);
  });

  it('should reject score with invalid raw score', () => {
    const score = {
      proposalId: 'prop-123',
      criterionId: 'crit-456',
      rawScore: 15,
    };
    const result = validateProposalScore(score);
    expect(result.valid).toBe(false);
  });

  it('should accept score without notes', () => {
    const score = {
      proposalId: 'prop-123',
      criterionId: 'crit-456',
      rawScore: 8,
    };
    expect(validateProposalScore(score).valid).toBe(true);
  });

  it('should reject score with notes exceeding max length', () => {
    const score = {
      proposalId: 'prop-123',
      criterionId: 'crit-456',
      rawScore: 8,
      notes: 'a'.repeat(SCORING_VALIDATION_CONFIG.maxNotesLength + 1),
    };
    const result = validateProposalScore(score);
    expect(result.valid).toBe(false);
  });
});

describe('validateScoreRevision', () => {
  it('should accept valid revision', () => {
    const revision = {
      proposalId: 'prop-123',
      criterionId: 'crit-456',
      newRawScore: 9,
      newNotes: 'Updated assessment',
      reason: 'Found additional information that improved the score',
    };
    expect(validateScoreRevision(revision).valid).toBe(true);
  });

  it('should reject revision without reason', () => {
    const revision = {
      proposalId: 'prop-123',
      criterionId: 'crit-456',
      newRawScore: 9,
      reason: '',
    };
    const result = validateScoreRevision(revision);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('reason');
  });

  it('should reject revision with short reason', () => {
    const revision = {
      proposalId: 'prop-123',
      criterionId: 'crit-456',
      newRawScore: 9,
      reason: 'Short',
    };
    const result = validateScoreRevision(revision);
    expect(result.valid).toBe(false);
  });

  it('should reject revision with invalid score', () => {
    const revision = {
      proposalId: 'prop-123',
      criterionId: 'crit-456',
      newRawScore: 15,
      reason: 'Valid reason for revision',
    };
    const result = validateScoreRevision(revision);
    expect(result.valid).toBe(false);
  });
});

describe('validateComparisonSelection', () => {
  it('should accept valid selection', () => {
    expect(validateComparisonSelection(['prop-1', 'prop-2']).valid).toBe(true);
    expect(validateComparisonSelection(['prop-1', 'prop-2', 'prop-3']).valid).toBe(true);
    expect(validateComparisonSelection(['prop-1', 'prop-2', 'prop-3', 'prop-4']).valid).toBe(true);
  });

  it('should reject selection with too few proposals', () => {
    const result = validateComparisonSelection(['prop-1']);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('at least');
  });

  it('should reject selection with too many proposals', () => {
    const result = validateComparisonSelection(['prop-1', 'prop-2', 'prop-3', 'prop-4', 'prop-5']);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('more than');
  });

  it('should reject selection with duplicate proposals', () => {
    const result = validateComparisonSelection(['prop-1', 'prop-1']);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('same proposal');
  });

  it('should reject non-array input', () => {
    const result = validateComparisonSelection('not-an-array' as any);
    expect(result.valid).toBe(false);
  });
});

describe('validateProposalNotLocked', () => {
  it('should accept unlocked statuses', () => {
    expect(validateProposalNotLocked('draft').valid).toBe(true);
    expect(validateProposalNotLocked('submitted').valid).toBe(true);
    expect(validateProposalNotLocked('reviewing').valid).toBe(true);
  });

  it('should reject locked statuses', () => {
    expect(validateProposalNotLocked('approved').valid).toBe(false);
    expect(validateProposalNotLocked('rejected').valid).toBe(false);
    expect(validateProposalNotLocked('accepted').valid).toBe(false);
  });

  it('should be case insensitive', () => {
    expect(validateProposalNotLocked('APPROVED').valid).toBe(false);
    expect(validateProposalNotLocked('Rejected').valid).toBe(false);
  });
});

describe('calculateWeightedScore', () => {
  it('should calculate weighted score correctly', () => {
    expect(calculateWeightedScore(8, 25)).toBe(2.0);
    expect(calculateWeightedScore(10, 30)).toBe(3.0);
    expect(calculateWeightedScore(5, 20)).toBe(1.0);
  });

  it('should round to 2 decimal places', () => {
    expect(calculateWeightedScore(7.5, 33.33)).toBe(2.5);
  });

  it('should handle edge cases', () => {
    expect(calculateWeightedScore(1, 100)).toBe(1.0);
    expect(calculateWeightedScore(10, 100)).toBe(10.0);
    expect(calculateWeightedScore(5, 0)).toBe(0.0);
  });
});

describe('calculateTotalScore', () => {
  it('should calculate total score correctly', () => {
    expect(calculateTotalScore([2.0, 3.0, 1.5, 2.5])).toBe(9.0);
    expect(calculateTotalScore([5.0, 5.0])).toBe(10.0);
  });

  it('should round to 2 decimal places', () => {
    expect(calculateTotalScore([2.333, 3.666])).toBe(6.0);
  });

  it('should handle empty array', () => {
    expect(calculateTotalScore([])).toBe(0.0);
  });

  it('should handle single score', () => {
    expect(calculateTotalScore([7.5])).toBe(7.5);
  });
});
