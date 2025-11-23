"use client"

import { useState, useCallback } from 'react'
import { useToast } from '@/components/ui/use-toast'

export interface AsyncOperationState<T> {
  data: T | null
  loading: boolean
  error: Error | null
}

export interface AsyncOperationOptions {
  onSuccess?: (data: any) => void
  onError?: (error: Error) => void
  showSuccessToast?: boolean
  showErrorToast?: boolean
  successMessage?: string
  errorMessage?: string
  retryCount?: number
  retryDelay?: number
}

/**
 * Custom hook for handling async operations with loading states and error handling
 * 
 * Features:
 * - Automatic loading state management
 * - Error handling with retry logic
 * - Toast notifications for success/error
 * - Cleanup on unmount
 * 
 * @example
 * const { execute, loading, error, data } = useAsyncOperation(
 *   async () => await documentService.createDocument(input),
 *   {
 *     showSuccessToast: true,
 *     successMessage: 'Document created successfully',
 *     retryCount: 3
 *   }
 * )
 */
export function useAsyncOperation<T = any>(
  operation: (...args: any[]) => Promise<T>,
  options: AsyncOperationOptions = {}
) {
  const [state, setState] = useState<AsyncOperationState<T>>({
    data: null,
    loading: false,
    error: null,
  })

  const { toast } = useToast()

  const {
    onSuccess,
    onError,
    showSuccessToast = false,
    showErrorToast = true,
    successMessage = 'Operation completed successfully',
    errorMessage = 'Operation failed',
    retryCount = 0,
    retryDelay = 1000,
  } = options

  const execute = useCallback(
    async (...args: any[]) => {
      setState({ data: null, loading: true, error: null })

      let lastError: Error | null = null
      let attempts = 0

      while (attempts <= retryCount) {
        try {
          const result = await operation(...args)
          
          setState({ data: result, loading: false, error: null })

          if (showSuccessToast) {
            toast({
              title: 'Success',
              description: successMessage,
              variant: 'default',
            })
          }

          if (onSuccess) {
            onSuccess(result)
          }

          return result
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error))
          attempts++

          // If we have retries left, wait and try again
          if (attempts <= retryCount) {
            await new Promise(resolve => setTimeout(resolve, retryDelay * attempts))
            continue
          }

          // All retries exhausted
          setState({ data: null, loading: false, error: lastError })

          if (showErrorToast) {
            toast({
              title: 'Error',
              description: lastError.message || errorMessage,
              variant: 'destructive',
            })
          }

          if (onError) {
            onError(lastError)
          }

          throw lastError
        }
      }

      throw lastError
    },
    [operation, onSuccess, onError, showSuccessToast, showErrorToast, successMessage, errorMessage, retryCount, retryDelay, toast]
  )

  const reset = useCallback(() => {
    setState({ data: null, loading: false, error: null })
  }, [])

  return {
    execute,
    reset,
    ...state,
  }
}

/**
 * Hook for handling mutations with optimistic updates
 */
export function useOptimisticMutation<T = any>(
  operation: (...args: any[]) => Promise<T>,
  options: AsyncOperationOptions & {
    optimisticUpdate?: (args: any[]) => T
    rollback?: () => void
  } = {}
) {
  const [state, setState] = useState<AsyncOperationState<T>>({
    data: null,
    loading: false,
    error: null,
  })

  const { toast } = useToast()

  const {
    onSuccess,
    onError,
    showSuccessToast = false,
    showErrorToast = true,
    successMessage = 'Operation completed successfully',
    errorMessage = 'Operation failed',
    optimisticUpdate,
    rollback,
  } = options

  const execute = useCallback(
    async (...args: any[]) => {
      // Apply optimistic update immediately
      if (optimisticUpdate) {
        const optimisticData = optimisticUpdate(args)
        setState({ data: optimisticData, loading: true, error: null })
      } else {
        setState(prev => ({ ...prev, loading: true, error: null }))
      }

      try {
        const result = await operation(...args)
        
        setState({ data: result, loading: false, error: null })

        if (showSuccessToast) {
          toast({
            title: 'Success',
            description: successMessage,
            variant: 'default',
          })
        }

        if (onSuccess) {
          onSuccess(result)
        }

        return result
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error))
        
        // Rollback optimistic update
        if (rollback) {
          rollback()
        }
        
        setState({ data: null, loading: false, error: err })

        if (showErrorToast) {
          toast({
            title: 'Error',
            description: err.message || errorMessage,
            variant: 'destructive',
          })
        }

        if (onError) {
          onError(err)
        }

        throw err
      }
    },
    [operation, onSuccess, onError, showSuccessToast, showErrorToast, successMessage, errorMessage, optimisticUpdate, rollback, toast]
  )

  const reset = useCallback(() => {
    setState({ data: null, loading: false, error: null })
  }, [])

  return {
    execute,
    reset,
    ...state,
  }
}
