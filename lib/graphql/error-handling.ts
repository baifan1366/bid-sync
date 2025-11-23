/**
 * GraphQL Error Handling
 * 
 * Provides error handling utilities for GraphQL operations
 * with validation, retry logic, and user-friendly error messages.
 */

import { GraphQLError } from 'graphql';
import { errorLogger } from '@/lib/error-logger';
import { AppError, ErrorType } from '@/lib/error-utils';
import {
  validateScoringTemplate,
  validateProposalScore,
  validateScoreRevision,
  validateComparisonSelection,
  validateProposalNotLocked,
  SCORING_VALIDATION_CONFIG,
} from '@/lib/scoring-validation';

/**
 * Create a GraphQL error with proper extensions
 */
export function createGraphQLError(
  message: string,
  code: string,
  statusCode?: number,
  details?: any
): GraphQLError {
  return new GraphQLError(message, {
    extensions: {
      code,
      statusCode,
      ...details,
    },
  });
}

/**
 * Validation error codes
 */
export const ValidationErrorCode = {
  INVALID_INPUT: 'BAD_USER_INPUT',
  INVALID_WEIGHT_SUM: 'INVALID_WEIGHT_SUM',
  INVALID_SCORE_RANGE: 'INVALID_SCORE_RANGE',
  DUPLICATE_CRITERION: 'DUPLICATE_CRITERION',
  PROPOSAL_LOCKED: 'PROPOSAL_LOCKED',
  INVALID_COMPARISON: 'INVALID_COMPARISON',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
} as const;

/**
 * Authorization error codes
 */
export const AuthErrorCode = {
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  FORBIDDEN: 'FORBIDDEN',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
} as const;

/**
 * Resource error codes
 */
export const ResourceErrorCode = {
  NOT_FOUND: 'NOT_FOUND',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  CONFLICT: 'CONFLICT',
} as const;

/**
 * Server error codes
 */
export const ServerErrorCode = {
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
} as const;

/**
 * Validate scoring template input and throw GraphQL error if invalid
 */
export function validateTemplateInput(input: any): void {
  const validation = validateScoringTemplate(input);
  
  if (!validation.valid) {
    throw createGraphQLError(
      validation.error || 'Invalid template input',
      ValidationErrorCode.INVALID_INPUT,
      400,
      { field: 'template' }
    );
  }
}

/**
 * Validate proposal score input and throw GraphQL error if invalid
 */
export function validateScoreInput(input: any): void {
  const validation = validateProposalScore(input);
  
  if (!validation.valid) {
    throw createGraphQLError(
      validation.error || 'Invalid score input',
      ValidationErrorCode.INVALID_INPUT,
      400,
      { field: 'score' }
    );
  }
}

/**
 * Validate score revision input and throw GraphQL error if invalid
 */
export function validateRevisionInput(input: any): void {
  const validation = validateScoreRevision(input);
  
  if (!validation.valid) {
    throw createGraphQLError(
      validation.error || 'Invalid revision input',
      ValidationErrorCode.INVALID_INPUT,
      400,
      { field: 'revision' }
    );
  }
}

/**
 * Validate comparison selection and throw GraphQL error if invalid
 */
export function validateComparisonInput(proposalIds: string[]): void {
  const validation = validateComparisonSelection(proposalIds);
  
  if (!validation.valid) {
    throw createGraphQLError(
      validation.error || 'Invalid comparison selection',
      ValidationErrorCode.INVALID_COMPARISON,
      400,
      { field: 'proposalIds' }
    );
  }
}

/**
 * Check if proposal is locked and throw error if it is
 */
export function checkProposalLocked(proposalStatus: string): void {
  const validation = validateProposalNotLocked(proposalStatus);
  
  if (!validation.valid) {
    throw createGraphQLError(
      validation.error || 'Proposal is locked',
      ValidationErrorCode.PROPOSAL_LOCKED,
      403,
      { proposalStatus }
    );
  }
}

/**
 * Check authentication and throw error if not authenticated
 */
export function requireAuth(user: any): void {
  if (!user) {
    throw createGraphQLError(
      'Authentication required',
      AuthErrorCode.UNAUTHENTICATED,
      401
    );
  }
}

/**
 * Check if user has required role
 */
export function requireRole(user: any, allowedRoles: string[]): void {
  requireAuth(user);
  
  const userRole = user.user_metadata?.role || user.role;
  
  if (!allowedRoles.includes(userRole)) {
    throw createGraphQLError(
      'Insufficient permissions',
      AuthErrorCode.FORBIDDEN,
      403,
      { requiredRoles: allowedRoles, userRole }
    );
  }
}

/**
 * Check if user is the owner of a resource
 */
export function requireOwnership(userId: string, resourceOwnerId: string, resourceType: string): void {
  if (userId !== resourceOwnerId) {
    throw createGraphQLError(
      `You do not have permission to access this ${resourceType}`,
      AuthErrorCode.FORBIDDEN,
      403,
      { resourceType }
    );
  }
}

/**
 * Handle database errors and convert to GraphQL errors
 */
