/**
 * Retry Utilities
 * 
 * Provides retry logic for failed operations with exponential backoff
 * and configurable retry strategies.
 */

import { errorLogger } from './error-logger';
import { isRetryableError } from './error-utils';

/**
 * Retry configuration options
 */
export interface RetryOptions {
  /** Maximum number of retry attempts */
  maxAttempts?: number;
  
  /** Initial delay in milliseconds */
  initialDelay?: number;
  
  /** Maximum delay in milliseconds */
  maxDelay?: number;
  
  /** Backoff multiplier for exponential backoff */
  backoffMultiplier?: number;
  
  /** Whether to use exponential backoff */
  useExponentialBackoff?: boolean;
  
  /** Custom function to determine if error is retryable */
  shouldRetry?: (error: any, attempt: number) => boolean;
  
  /** Callback called before each retry */
  onRetry?: (error: any, attempt: number, delay: number) => void;
  
  /** Callback called when all retries are exhausted */
  onMaxAttemptsReached?: (error: any) => void;
}

/**
 * Default retry configuration
 */
const DEFAULT_RETRY_OPTIONS: Required<Omit<RetryOptions, 'onRetry' | 'onMaxAttemptsReached'>> = {
  maxAttempts: 3,
  initialDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  backoffMultiplier: 2,
  useExponentialBackoff: true,
  shouldRetry: (error: any) => isRetryableError(error),
};

/**
 * Calculate delay for next retry attempt
 */
function calculateDelay(
  attempt: number,
  options: Required<Omit<RetryOptions, 'onRetry' | 'onMaxAttemptsReached'>>
): number {
  if (!options.useExponentialBackoff) {
    return options.initialDelay;
  }

  const exponentialDelay = options.initialDelay * Math.pow(options.backoffMultiplier, attempt - 1);
  return Math.min(exponentialDelay, options.maxDelay);
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry an async operation with exponential backoff
 * 
 * @param operation - The async function to retry
 * @param options - Retry configuration options
 * @returns Promise that resolves with the operation result
 * @throws The last error if all retry attempts fail
 * 
 * @example
 * ```typescript
 * const result = await retryOperation(
 *   async () => await fetchData(),
 *   { maxAttempts: 3, initialDelay: 1000 }
 * );
 * ```
 */
export async function retryOperation<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const config = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: any;

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      // Check if we should retry
      const shouldRetry = config.shouldRetry(error, attempt);
      const isLastAttempt = attempt === config.maxAttempts;

      if (!shouldRetry || isLastAttempt) {
        // Log final failure
        errorLogger.error(
          `Operation failed after ${attempt} attempt(s)`,
          error instanceof Error ? error : undefined,
          { attempt, maxAttempts: config.maxAttempts }
        );

        if (isLastAttempt && options.onMaxAttemptsReached) {
          options.onMaxAttemptsReached(error);
        }

        throw error;
      }

      // Calculate delay for next retry
      const delay = calculateDelay(attempt, config);

      // Log retry attempt
      errorLogger.warn(
        `Operation failed, retrying in ${delay}ms (attempt ${attempt}/${config.maxAttempts})`,
        { attempt, delay, error: error instanceof Error ? error.message : String(error) }
      );

      // Call onRetry callback if provided
      if (options.onRetry) {
        options.onRetry(error, attempt, delay);
      }

      // Wait before retrying
      await sleep(delay);
    }
  }

  // This should never be reached, but TypeScript needs it
  throw lastError;
}

/**
 * Retry a GraphQL mutation with specific error handling
 * 
 * @param mutation - The GraphQL mutation function
 * @param options - Retry configuration options
 * @returns Promise that resolves with the mutation result
 */
export async function retryGraphQLMutation<T>(
  mutation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  return retryOperation(mutation, {
    maxAttempts: 3,
    initialDelay: 1000,
    ...options,
    shouldRetry: (error: any, attempt: number) => {
      // Don't retry validation errors or auth errors
      if (error?.extensions?.code === 'BAD_USER_INPUT') return false;
      if (error?.extensions?.code === 'UNAUTHENTICATED') return false;
      if (error?.extensions?.code === 'FORBIDDEN') return false;
      
      // Retry network errors and server errors
      if (error?.networkError) return true;
      if (error?.extensions?.code === 'INTERNAL_SERVER_ERROR') return true;
      
      // Use custom shouldRetry if provided
      if (options.shouldRetry) {
        return options.shouldRetry(error, attempt);
      }
      
      return isRetryableError(error);
    },
  });
}

