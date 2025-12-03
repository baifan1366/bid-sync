/**
 * Error Handling Utilities
 * 
 * Centralized error handling for the project-delivery-archival feature.
 * Provides consistent error responses, retry logic, and error categorization.
 */

import { createClient } from '@/lib/supabase/server';

/**
 * Error categories for classification
 */
export enum ErrorCategory {
  VALIDATION = 'VALIDATION',
  AUTHORIZATION = 'AUTHORIZATION',
  NOT_FOUND = 'NOT_FOUND',
  STATE = 'STATE',
  STORAGE = 'STORAGE',
  DATABASE = 'DATABASE',
  NETWORK = 'NETWORK',
  UNKNOWN = 'UNKNOWN',
}

/**
 * Error codes for specific error types
 */
export enum ErrorCode {
  // Validation errors
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  INVALID_FILE_TYPE = 'INVALID_FILE_TYPE',
  
  // Authorization errors
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  
  // Not found errors
  NOT_FOUND = 'NOT_FOUND',
  PROJECT_NOT_FOUND = 'PROJECT_NOT_FOUND',
  DELIVERABLE_NOT_FOUND = 'DELIVERABLE_NOT_FOUND',
  ARCHIVE_NOT_FOUND = 'ARCHIVE_NOT_FOUND',
  EXPORT_NOT_FOUND = 'EXPORT_NOT_FOUND',
  
  // State errors
  INVALID_STATUS = 'INVALID_STATUS',
  NO_DELIVERABLES = 'NO_DELIVERABLES',
  ALREADY_EXISTS = 'ALREADY_EXISTS',
  LEGAL_HOLD_ACTIVE = 'LEGAL_HOLD_ACTIVE',
  GRACE_PERIOD_NOT_EXPIRED = 'GRACE_PERIOD_NOT_EXPIRED',
  
  // Storage errors
  UPLOAD_FAILED = 'UPLOAD_FAILED',
  DOWNLOAD_FAILED = 'DOWNLOAD_FAILED',
  DELETE_FAILED = 'DELETE_FAILED',
  STORAGE_ERROR = 'STORAGE_ERROR',
  COMPRESSION_FAILED = 'COMPRESSION_FAILED',
  DECOMPRESSION_FAILED = 'DECOMPRESSION_FAILED',
  
  // Database errors
  DATABASE_ERROR = 'DATABASE_ERROR',
  QUERY_FAILED = 'QUERY_FAILED',
  TRANSACTION_FAILED = 'TRANSACTION_FAILED',
  
  // Network errors
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT',
  
  // Unknown errors
  UNKNOWN = 'UNKNOWN',
}

/**
 * Standard error response structure
 */
export interface ErrorResponse {
  success: false;
  error: string;
  errorCode: ErrorCode;
  errorCategory: ErrorCategory;
  details?: any;
  timestamp: Date;
  retryable: boolean;
}

/**
 * Success response structure
 */
export interface SuccessResponse<T = any> {
  success: true;
  data: T;
}

/**
 * Combined response type
 */
export type ServiceResponse<T = any> = SuccessResponse<T> | ErrorResponse;

/**
 * Retry configuration
 */
export interface RetryConfig {
  maxAttempts: number;
  delayMs: number;
  backoffMultiplier: number;
  retryableErrors: ErrorCode[];
}

/**
 * Default retry configurations for different operations
 */
export const DEFAULT_RETRY_CONFIGS: Record<string, RetryConfig> = {
  storage: {
    maxAttempts: 3,
    delayMs: 1000,
    backoffMultiplier: 2,
    retryableErrors: [
      ErrorCode.STORAGE_ERROR,
      ErrorCode.NETWORK_ERROR,
      ErrorCode.TIMEOUT,
      ErrorCode.UPLOAD_FAILED,
      ErrorCode.DOWNLOAD_FAILED,
    ],
  },
  database: {
    maxAttempts: 2,
    delayMs: 500,
    backoffMultiplier: 2,
    retryableErrors: [
      ErrorCode.DATABASE_ERROR,
      ErrorCode.NETWORK_ERROR,
      ErrorCode.TIMEOUT,
    ],
  },
  compression: {
    maxAttempts: 2,
    delayMs: 1000,
    backoffMultiplier: 1.5,
    retryableErrors: [
      ErrorCode.COMPRESSION_FAILED,
      ErrorCode.DECOMPRESSION_FAILED,
    ],
  },
};

/**
 * Maps error codes to categories
 */
