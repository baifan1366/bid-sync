/**
 * Form Validation Hook
 * 
 * Provides real-time form validation with error state management
 * specifically for scoring system forms.
 */

import { useState, useCallback, useMemo } from 'react';
import {
  validateScoringTemplate,
  validateScoringCriterion,
  validateProposalScore,
  validateScoreRevision,
  validateWeightSum,
  validateRawScore,
  validateWeight,
  SCORING_VALIDATION_CONFIG,
} from '@/lib/scoring-validation';
import { ValidationResult } from '@/lib/validation-utils';

/**
 * Form field error state
 */
export interface FieldErrors {
  [fieldName: string]: string | undefined;
}

/**
 * Form validation state
 */
export interface ValidationState {
  errors: FieldErrors;
  isValid: boolean;
  isDirty: boolean;
}

/**
 * Hook for template form validation
 */
export function useTemplateFormValidation() {
  const [errors, setErrors] = useState<FieldErrors>({});
  const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set());

  /**
   * Validate template name
   */
  const validateName = useCallback((name: string): ValidationResult => {
    if (!name || name.trim().length === 0) {
      return { valid: false, error: 'Template name is required' };
    }

    if (name.length > SCORING_VALIDATION_CONFIG.maxTemplateNameLength) {
      return {
        valid: false,
        error: `Template name must be ${SCORING_VALIDATION_CONFIG.maxTemplateNameLength} characters or less`,
      };
    }

    return { valid: true };
  }, []);

  /**
   * Validate template description
   */
  const validateDescription = useCallback((description: string): ValidationResult => {
    if (description && description.length > SCORING_VALIDATION_CONFIG.maxTemplateDescriptionLength) {
      return {
        valid: false,
        error: `Description must be ${SCORING_VALIDATION_CONFIG.maxTemplateDescriptionLength} characters or less`,
      };
    }

    return { valid: true };
  }, []);

  /**
   * Validate criteria array
   */
  const validateCriteria = useCallback((criteria: any[]): ValidationResult => {
    if (!criteria || criteria.length === 0) {
      return { valid: false, error: 'At least one criterion is required' };
    }

    if (criteria.length > SCORING_VALIDATION_CONFIG.maxCriteria) {
      return {
        valid: false,
        error: `Cannot have more than ${SCORING_VALIDATION_CONFIG.maxCriteria} criteria`,
      };
    }

    // Validate each criterion
    for (let i = 0; i < criteria.length; i++) {
      const result = validateScoringCriterion(criteria[i]);
      if (!result.valid) {
        return { valid: false, error: `Criterion ${i + 1}: ${result.error}` };
      }
    }

    // Check for duplicate names
    const names = criteria.map(c => c.name?.trim().toLowerCase()).filter(Boolean);
    const uniqueNames = new Set(names);
    if (names.length !== uniqueNames.size) {
      return { valid: false, error: 'Criterion names must be unique' };
    }

    // Validate weight sum
    const weights = criteria.map(c => c.weight).filter(w => typeof w === 'number');
    const weightSumResult = validateWeightSum(weights);
    if (!weightSumResult.valid) {
      return weightSumResult;
    }

    return { valid: true };
  }, []);

  /**
   * Validate entire template
   */
  const validateTemplate = useCallback((template: any): ValidationResult => {
    return validateScoringTemplate(template);
  }, []);

  /**
   * Set field error
   */
  const setFieldError = useCallback((fieldName: string, error: string | undefined) => {
    setErrors(prev => ({
      ...prev,
      [fieldName]: error,
    }));
  }, []);

  /**
   * Clear field error
   */
  const clearFieldError = useCallback((fieldName: string) => {
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[fieldName];
      return newErrors;
    });
  }, []);

  /**
   * Clear all errors
   */
  const clearErrors = useCallback(() => {
    setErrors({});
  }, []);

  /**
   * Mark field as touched
   */
  const touchField = useCallback((fieldName: string) => {
    setTouchedFields(prev => new Set(prev).add(fieldName));
  }, []);

  /**
   * Check if field is touched
   */
  const isFieldTouched = useCallback((fieldName: string): boolean => {
    return touchedFields.has(fieldName);
  }, [touchedFields]);

  /**
   * Get field error (only if touched)
   */
  const getFieldError = useCallback((fieldName: string): string | undefined => {
    return isFieldTouched(fieldName) ? errors[fieldName] : undefined;
  }, [errors, isFieldTouched]);

  /**
   * Check if form is valid
   */
  const isValid = useMemo(() => {
    return Object.keys(errors).length === 0;
  }, [errors]);

  return {
    errors,
    isValid,
    validateName,
    validateDescription,
    validateCriteria,
    validateTemplate,
    setFieldError,
    clearFieldError,
    clearErrors,
    touchField,
    isFieldTouched,
    getFieldError,
  };
}

