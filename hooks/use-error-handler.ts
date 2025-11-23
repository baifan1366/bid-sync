/**
 * Error Handler Hook
 * 
 * Provides error handling with toast notifications and retry logic
 * for React components.
 */

import { useCallback } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { errorLogger } from '@/lib/error-logger';
import { getUserFriendlyErrorMessage, getErrorType, ErrorType } from '@/lib/error-utils';
import { getScoringErrorMessage } from '@/lib/scoring-validation';

/**
 * Error handler options
 */
export interface ErrorHandlerOptions {
  /** Custom error message to display */
  message?: string;
  
  /** Whether to show a toast notification */
  showToast?: boolean;
  
  /** Toast duration in milliseconds */
  toastDuration?: number;
  
  /** Whether to log the error */
  logError?: boolean;
  
  /** Additional context for error logging */
  context?: Record<string, any>;
  
  /** Callback to execute after handling error */
  onError?: (error: any) => void;
  
  /** Whether to use scoring-specific error messages */
  isScoringError?: boolean;
}

/**
 * Default error handler options
 */
const DEFAULT_OPTIONS: ErrorHandlerOptions = {
  showToast: true,
  toastDuration: 5000,
  logError: true,
  isScoringError: false,
};

/**
 * Hook for handling errors with toast notifications
 * 
 * @returns Object with error handling functions
 * 
 * @example
 * ```typescript
 * const { handleError, handleAsyncError } = useErrorHandler();
 * 
 * // Handle synchronous error
 * try {
 *   // ... operation
 * } catch (error) {
 *   handleError(error, { message: 'Failed to save' });
 * }
 * 
 * // Handle async operation
 * await handleAsyncError(
 *   async () => await saveData(),
 *   { message: 'Failed to save data' }
 * );
 * ```
 */
export function useErrorHandler() {
  const { toast } = useToast();

  /**
   * Handle an error with toast notification and logging
   */
  const handleError = useCallback(
    (error: any, options: ErrorHandlerOptions = {}) => {
      const config = { ...DEFAULT_OPTIONS, ...options };

      // Get error message
      let errorMessage: string;
      if (config.message) {
        errorMessage = config.message;
      } else if (config.isScoringError) {
        errorMessage = getScoringErrorMessage(error);
      } else {
        errorMessage = getUserFriendlyErrorMessage(error);
      }

      // Log error if enabled
      if (config.logError) {
        errorLogger.error(
          errorMessage,
          error instanceof Error ? error : undefined,
          config.context
        );
      }

      // Show toast notification if enabled
      if (config.showToast) {
        const errorType = getErrorType(error);
        
        toast({
          title: getErrorTitle(errorType),
          description: errorMessage,
          variant: 'destructive',
          duration: config.toastDuration,
        });
      }

      // Call custom error handler if provided
      if (config.onError) {
        config.onError(error);
      }
    },
    [toast]
  );

  /**
   * Handle an async operation with automatic error handling
   * Returns the result or undefined if error occurred
   */
  const handleAsyncError = useCallback(
    async <T>(
      operation: () => Promise<T>,
      options: ErrorHandlerOptions = {}
    ): Promise<T | undefined> => {
      try {
        return await operation();
      } catch (error) {
        handleError(error, options);
        return undefined;
      }
    },
    [handleError]
  );

  /**
   * Handle an async operation and return success status
   * Useful for operations where you need to know if it succeeded
   */
  const handleAsyncOperation = useCallback(
    async <T>(
      operation: () => Promise<T>,
      options: ErrorHandlerOptions = {}
    ): Promise<{ success: boolean; data?: T; error?: any }> => {
      try {
        const data = await operation();
        return { success: true, data };
      } catch (error) {
        handleError(error, options);
        return { success: false, error };
      }
    },
    [handleError]
  );

  /**
   * Show a success toast notification
   */
  const showSuccess = useCallback(
    (message: string, options: { duration?: number } = {}) => {
      toast({
        title: 'Success',
        description: message,
        duration: options.duration || 3000,
      });
    },
    [toast]
  );

  /**
   * Show a warning toast notification
   */
  const showWarning = useCallback(
    (message: string, options: { duration?: number } = {}) => {
      toast({
        title: 'Warning',
        description: message,
        variant: 'default',
        duration: options.duration || 4000,
      });
    },
    [toast]
  );

  /**
   * Show an info toast notification
   */
  const showInfo = useCallback(
    (message: string, options: { duration?: number } = {}) => {
      toast({
        title: 'Info',
        description: message,
        duration: options.duration || 3000,
      });
    },
    [toast]
  );

  return {
    handleError,
    handleAsyncError,
    handleAsyncOperation,
    showSuccess,
    showWarning,
    showInfo,
  };
}

/**
 * Get error title based on error type
 */
function getErrorTitle(errorType: ErrorType): string {
  switch (errorType) {
    case ErrorType.NETWORK:
      return 'Connection Error';
    case ErrorType.AUTHENTICATION:
      return 'Authentication Error';
    case ErrorType.AUTHORIZATION:
      return 'Permission Denied';
    case ErrorType.VALIDATION:
      return 'Validation Error';
    case ErrorType.NOT_FOUND:
      return 'Not Found';
    case ErrorType.CONFLICT:
      return 'Conflict';
    case ErrorType.SERVER:
      return 'Server Error';
    default:
      return 'Error';
  }
}

/**
 * Hook for handling validation errors specifically
 * Provides utilities for form validation error display
 */
export function useValidationErrorHandler() {
  const { toast } = useToast();

  /**
   * Handle validation errors from a validation result
   */
  const handleValidationErrors = useCallback(
    (errors: Record<string, string>, options: { showToast?: boolean } = {}) => {
      const { showToast = true } = options;

      if (Object.keys(errors).length === 0) {
        return;
      }

      // Get first error message
      const firstError = Object.values(errors)[0];

      if (showToast) {
        toast({
          title: 'Validation Error',
          description: firstError,
          variant: 'destructive',
          duration: 4000,
        });
      }

      // Log all validation errors
      errorLogger.warn('Validation errors', { errors });
    },
    [toast]
  );

  /**
   * Show a specific validation error
   */
  const showValidationError = useCallback(
    (fieldName: string, message: string) => {
      toast({
        title: 'Validation Error',
        description: `${fieldName}: ${message}`,
        variant: 'destructive',
        duration: 4000,
      });
    },
    [toast]
  );

  return {
    handleValidationErrors,
    showValidationError,
  };
}