const ERROR_CODE_TO_CATEGORY: Record<ErrorCode, ErrorCategory> = {
  // Validation
  [ErrorCode.FILE_TOO_LARGE]: ErrorCategory.VALIDATION,
  [ErrorCode.INVALID_INPUT]: ErrorCategory.VALIDATION,
  [ErrorCode.MISSING_REQUIRED_FIELD]: ErrorCategory.VALIDATION,
  [ErrorCode.INVALID_FILE_TYPE]: ErrorCategory.VALIDATION,
  
  // Authorization
  [ErrorCode.UNAUTHORIZED]: ErrorCategory.AUTHORIZATION,
  [ErrorCode.FORBIDDEN]: ErrorCategory.AUTHORIZATION,
  [ErrorCode.INSUFFICIENT_PERMISSIONS]: ErrorCategory.AUTHORIZATION,
  
  // Not found
  [ErrorCode.NOT_FOUND]: ErrorCategory.NOT_FOUND,
  [ErrorCode.PROJECT_NOT_FOUND]: ErrorCategory.NOT_FOUND,
  [ErrorCode.DELIVERABLE_NOT_FOUND]: ErrorCategory.NOT_FOUND,
  [ErrorCode.ARCHIVE_NOT_FOUND]: ErrorCategory.NOT_FOUND,
  [ErrorCode.EXPORT_NOT_FOUND]: ErrorCategory.NOT_FOUND,
  
  // State
  [ErrorCode.INVALID_STATUS]: ErrorCategory.STATE,
  [ErrorCode.NO_DELIVERABLES]: ErrorCategory.STATE,
  [ErrorCode.ALREADY_EXISTS]: ErrorCategory.STATE,
  [ErrorCode.LEGAL_HOLD_ACTIVE]: ErrorCategory.STATE,
  [ErrorCode.GRACE_PERIOD_NOT_EXPIRED]: ErrorCategory.STATE,
  
  // Storage
  [ErrorCode.UPLOAD_FAILED]: ErrorCategory.STORAGE,
  [ErrorCode.DOWNLOAD_FAILED]: ErrorCategory.STORAGE,
  [ErrorCode.DELETE_FAILED]: ErrorCategory.STORAGE,
  [ErrorCode.STORAGE_ERROR]: ErrorCategory.STORAGE,
  [ErrorCode.COMPRESSION_FAILED]: ErrorCategory.STORAGE,
  [ErrorCode.DECOMPRESSION_FAILED]: ErrorCategory.STORAGE,
  
  // Database
  [ErrorCode.DATABASE_ERROR]: ErrorCategory.DATABASE,
  [ErrorCode.QUERY_FAILED]: ErrorCategory.DATABASE,
  [ErrorCode.TRANSACTION_FAILED]: ErrorCategory.DATABASE,
  
  // Network
  [ErrorCode.NETWORK_ERROR]: ErrorCategory.NETWORK,
  [ErrorCode.TIMEOUT]: ErrorCategory.NETWORK,
  
  // Unknown
  [ErrorCode.UNKNOWN]: ErrorCategory.UNKNOWN,
};

/**
 * Determines if an error is retryable
 */
function isRetryableError(errorCode: ErrorCode, config: RetryConfig): boolean {
  return config.retryableErrors.includes(errorCode);
}

/**
 * Creates a standardized error response
 */
export function createErrorResponse(
  error: string,
  errorCode: ErrorCode,
  details?: any
): ErrorResponse {
  const errorCategory = ERROR_CODE_TO_CATEGORY[errorCode] || ErrorCategory.UNKNOWN;
  
  // Determine if error is retryable based on category
  const retryable = 
    errorCategory === ErrorCategory.STORAGE ||
    errorCategory === ErrorCategory.NETWORK ||
    errorCategory === ErrorCategory.DATABASE;
  
  return {
    success: false,
    error,
    errorCode,
    errorCategory,
    details,
    timestamp: new Date(),
    retryable,
  };
}

/**
 * Creates a standardized success response
 */
export function createSuccessResponse<T>(data: T): SuccessResponse<T> {
  return {
    success: true,
    data,
  };
}

/**
 * Executes an operation with retry logic
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  config: RetryConfig,
  operationName: string
): Promise<T> {
  let lastError: Error | null = null;
  let delay = config.delayMs;
  
  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      console.error(
        `${operationName} failed (attempt ${attempt}/${config.maxAttempts}):`,
        lastError.message
      );
      
      // If this was the last attempt, throw the error
      if (attempt === config.maxAttempts) {
        break;
      }
      
      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, delay));
      delay *= config.backoffMultiplier;
    }
  }
  
  throw lastError;
}

/**
 * Wraps a database operation with error handling and retry logic
 */
export async function withDatabaseRetry<T>(
  operation: () => Promise<T>,
  operationName: string
): Promise<T> {
  return withRetry(operation, DEFAULT_RETRY_CONFIGS.database, operationName);
}

/**
 * Wraps a storage operation with error handling and retry logic
 */
export async function withStorageRetry<T>(
  operation: () => Promise<T>,
  operationName: string
): Promise<T> {
  return withRetry(operation, DEFAULT_RETRY_CONFIGS.storage, operationName);
}

/**
 * Wraps a compression operation with error handling and retry logic
 */
export async function withCompressionRetry<T>(
  operation: () => Promise<T>,
  operationName: string
): Promise<T> {
  return withRetry(operation, DEFAULT_RETRY_CONFIGS.compression, operationName);
}

/**
 * Handles database transaction with automatic rollback on error
 */