/**
 * Hook for score form validation
 */
export function useScoreFormValidation() {
  const [errors, setErrors] = useState<FieldErrors>({});
  const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set());

  /**
   * Validate raw score
   */
  const validateScore = useCallback((score: any, fieldName: string = 'Score'): ValidationResult => {
    return validateRawScore(score, fieldName);
  }, []);

  /**
   * Validate notes
   */
  const validateNotes = useCallback((notes: string): ValidationResult => {
    if (notes && notes.length > SCORING_VALIDATION_CONFIG.maxNotesLength) {
      return {
        valid: false,
        error: `Notes must be ${SCORING_VALIDATION_CONFIG.maxNotesLength} characters or less`,
      };
    }

    return { valid: true };
  }, []);

  /**
   * Validate entire score
   */
  const validateProposalScoreInput = useCallback((score: any): ValidationResult => {
    return validateProposalScore(score);
  }, []);

  /**
   * Set field error
   */
  const setFieldError = useCallback((fieldName: string, error: string | undefined) => {
    setErrors(prev => ({
      ...prev,
      [fieldName]: error,
    }));
  }, []);

  /**
   * Clear field error
   */
  const clearFieldError = useCallback((fieldName: string) => {
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[fieldName];
      return newErrors;
    });
  }, []);

  /**
   * Clear all errors
   */
  const clearErrors = useCallback(() => {
    setErrors({});
  }, []);

  /**
   * Mark field as touched
   */
  const touchField = useCallback((fieldName: string) => {
    setTouchedFields(prev => new Set(prev).add(fieldName));
  }, []);

  /**
   * Check if field is touched
   */
  const isFieldTouched = useCallback((fieldName: string): boolean => {
    return touchedFields.has(fieldName);
  }, [touchedFields]);

  /**
   * Get field error (only if touched)
   */
  const getFieldError = useCallback((fieldName: string): string | undefined => {
    return isFieldTouched(fieldName) ? errors[fieldName] : undefined;
  }, [errors, isFieldTouched]);

  /**
   * Check if form is valid
   */
  const isValid = useMemo(() => {
    return Object.keys(errors).length === 0;
  }, [errors]);

  return {
    errors,
    isValid,
    validateScore,
    validateNotes,
    validateProposalScoreInput,
    setFieldError,
    clearFieldError,
    clearErrors,
    touchField,
    isFieldTouched,
    getFieldError,
  };
}

/**
 * Hook for revision form validation
 */
