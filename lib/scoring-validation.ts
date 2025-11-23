/**
 * Scoring System Validation Utilities
 * 
 * Provides validation functions for the proposal scoring system.
 * Includes client-side and server-side validation for templates,
 * criteria, scores, and rankings.
 * 
 * Requirements: All scoring system requirements
 */

import { ValidationResult } from './validation-utils';

/**
 * Scoring validation configuration
 */
export const SCORING_VALIDATION_CONFIG = {
  // Score range
  minScore: 1,
  maxScore: 10,
  
  // Weight constraints
  totalWeightRequired: 100,
  minWeight: 0.01,
  maxWeight: 100,
  
  // Criteria constraints
  minCriteria: 1,
  maxCriteria: 20,
  maxCriterionNameLength: 100,
  maxCriterionDescriptionLength: 500,
  
  // Template constraints
  maxTemplateNameLength: 100,
  maxTemplateDescriptionLength: 500,
  
  // Notes constraints
  maxNotesLength: 2000,
  
  // Revision constraints
  maxRevisionReasonLength: 500,
  minRevisionReasonLength: 10,
  
  // Comparison constraints
  minProposalsForComparison: 2,
  maxProposalsForComparison: 4,
} as const;

/**
 * Validate raw score value
 * Requirements: 3.2
 */
export function validateRawScore(
  score: any,
  fieldName: string = 'Score'
): ValidationResult {
  // Check if value exists
  if (score === null || score === undefined || score === '') {
    return {
      valid: false,
      error: `${fieldName} is required`,
    };
  }

  // Convert to number if string
  const numScore = typeof score === 'string' ? parseFloat(score) : score;

  // Check if valid number
  if (typeof numScore !== 'number' || isNaN(numScore)) {
    return {
      valid: false,
      error: `${fieldName} must be a valid number`,
    };
  }

  // Check if finite
  if (!isFinite(numScore)) {
    return {
      valid: false,
      error: `${fieldName} must be a finite number`,
    };
  }

  // Check range
  if (numScore < SCORING_VALIDATION_CONFIG.minScore || numScore > SCORING_VALIDATION_CONFIG.maxScore) {
    return {
      valid: false,
      error: `${fieldName} must be between ${SCORING_VALIDATION_CONFIG.minScore} and ${SCORING_VALIDATION_CONFIG.maxScore}`,
    };
  }

  return { valid: true };
}

/**
 * Validate criterion weight
 * Requirements: 1.3
 */
export function validateWeight(
  weight: any,
  fieldName: string = 'Weight'
): ValidationResult {
  // Check if value exists
  if (weight === null || weight === undefined || weight === '') {
    return {
      valid: false,
      error: `${fieldName} is required`,
    };
  }

  // Convert to number if string
  const numWeight = typeof weight === 'string' ? parseFloat(weight) : weight;

  // Check if valid number
  if (typeof numWeight !== 'number' || isNaN(numWeight)) {
    return {
      valid: false,
      error: `${fieldName} must be a valid number`,
    };
  }

  // Check if finite
  if (!isFinite(numWeight)) {
    return {
      valid: false,
      error: `${fieldName} must be a finite number`,
    };
  }

  // Check range
  if (numWeight < SCORING_VALIDATION_CONFIG.minWeight || numWeight > SCORING_VALIDATION_CONFIG.maxWeight) {
    return {
      valid: false,
      error: `${fieldName} must be between ${SCORING_VALIDATION_CONFIG.minWeight}% and ${SCORING_VALIDATION_CONFIG.maxWeight}%`,
    };
  }

  return { valid: true };
}

/**
 * Validate that weights sum to 100%
 * Requirements: 1.4
 */
export function validateWeightSum(
  weights: number[],
  tolerance: number = 0.01
): ValidationResult {
  if (!Array.isArray(weights) || weights.length === 0) {
    return {
      valid: false,
      error: 'At least one criterion with a weight is required',
    };
  }

  const sum = weights.reduce((acc, w) => acc + w, 0);
  const diff = Math.abs(sum - SCORING_VALIDATION_CONFIG.totalWeightRequired);

  if (diff > tolerance) {
    return {
      valid: false,
      error: `Total weight must equal ${SCORING_VALIDATION_CONFIG.totalWeightRequired}% (current: ${sum.toFixed(2)}%)`,
    };
  }

  return { valid: true };
}

/**
 * Validate scoring criterion
 * Requirements: 1.2, 1.3
 */