export function handleDatabaseError(error: any, operation: string): never {
  errorLogger.error(`Database error during ${operation}`, error, { operation });

  // Check for specific PostgreSQL error codes
  if (error.code) {
    switch (error.code) {
      case '23505': // Unique violation
        throw createGraphQLError(
          'A record with this value already exists',
          ResourceErrorCode.ALREADY_EXISTS,
          409,
          { constraint: error.constraint }
        );
      
      case '23503': // Foreign key violation
        throw createGraphQLError(
          'Referenced resource does not exist',
          ResourceErrorCode.NOT_FOUND,
          404,
          { constraint: error.constraint }
        );
      
      case '23514': // Check constraint violation
        throw createGraphQLError(
          'Invalid data: constraint violation',
          ValidationErrorCode.INVALID_INPUT,
          400,
          { constraint: error.constraint }
        );
      
      case '42P01': // Undefined table
        throw createGraphQLError(
          'Database schema error',
          ServerErrorCode.DATABASE_ERROR,
          500
        );
    }
  }

  // Generic database error
  throw createGraphQLError(
    'Database operation failed',
    ServerErrorCode.DATABASE_ERROR,
    500,
    { originalError: error.message }
  );
}

/**
 * Handle not found errors
 */
export function throwNotFound(resourceType: string, resourceId?: string): never {
  throw createGraphQLError(
    `${resourceType} not found`,
    ResourceErrorCode.NOT_FOUND,
    404,
    { resourceType, resourceId }
  );
}

/**
 * Handle concurrent modification errors
 */
export function throwConcurrentModification(resourceType: string): never {
  throw createGraphQLError(
    `${resourceType} was modified by another user. Please refresh and try again.`,
    ResourceErrorCode.CONFLICT,
    409,
    { resourceType }
  );
}

/**
 * Wrap resolver with error handling
 */
export function withErrorHandling<TArgs = any, TResult = any>(
  resolver: (parent: any, args: TArgs, context: any, info: any) => Promise<TResult>,
  options: {
    operation: string;
    requireAuth?: boolean;
    requireRoles?: string[];
    logErrors?: boolean;
  } = { operation: 'unknown', logErrors: true }
): (parent: any, args: TArgs, context: any, info: any) => Promise<TResult> {
  return async (parent: any, args: TArgs, context: any, info: any): Promise<TResult> => {
    try {
      // Check authentication if required
      if (options.requireAuth) {
        requireAuth(context.user);
      }

      // Check roles if required
      if (options.requireRoles && options.requireRoles.length > 0) {
        requireRole(context.user, options.requireRoles);
      }

      // Execute resolver
      return await resolver(parent, args, context, info);
    } catch (error) {
      // Log error if enabled
      if (options.logErrors) {
        errorLogger.error(
          `Error in ${options.operation}`,
          error instanceof Error ? error : undefined,
          {
            operation: options.operation,
            userId: context.user?.id,
            args: JSON.stringify(args),
          }
        );
      }

      // Re-throw GraphQL errors as-is
      if (error instanceof GraphQLError) {
        throw error;
      }

      // Convert other errors to GraphQL errors
      throw createGraphQLError(
        error instanceof Error ? error.message : 'An unexpected error occurred',
        ServerErrorCode.INTERNAL_SERVER_ERROR,
        500,
        { originalError: error instanceof Error ? error.message : String(error) }
      );
    }
  };
}

/**
 * Validate required fields
 */
export function validateRequiredFields(
  input: any,
  requiredFields: string[]
): void {
  const missingFields: string[] = [];

  for (const field of requiredFields) {
    if (input[field] === undefined || input[field] === null || input[field] === '') {
      missingFields.push(field);
    }
  }

  if (missingFields.length > 0) {
    throw createGraphQLError(
      `Missing required fields: ${missingFields.join(', ')}`,
      ValidationErrorCode.MISSING_REQUIRED_FIELD,
      400,
      { missingFields }
    );
  }
}

/**
 * Validate field length
 */
export function validateFieldLength(
  value: string,
  fieldName: string,
  maxLength: number,
  minLength: number = 0
): void {
  if (value.length < minLength) {
    throw createGraphQLError(
      `${fieldName} must be at least ${minLength} characters`,
      ValidationErrorCode.INVALID_INPUT,
      400,
      { field: fieldName, minLength, actualLength: value.length }
    );
  }

  if (value.length > maxLength) {
    throw createGraphQLError(
      `${fieldName} must be ${maxLength} characters or less`,
      ValidationErrorCode.INVALID_INPUT,
      400,
      { field: fieldName, maxLength, actualLength: value.length }
    );
  }
}

/**
 * Validate numeric range
 */
export function validateNumericRange(
  value: number,
  fieldName: string,
  min: number,
  max: number
): void {
  if (value < min || value > max) {
    throw createGraphQLError(
      `${fieldName} must be between ${min} and ${max}`,
      ValidationErrorCode.INVALID_INPUT,
      400,
      { field: fieldName, min, max, actualValue: value }
    );
  }
}

/**
 * Safe database query execution with error handling
 */
export async function executeDatabaseQuery<T>(
  operation: () => Promise<T>,
  operationName: string
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    handleDatabaseError(error, operationName);
  }
}

/**
 * Check if resource exists and throw error if not
 */
export async function requireResourceExists<T>(
  query: () => Promise<T | null>,
  resourceType: string,
  resourceId?: string
): Promise<T> {
  const resource = await query();
  
  if (!resource) {
    throwNotFound(resourceType, resourceId);
  }
  
  return resource;
}