export function useRevisionFormValidation() {
  const [errors, setErrors] = useState<FieldErrors>({});
  const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set());

  /**
   * Validate revision reason
   */
  const validateReason = useCallback((reason: string): ValidationResult => {
    if (!reason || reason.trim().length === 0) {
      return { valid: false, error: 'Revision reason is required' };
    }

    if (reason.length < SCORING_VALIDATION_CONFIG.minRevisionReasonLength) {
      return {
        valid: false,
        error: `Reason must be at least ${SCORING_VALIDATION_CONFIG.minRevisionReasonLength} characters`,
      };
    }

    if (reason.length > SCORING_VALIDATION_CONFIG.maxRevisionReasonLength) {
      return {
        valid: false,
        error: `Reason must be ${SCORING_VALIDATION_CONFIG.maxRevisionReasonLength} characters or less`,
      };
    }

    return { valid: true };
  }, []);

  /**
   * Validate entire revision
   */
  const validateRevision = useCallback((revision: any): ValidationResult => {
    return validateScoreRevision(revision);
  }, []);

  /**
   * Set field error
   */
  const setFieldError = useCallback((fieldName: string, error: string | undefined) => {
    setErrors(prev => ({
      ...prev,
      [fieldName]: error,
    }));
  }, []);

  /**
   * Clear field error
   */
  const clearFieldError = useCallback((fieldName: string) => {
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[fieldName];
      return newErrors;
    });
  }, []);

  /**
   * Clear all errors
   */
  const clearErrors = useCallback(() => {
    setErrors({});
  }, []);

  /**
   * Mark field as touched
   */
  const touchField = useCallback((fieldName: string) => {
    setTouchedFields(prev => new Set(prev).add(fieldName));
  }, []);

  /**
   * Check if field is touched
   */
  const isFieldTouched = useCallback((fieldName: string): boolean => {
    return touchedFields.has(fieldName);
  }, [touchedFields]);

  /**
   * Get field error (only if touched)
   */
  const getFieldError = useCallback((fieldName: string): string | undefined => {
    return isFieldTouched(fieldName) ? errors[fieldName] : undefined;
  }, [errors, isFieldTouched]);

  /**
   * Check if form is valid
   */
  const isValid = useMemo(() => {
    return Object.keys(errors).length === 0;
  }, [errors]);

  return {
    errors,
    isValid,
    validateReason,
    validateRevision,
    setFieldError,
    clearFieldError,
    clearErrors,
    touchField,
    isFieldTouched,
    getFieldError,
  };
}

/**
 * Hook for criterion form validation
 */
export function useCriterionFormValidation() {
  const [errors, setErrors] = useState<FieldErrors>({});

  /**
   * Validate criterion name
   */
  const validateName = useCallback((name: string): ValidationResult => {
    if (!name || name.trim().length === 0) {
      return { valid: false, error: 'Criterion name is required' };
    }

    if (name.length > SCORING_VALIDATION_CONFIG.maxCriterionNameLength) {
      return {
        valid: false,
        error: `Name must be ${SCORING_VALIDATION_CONFIG.maxCriterionNameLength} characters or less`,
      };
    }

    return { valid: true };
  }, []);

  /**
   * Validate criterion weight
   */
  const validateCriterionWeight = useCallback((weight: any): ValidationResult => {
    return validateWeight(weight, 'Weight');
  }, []);

  /**
   * Validate criterion description
   */
  const validateDescription = useCallback((description: string): ValidationResult => {
    if (description && description.length > SCORING_VALIDATION_CONFIG.maxCriterionDescriptionLength) {
      return {
        valid: false,
        error: `Description must be ${SCORING_VALIDATION_CONFIG.maxCriterionDescriptionLength} characters or less`,
      };
    }

    return { valid: true };
  }, []);

  /**
   * Set field error
   */
  const setFieldError = useCallback((fieldName: string, error: string | undefined) => {
    setErrors(prev => ({
      ...prev,
      [fieldName]: error,
    }));
  }, []);

  /**
   * Clear field error
   */
  const clearFieldError = useCallback((fieldName: string) => {
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[fieldName];
      return newErrors;
    });
  }, []);

  /**
   * Check if form is valid
   */
  const isValid = useMemo(() => {
    return Object.keys(errors).length === 0;
  }, [errors]);

  return {
    errors,
    isValid,
    validateName,
    validateCriterionWeight,
    validateDescription,
    setFieldError,
    clearFieldError,
  };
}
