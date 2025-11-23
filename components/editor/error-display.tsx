"use client"

import { AlertCircle, RefreshCw, X } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { getUserFriendlyErrorMessage, isRetryableError } from "@/lib/error-utils"

interface ErrorDisplayProps {
  error: Error | string | null
  title?: string
  onRetry?: () => void
  onDismiss?: () => void
  className?: string
  variant?: 'default' | 'destructive'
}

/**
 * Error Display Component
 * 
 * Displays user-friendly error messages with optional retry and dismiss actions
 */
export function ErrorDisplay({
  error,
  title = 'Error',
  onRetry,
  onDismiss,
  className = '',
  variant = 'destructive',
}: ErrorDisplayProps) {
  if (!error) return null

  const errorMessage = typeof error === 'string' 
    ? error 
    : getUserFriendlyErrorMessage(error)

  const showRetry = onRetry && (typeof error !== 'string' && isRetryableError(error))

  return (
    <Alert variant={variant} className={className}>
      <AlertCircle className="h-4 w-4" />
      <AlertTitle className="flex items-center justify-between">
        <span>{title}</span>
        {onDismiss && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={onDismiss}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </AlertTitle>
      <AlertDescription className="mt-2 space-y-3">
        <p>{errorMessage}</p>
        {showRetry && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            className="mt-2"
          >
            <RefreshCw className="mr-2 h-3 w-3" />
            Try Again
          </Button>
        )}
      </AlertDescription>
    </Alert>
  )
}

/**
 * Inline Error Message
 * 
 * Compact error display for form fields and inline contexts
 */
export function InlineError({
  error,
  className = '',
}: {
  error: Error | string | null
  className?: string
}) {
  if (!error) return null

  const errorMessage = typeof error === 'string' 
    ? error 
    : error.message

  return (
    <div className={`flex items-center gap-2 text-sm text-destructive ${className}`}>
      <AlertCircle className="h-4 w-4 shrink-0" />
      <span>{errorMessage}</span>
    </div>
  )
}