export function validateScoringCriterion(criterion: {
  name?: string;
  description?: string;
  weight?: number;
  orderIndex?: number;
}): ValidationResult {
  // Validate name
  if (!criterion.name || criterion.name.trim().length === 0) {
    return {
      valid: false,
      error: 'Criterion name is required',
    };
  }

  if (criterion.name.length > SCORING_VALIDATION_CONFIG.maxCriterionNameLength) {
    return {
      valid: false,
      error: `Criterion name must be ${SCORING_VALIDATION_CONFIG.maxCriterionNameLength} characters or less`,
    };
  }

  // Validate description (optional)
  if (criterion.description && criterion.description.length > SCORING_VALIDATION_CONFIG.maxCriterionDescriptionLength) {
    return {
      valid: false,
      error: `Criterion description must be ${SCORING_VALIDATION_CONFIG.maxCriterionDescriptionLength} characters or less`,
    };
  }

  // Validate weight
  const weightValidation = validateWeight(criterion.weight, 'Criterion weight');
  if (!weightValidation.valid) {
    return weightValidation;
  }

  // Validate order index
  if (criterion.orderIndex !== undefined) {
    if (typeof criterion.orderIndex !== 'number' || criterion.orderIndex < 0) {
      return {
        valid: false,
        error: 'Order index must be a non-negative number',
      };
    }
  }

  return { valid: true };
}

/**
 * Validate scoring template
 * Requirements: 1.1, 1.2, 1.4
 */
export function validateScoringTemplate(template: {
  name?: string;
  description?: string;
  criteria?: Array<{
    name: string;
    description?: string;
    weight: number;
    orderIndex: number;
  }>;
}): ValidationResult {
  // Validate name
  if (!template.name || template.name.trim().length === 0) {
    return {
      valid: false,
      error: 'Template name is required',
    };
  }

  if (template.name.length > SCORING_VALIDATION_CONFIG.maxTemplateNameLength) {
    return {
      valid: false,
      error: `Template name must be ${SCORING_VALIDATION_CONFIG.maxTemplateNameLength} characters or less`,
    };
  }

  // Validate description (optional)
  if (template.description && template.description.length > SCORING_VALIDATION_CONFIG.maxTemplateDescriptionLength) {
    return {
      valid: false,
      error: `Template description must be ${SCORING_VALIDATION_CONFIG.maxTemplateDescriptionLength} characters or less`,
    };
  }

  // Validate criteria
  if (!template.criteria || !Array.isArray(template.criteria)) {
    return {
      valid: false,
      error: 'Template must have criteria',
    };
  }

  if (template.criteria.length < SCORING_VALIDATION_CONFIG.minCriteria) {
    return {
      valid: false,
      error: `Template must have at least ${SCORING_VALIDATION_CONFIG.minCriteria} criterion`,
    };
  }

  if (template.criteria.length > SCORING_VALIDATION_CONFIG.maxCriteria) {
    return {
      valid: false,
      error: `Template cannot have more than ${SCORING_VALIDATION_CONFIG.maxCriteria} criteria`,
    };
  }

  // Validate each criterion
  for (let i = 0; i < template.criteria.length; i++) {
    const criterionValidation = validateScoringCriterion(template.criteria[i]);
    if (!criterionValidation.valid) {
      return {
        valid: false,
        error: `Criterion ${i + 1}: ${criterionValidation.error}`,
      };
    }
  }

  // Check for duplicate criterion names
  const names = template.criteria.map(c => c.name.trim().toLowerCase());
  const uniqueNames = new Set(names);
  if (names.length !== uniqueNames.size) {
    return {
      valid: false,
      error: 'Criterion names must be unique',
    };
  }

  // Validate weight sum
  const weights = template.criteria.map(c => c.weight);
  const weightSumValidation = validateWeightSum(weights);
  if (!weightSumValidation.valid) {
    return weightSumValidation;
  }

  return { valid: true };
}

/**
 * Validate proposal score
 * Requirements: 3.2, 3.3
 */
export function validateProposalScore(score: {
  proposalId?: string;
  criterionId?: string;
  rawScore?: number;
  notes?: string;
}): ValidationResult {
  // Validate proposal ID
  if (!score.proposalId || score.proposalId.trim().length === 0) {
    return {
      valid: false,
      error: 'Proposal ID is required',
    };
  }

  // Validate criterion ID
  if (!score.criterionId || score.criterionId.trim().length === 0) {
    return {
      valid: false,
      error: 'Criterion ID is required',
    };
  }

  // Validate raw score
  const scoreValidation = validateRawScore(score.rawScore, 'Raw score');
  if (!scoreValidation.valid) {
    return scoreValidation;
  }

  // Validate notes (optional)
  if (score.notes && score.notes.length > SCORING_VALIDATION_CONFIG.maxNotesLength) {
    return {
      valid: false,
      error: `Notes must be ${SCORING_VALIDATION_CONFIG.maxNotesLength} characters or less`,
    };
  }

  return { valid: true };
}

/**
 * Validate score revision
 * Requirements: 8.1, 8.2
 */
