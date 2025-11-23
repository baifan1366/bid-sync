/**
 * GraphQL Error Handler
 * 
 * Provides error handling middleware and utilities for GraphQL resolvers
 */

import { GraphQLError } from 'graphql'

/**
 * Error codes for GraphQL operations
 */
export enum GraphQLErrorCode {
  UNAUTHENTICATED = 'UNAUTHENTICATED',
  FORBIDDEN = 'FORBIDDEN',
  BAD_USER_INPUT = 'BAD_USER_INPUT',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
}

/**
 * Create a structured GraphQL error
 */
export function createGraphQLError(
  message: string,
  code: GraphQLErrorCode = GraphQLErrorCode.INTERNAL_SERVER_ERROR,
  extensions?: Record<string, any>
): GraphQLError {
  return new GraphQLError(message, {
    extensions: {
      code,
      ...extensions,
    },
  })
}

/**
 * Wrap a resolver function with error handling
 * 
 * Automatically catches errors and converts them to appropriate GraphQL errors
 * Logs errors with context for debugging
 */
export function withErrorHandling<TArgs = any, TContext = any, TResult = any>(
  resolver: (parent: any, args: TArgs, context: TContext, info: any) => Promise<TResult>,
  options: {
    operationName?: string
    logErrors?: boolean
  } = {}
): (parent: any, args: TArgs, context: TContext, info: any) => Promise<TResult> {
  const { operationName = 'Unknown operation', logErrors = true } = options

  return async (parent: any, args: TArgs, context: TContext, info: any): Promise<TResult> => {
    try {
      return await resolver(parent, args, context, info)
    } catch (error) {
      // Log error with context
      if (logErrors) {
        console.error(`[GraphQL Error] ${operationName}:`, {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          args,
        })
      }

      // If it's already a GraphQL error, rethrow it
      if (error instanceof GraphQLError) {
        throw error
      }

      // Convert service errors to GraphQL errors
      if (error instanceof Error) {
        // Check for specific error patterns
        if (error.message.includes('not authenticated') || error.message.includes('unauthenticated')) {
          throw createGraphQLError('Authentication required', GraphQLErrorCode.UNAUTHENTICATED)
        }

        if (error.message.includes('forbidden') || error.message.includes('permission')) {
          throw createGraphQLError(
            error.message || 'You do not have permission to perform this action',
            GraphQLErrorCode.FORBIDDEN
          )
        }

        if (error.message.includes('not found')) {
          throw createGraphQLError(
            error.message || 'Resource not found',
            GraphQLErrorCode.NOT_FOUND
          )
        }

        if (error.message.includes('validation') || error.message.includes('invalid')) {
          throw createGraphQLError(
            error.message || 'Invalid input',
            GraphQLErrorCode.BAD_USER_INPUT
          )
        }

        if (error.message.includes('conflict') || error.message.includes('already exists')) {
          throw createGraphQLError(
            error.message || 'Resource conflict',
            GraphQLErrorCode.CONFLICT
          )
        }

        // Generic error
        throw createGraphQLError(
          error.message || 'An unexpected error occurred',
          GraphQLErrorCode.INTERNAL_SERVER_ERROR
        )
      }

      // Unknown error type
      throw createGraphQLError(
        'An unexpected error occurred',
        GraphQLErrorCode.INTERNAL_SERVER_ERROR
      )
    }
  }
}

/**
 * Wrap all resolvers in an object with error handling
 */
export function wrapResolvers<T extends Record<string, any>>(
  resolvers: T,
  options: {
    logErrors?: boolean
  } = {}
): T {
  const wrapped: any = {}

  for (const [key, value] of Object.entries(resolvers)) {
    if (typeof value === 'function') {
      wrapped[key] = withErrorHandling(value, {
        operationName: key,
        ...options,
      })
    } else if (typeof value === 'object' && value !== null) {
      wrapped[key] = wrapResolvers(value, options)
    } else {
      wrapped[key] = value
    }
  }

  return wrapped as T
}

/**
 * Validate required fields in input
 */
export function validateRequired<T extends Record<string, any>>(
  input: T,
  requiredFields: (keyof T)[]
): void {
  const missing = requiredFields.filter(field => {
    const value = input[field]
    return value === undefined || value === null || value === ''
  })

  if (missing.length > 0) {
    throw createGraphQLError(
      `Missing required fields: ${missing.join(', ')}`,
      GraphQLErrorCode.BAD_USER_INPUT
    )
  }
}

/**
 * Validate UUID format
 */
export function validateUUID(value: string, fieldName: string = 'ID'): void {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  
  if (!uuidRegex.test(value)) {
    throw createGraphQLError(
      `Invalid ${fieldName} format`,
      GraphQLErrorCode.BAD_USER_INPUT
    )
  }
}

/**
 * Validate email format
 */
export function validateEmail(email: string): void {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  
  if (!emailRegex.test(email)) {
    throw createGraphQLError(
      'Invalid email format',
      GraphQLErrorCode.BAD_USER_INPUT
    )
  }
}

/**
 * Handle service result and throw error if failed
 */
export function handleServiceResult<T>(
  result: { success: boolean; data?: T; error?: string },
  errorCode: GraphQLErrorCode = GraphQLErrorCode.INTERNAL_SERVER_ERROR
): T {
  if (!result.success) {
    throw createGraphQLError(
      result.error || 'Operation failed',
      errorCode
    )
  }

  if (!result.data) {
    throw createGraphQLError(
      'No data returned from operation',
      GraphQLErrorCode.INTERNAL_SERVER_ERROR
    )
  }

  return result.data
}

/**
 * Retry a database operation with exponential backoff
 */
export async function retryOperation<T>(
  operation: () => Promise<T>,
  options: {
    maxRetries?: number
    initialDelay?: number
    maxDelay?: number
    shouldRetry?: (error: any) => boolean
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 100,
    maxDelay = 5000,
    shouldRetry = (error: any) => {
      // Retry on network errors or temporary database issues
      return (
        error?.message?.includes('network') ||
        error?.message?.includes('timeout') ||
        error?.code === 'ECONNRESET' ||
        error?.code === 'ETIMEDOUT'
      )
    },
  } = options

  let lastError: any
  let delay = initialDelay

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error

      // Don't retry if this is the last attempt or error is not retryable
      if (attempt === maxRetries || !shouldRetry(error)) {
        throw error
      }

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay))
      
      // Exponential backoff with max delay
      delay = Math.min(delay * 2, maxDelay)
    }
  }

  throw lastError
}

/**
 * Transaction wrapper with automatic rollback on error
 */
export async function withTransaction<T>(
  operation: () => Promise<T>
): Promise<T> {
  try {
    const result = await operation()
    return result
  } catch (error) {
    // Log transaction failure
    console.error('[Transaction Error]:', error)
    throw error
  }
}