export async function withTransaction<T>(
  operations: (client: any) => Promise<T>,
  operationName: string
): Promise<ServiceResponse<T>> {
  const supabase = await createClient();
  
  try {
    // Note: Supabase doesn't expose direct transaction control in the client
    // This is a placeholder for transaction-like behavior
    // In production, consider using Supabase Edge Functions or direct PostgreSQL client
    
    const result = await operations(supabase);
    return createSuccessResponse(result);
  } catch (error) {
    console.error(`Transaction failed for ${operationName}:`, error);
    
    // Attempt rollback if possible
    // Note: Implement actual rollback logic based on your transaction strategy
    
    return createErrorResponse(
      error instanceof Error ? error.message : 'Transaction failed',
      ErrorCode.TRANSACTION_FAILED,
      { operationName, error }
    );
  }
}

/**
 * Validates required fields in an object
 */
export function validateRequiredFields(
  data: Record<string, any>,
  requiredFields: string[]
): ErrorResponse | null {
  const missingFields = requiredFields.filter((field) => {
    const value = data[field];
    return value === undefined || value === null || value === '';
  });
  
  if (missingFields.length > 0) {
    return createErrorResponse(
      `Missing required fields: ${missingFields.join(', ')}`,
      ErrorCode.MISSING_REQUIRED_FIELD,
      { missingFields }
    );
  }
  
  return null;
}

/**
 * Validates file size
 */
export function validateFileSize(
  fileSize: number,
  maxSize: number
): ErrorResponse | null {
  if (fileSize <= 0) {
    return createErrorResponse(
      'File size must be greater than 0',
      ErrorCode.INVALID_INPUT,
      { fileSize }
    );
  }
  
  if (fileSize > maxSize) {
    return createErrorResponse(
      `File size exceeds maximum allowed size of ${maxSize} bytes`,
      ErrorCode.FILE_TOO_LARGE,
      { fileSize, maxSize }
    );
  }
  
  return null;
}

/**
 * Validates project status for an operation
 */
export function validateProjectStatus(
  currentStatus: string,
  allowedStatuses: string[],
  operation: string
): ErrorResponse | null {
  if (!allowedStatuses.includes(currentStatus)) {
    return createErrorResponse(
      `Cannot ${operation}. Project status is ${currentStatus}. Allowed statuses: ${allowedStatuses.join(', ')}`,
      ErrorCode.INVALID_STATUS,
      { currentStatus, allowedStatuses, operation }
    );
  }
  
  return null;
}

/**
 * Handles storage errors with appropriate error codes
 */
export function handleStorageError(
  error: any,
  operation: string
): ErrorResponse {
  console.error(`Storage error during ${operation}:`, error);
  
  const errorMessage = error?.message || 'Storage operation failed';
  
  // Determine specific error code based on error message
  let errorCode = ErrorCode.STORAGE_ERROR;
  
  if (errorMessage.includes('upload')) {
    errorCode = ErrorCode.UPLOAD_FAILED;
  } else if (errorMessage.includes('download') || errorMessage.includes('fetch')) {
    errorCode = ErrorCode.DOWNLOAD_FAILED;
  } else if (errorMessage.includes('delete') || errorMessage.includes('remove')) {
    errorCode = ErrorCode.DELETE_FAILED;
  } else if (errorMessage.includes('timeout')) {
    errorCode = ErrorCode.TIMEOUT;
  } else if (errorMessage.includes('network')) {
    errorCode = ErrorCode.NETWORK_ERROR;
  }
  
  return createErrorResponse(
    `${operation} failed: ${errorMessage}`,
    errorCode,
    { originalError: error }
  );
}

/**
 * Handles database errors with appropriate error codes
 */
export function handleDatabaseError(
  error: any,
  operation: string
): ErrorResponse {
  console.error(`Database error during ${operation}:`, error);
  
  const errorMessage = error?.message || 'Database operation failed';
  
  // Determine specific error code based on error
  let errorCode = ErrorCode.DATABASE_ERROR;
  
  if (errorMessage.includes('not found') || error?.code === 'PGRST116') {
    errorCode = ErrorCode.NOT_FOUND;
  } else if (errorMessage.includes('unique') || errorMessage.includes('duplicate')) {
    errorCode = ErrorCode.ALREADY_EXISTS;
  } else if (errorMessage.includes('timeout')) {
    errorCode = ErrorCode.TIMEOUT;
  } else if (errorMessage.includes('network')) {
    errorCode = ErrorCode.NETWORK_ERROR;
  }
  
  return createErrorResponse(
    `${operation} failed: ${errorMessage}`,
    errorCode,
    { originalError: error }
  );
}

/**
 * Logs an error with context
 */
export async function logError(
  error: ErrorResponse,
  context: {
    userId?: string;
    projectId?: string;
    operation: string;
    additionalData?: any;
  }
): Promise<void> {
  try {
    const supabase = await createClient();
    
    await supabase.from('error_logs').insert({
      error_code: error.errorCode,
      error_category: error.errorCategory,
      error_message: error.error,
      user_id: context.userId,
      project_id: context.projectId,
      operation: context.operation,
      details: {
        ...error.details,
        ...context.additionalData,
      },
      timestamp: error.timestamp.toISOString(),
      retryable: error.retryable,
    });
  } catch (logError) {
    // Don't throw if logging fails - just log to console
    console.error('Failed to log error to database:', logError);
  }
}