export function validateScoreRevision(revision: {
  proposalId?: string;
  criterionId?: string;
  newRawScore?: number;
  newNotes?: string;
  reason?: string;
}): ValidationResult {
  // Validate proposal ID
  if (!revision.proposalId || revision.proposalId.trim().length === 0) {
    return {
      valid: false,
      error: 'Proposal ID is required',
    };
  }

  // Validate criterion ID
  if (!revision.criterionId || revision.criterionId.trim().length === 0) {
    return {
      valid: false,
      error: 'Criterion ID is required',
    };
  }

  // Validate new raw score
  const scoreValidation = validateRawScore(revision.newRawScore, 'New score');
  if (!scoreValidation.valid) {
    return scoreValidation;
  }

  // Validate notes (optional)
  if (revision.newNotes && revision.newNotes.length > SCORING_VALIDATION_CONFIG.maxNotesLength) {
    return {
      valid: false,
      error: `Notes must be ${SCORING_VALIDATION_CONFIG.maxNotesLength} characters or less`,
    };
  }

  // Validate reason (required for revisions)
  if (!revision.reason || revision.reason.trim().length === 0) {
    return {
      valid: false,
      error: 'Revision reason is required',
    };
  }

  if (revision.reason.length < SCORING_VALIDATION_CONFIG.minRevisionReasonLength) {
    return {
      valid: false,
      error: `Revision reason must be at least ${SCORING_VALIDATION_CONFIG.minRevisionReasonLength} characters`,
    };
  }

  if (revision.reason.length > SCORING_VALIDATION_CONFIG.maxRevisionReasonLength) {
    return {
      valid: false,
      error: `Revision reason must be ${SCORING_VALIDATION_CONFIG.maxRevisionReasonLength} characters or less`,
    };
  }

  return { valid: true };
}

/**
 * Validate comparison proposal selection
 * Requirements: 6.1
 */
export function validateComparisonSelection(proposalIds: string[]): ValidationResult {
  if (!Array.isArray(proposalIds)) {
    return {
      valid: false,
      error: 'Proposal IDs must be an array',
    };
  }

  if (proposalIds.length < SCORING_VALIDATION_CONFIG.minProposalsForComparison) {
    return {
      valid: false,
      error: `Select at least ${SCORING_VALIDATION_CONFIG.minProposalsForComparison} proposals to compare`,
    };
  }

  if (proposalIds.length > SCORING_VALIDATION_CONFIG.maxProposalsForComparison) {
    return {
      valid: false,
      error: `Cannot compare more than ${SCORING_VALIDATION_CONFIG.maxProposalsForComparison} proposals at once`,
    };
  }

  // Check for duplicates
  const uniqueIds = new Set(proposalIds);
  if (uniqueIds.size !== proposalIds.length) {
    return {
      valid: false,
      error: 'Cannot compare the same proposal multiple times',
    };
  }

  // Check that all IDs are valid strings
  for (const id of proposalIds) {
    if (!id || typeof id !== 'string' || id.trim().length === 0) {
      return {
        valid: false,
        error: 'All proposal IDs must be valid',
      };
    }
  }

  return { valid: true };
}

/**
 * Calculate weighted score
 * Requirements: 3.3
 */
export function calculateWeightedScore(rawScore: number, weight: number): number {
  return Number(((rawScore * weight) / 100).toFixed(2));
}

/**
 * Calculate total score from weighted scores
 * Requirements: 3.4
 */
export function calculateTotalScore(weightedScores: number[]): number {
  const sum = weightedScores.reduce((acc, score) => acc + score, 0);
  return Number(sum.toFixed(2));
}

/**
 * Validate that proposal is not locked for scoring
 * Requirements: 8.5
 */
export function validateProposalNotLocked(proposalStatus: string): ValidationResult {
  const lockedStatuses = ['approved', 'rejected', 'accepted'];
  
  if (lockedStatuses.includes(proposalStatus.toLowerCase())) {
    return {
      valid: false,
      error: `Cannot modify scores for ${proposalStatus} proposals. Scoring is locked once a proposal is accepted or rejected.`,
    };
  }

  return { valid: true };
}

/**
 * Batch validate multiple scores
 * Returns all validation errors
 */
export function validateMultipleScores(
  scores: Array<{
    proposalId: string;
    criterionId: string;
    rawScore: number;
    notes?: string;
  }>
): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  scores.forEach((score, index) => {
    const result = validateProposalScore(score);
    if (!result.valid && result.error) {
      errors[`score_${index}`] = result.error;
    }
  });

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Get user-friendly error message for scoring errors
 */
export function getScoringErrorMessage(error: any): string {
  if (!error) return 'An unknown error occurred';

  // Check for specific scoring error patterns
  if (error.message) {
    const msg = error.message.toLowerCase();
    
    if (msg.includes('weight') && msg.includes('sum')) {
      return 'The total weight of all criteria must equal 100%. Please adjust the weights.';
    }
    
    if (msg.includes('score') && msg.includes('range')) {
      return `Scores must be between ${SCORING_VALIDATION_CONFIG.minScore} and ${SCORING_VALIDATION_CONFIG.maxScore}.`;
    }
    
    if (msg.includes('locked') || msg.includes('accepted') || msg.includes('rejected')) {
      return 'Cannot modify scores for accepted or rejected proposals.';
    }
    
    if (msg.includes('duplicate') && msg.includes('criterion')) {
      return 'Criterion names must be unique within a template.';
    }
    
    if (msg.includes('not found')) {
      return 'The requested resource was not found. It may have been deleted.';
    }
    
    if (msg.includes('permission') || msg.includes('forbidden')) {
      return 'You do not have permission to perform this action.';
    }
  }

  return error.message || 'An error occurred while processing your request.';
}