/**
 * Retry a database operation with specific error handling
 * 
 * @param operation - The database operation function
 * @param options - Retry configuration options
 * @returns Promise that resolves with the operation result
 */
export async function retryDatabaseOperation<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  return retryOperation(operation, {
    maxAttempts: 3,
    initialDelay: 500,
    ...options,
    shouldRetry: (error: any, attempt: number) => {
      // Don't retry constraint violations
      if (error?.code === '23505') return false; // Unique violation
      if (error?.code === '23503') return false; // Foreign key violation
      if (error?.code === '23514') return false; // Check violation
      
      // Retry connection errors and timeouts
      if (error?.code === '57P01') return true; // Connection terminated
      if (error?.code === '57P03') return true; // Connection does not exist
      if (error?.message?.includes('timeout')) return true;
      if (error?.message?.includes('connection')) return true;
      
      // Use custom shouldRetry if provided
      if (options.shouldRetry) {
        return options.shouldRetry(error, attempt);
      }
      
      return isRetryableError(error);
    },
  });
}

/**
 * Retry with circuit breaker pattern
 * Prevents overwhelming a failing service with retry attempts
 */
export class CircuitBreaker {
  private failureCount = 0;
  private lastFailureTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(
    options: {
      failureThreshold?: number;
      resetTimeout?: number;
      monitoringPeriod?: number;
    } = {}
  ) {
    this.options = {
      failureThreshold: options.failureThreshold ?? 5,
      resetTimeout: options.resetTimeout ?? 60000, // 1 minute
      monitoringPeriod: options.monitoringPeriod ?? 10000, // 10 seconds
    };
  }

  private options: {
    failureThreshold: number;
    resetTimeout: number;
    monitoringPeriod: number;
  };

  /**
   * Execute operation with circuit breaker protection
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    // Check if circuit is open
    if (this.state === 'open') {
      const timeSinceLastFailure = Date.now() - this.lastFailureTime;
      
      if (timeSinceLastFailure < this.options.resetTimeout) {
        throw new Error('Circuit breaker is open. Service is temporarily unavailable.');
      }
      
      // Try to close circuit (half-open state)
      this.state = 'half-open';
    }

    try {
      const result = await operation();
      
      // Success - reset circuit
      if (this.state === 'half-open') {
        this.state = 'closed';
        this.failureCount = 0;
      }
      
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  /**
   * Record a failure and potentially open the circuit
   */
  private recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.options.failureThreshold) {
      this.state = 'open';
      errorLogger.warn('Circuit breaker opened due to repeated failures', {
        failureCount: this.failureCount,
        threshold: this.options.failureThreshold,
      });
    }
  }

  /**
   * Get current circuit state
   */
  getState(): 'closed' | 'open' | 'half-open' {
    return this.state;
  }

  /**
   * Manually reset the circuit breaker
   */
  reset(): void {
    this.state = 'closed';
    this.failureCount = 0;
    this.lastFailureTime = 0;
  }
}

/**
 * Create a circuit breaker for a specific service
 */
export function createCircuitBreaker(
  options?: {
    failureThreshold?: number;
    resetTimeout?: number;
    monitoringPeriod?: number;
  }
): CircuitBreaker {
  return new CircuitBreaker(options);
}

/**
 * Batch retry operations with rate limiting
 * Useful for retrying multiple failed operations without overwhelming the system
 */
export async function batchRetryOperations<T>(
  operations: Array<() => Promise<T>>,
  options: RetryOptions & {
    concurrency?: number;
    delayBetweenBatches?: number;
  } = {}
): Promise<Array<{ success: boolean; result?: T; error?: any }>> {
  const { concurrency = 3, delayBetweenBatches = 100, ...retryOptions } = options;
  const results: Array<{ success: boolean; result?: T; error?: any }> = [];

  // Process operations in batches
  for (let i = 0; i < operations.length; i += concurrency) {
    const batch = operations.slice(i, i + concurrency);
    
    const batchResults = await Promise.all(
      batch.map(async (operation) => {
        try {
          const result = await retryOperation(operation, retryOptions);
          return { success: true, result };
        } catch (error) {
          return { success: false, error };
        }
      })
    );

    results.push(...batchResults);

    // Delay between batches to avoid overwhelming the system
    if (i + concurrency < operations.length) {
      await sleep(delayBetweenBatches);
    }
  }

  return results;
}
