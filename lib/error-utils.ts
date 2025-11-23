/**
 * Error Utilities
 * 
 * Provides utilities for error handling, formatting, and user-friendly messages
 */

/**
 * Error types for categorization
 */
export enum ErrorType {
  NETWORK = 'NETWORK',
  AUTHENTICATION = 'AUTHENTICATION',
  AUTHORIZATION = 'AUTHORIZATION',
  VALIDATION = 'VALIDATION',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  SERVER = 'SERVER',
  UNKNOWN = 'UNKNOWN',
}

/**
 * Structured error class with additional context
 */
export class AppError extends Error {
  type: ErrorType
  statusCode?: number
  details?: any
  retryable: boolean

  constructor(
    message: string,
    type: ErrorType = ErrorType.UNKNOWN,
    options: {
      statusCode?: number
      details?: any
      retryable?: boolean
      cause?: Error
    } = {}
  ) {
    super(message)
    this.name = 'AppError'
    this.type = type
    this.statusCode = options.statusCode
    this.details = options.details
    this.retryable = options.retryable ?? false
    
    if (options.cause) {
      this.cause = options.cause
    }
  }
}

/**
 * Determine error type from error object
 */
export function getErrorType(error: any): ErrorType {
  if (!error) return ErrorType.UNKNOWN

  // Check for network errors
  if (
    error.message?.includes('fetch') ||
    error.message?.includes('network') ||
    error.message?.includes('connection') ||
    error.name === 'NetworkError'
  ) {
    return ErrorType.NETWORK
  }

  // Check for authentication errors
  if (
    error.message?.includes('authentication') ||
    error.message?.includes('unauthenticated') ||
    error.message?.includes('login') ||
    error.statusCode === 401
  ) {
    return ErrorType.AUTHENTICATION
  }

  // Check for authorization errors
  if (
    error.message?.includes('authorization') ||
    error.message?.includes('forbidden') ||
    error.message?.includes('permission') ||
    error.statusCode === 403
  ) {
    return ErrorType.AUTHORIZATION
  }

  // Check for validation errors
  if (
    error.message?.includes('validation') ||
    error.message?.includes('invalid') ||
    error.statusCode === 400
  ) {
    return ErrorType.VALIDATION
  }

  // Check for not found errors
  if (
    error.message?.includes('not found') ||
    error.statusCode === 404
  ) {
    return ErrorType.NOT_FOUND
  }

  // Check for conflict errors
  if (
    error.message?.includes('conflict') ||
    error.message?.includes('already exists') ||
    error.statusCode === 409
  ) {
    return ErrorType.CONFLICT
  }

  // Check for server errors
  if (
    error.statusCode >= 500 ||
    error.message?.includes('server error')
  ) {
    return ErrorType.SERVER
  }

  return ErrorType.UNKNOWN
}

/**
 * Get user-friendly error message
 */
export function getUserFriendlyErrorMessage(error: any): string {
  if (!error) return 'An unknown error occurred'

  const errorType = getErrorType(error)

  switch (errorType) {
    case ErrorType.NETWORK:
      return 'Network connection error. Please check your internet connection and try again.'
    
    case ErrorType.AUTHENTICATION:
      return 'Authentication failed. Please log in again.'
    
    case ErrorType.AUTHORIZATION:
      return 'You do not have permission to perform this action.'
    
    case ErrorType.VALIDATION:
      return error.message || 'Invalid input. Please check your data and try again.'
    
    case ErrorType.NOT_FOUND:
      return 'The requested resource was not found.'
    
    case ErrorType.CONFLICT:
      return error.message || 'This operation conflicts with existing data.'
    
    case ErrorType.SERVER:
      return 'Server error. Please try again later.'
    
    default:
      return error.message || 'An unexpected error occurred. Please try again.'
  }
}

/**
 * Check if error is retryable
 */
export function isRetryableError(error: any): boolean {
  if (error instanceof AppError) {
    return error.retryable
  }

  const errorType = getErrorType(error)
  
  // Network and server errors are typically retryable
  return errorType === ErrorType.NETWORK || errorType === ErrorType.SERVER
}

/**
 * Format error for logging
 */
export function formatErrorForLogging(error: any): {
  message: string
  type: string
  stack?: string
  details?: any
} {
  return {
    message: error?.message || 'Unknown error',
    type: error?.name || 'Error',
    stack: error?.stack,
    details: error?.details || error?.response?.data,
  }
}

/**
 * Handle GraphQL errors
 */
export function handleGraphQLError(error: any): AppError {
  if (error.graphQLErrors && error.graphQLErrors.length > 0) {
    const gqlError = error.graphQLErrors[0]
    const code = gqlError.extensions?.code

    let errorType = ErrorType.UNKNOWN
    let retryable = false

    switch (code) {
      case 'UNAUTHENTICATED':
        errorType = ErrorType.AUTHENTICATION
        break
      case 'FORBIDDEN':
        errorType = ErrorType.AUTHORIZATION
        break
      case 'BAD_USER_INPUT':
        errorType = ErrorType.VALIDATION
        break
      case 'NOT_FOUND':
        errorType = ErrorType.NOT_FOUND
        break
      case 'INTERNAL_SERVER_ERROR':
        errorType = ErrorType.SERVER
        retryable = true
        break
    }

    return new AppError(gqlError.message, errorType, {
      statusCode: gqlError.extensions?.statusCode,
      details: gqlError.extensions,
      retryable,
      cause: error,
    })
  }

  if (error.networkError) {
    return new AppError(
      'Network error occurred',
      ErrorType.NETWORK,
      {
        retryable: true,
        cause: error,
      }
    )
  }

  return new AppError(
    error.message || 'GraphQL operation failed',
    ErrorType.UNKNOWN,
    { cause: error }
  )
}

/**
 * Handle service result errors
 */
export function handleServiceError<T>(
  result: { success: boolean; data?: T; error?: string }
): T {
  if (!result.success) {
    throw new AppError(
      result.error || 'Operation failed',
      getErrorType({ message: result.error }),
      { retryable: isRetryableError({ message: result.error }) }
    )
  }

  if (!result.data) {
    throw new AppError(
      'No data returned from operation',
      ErrorType.UNKNOWN
    )
  }

  return result.data
}

/**
 * Wrap async function with error handling
 */
export function withErrorHandling<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  options: {
    onError?: (error: AppError) => void
    transformError?: (error: any) => AppError
  } = {}
): T {
  return (async (...args: any[]) => {
    try {
      return await fn(...args)
    } catch (error) {
      const appError = options.transformError
        ? options.transformError(error)
        : error instanceof AppError
        ? error
        : new AppError(
            error instanceof Error ? error.message : String(error),
            getErrorType(error),
            { cause: error instanceof Error ? error : undefined }
          )

      if (options.onError) {
        options.onError(appError)
      }

      throw appError
    }
  }) as T
}
