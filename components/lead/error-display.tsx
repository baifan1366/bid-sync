"use client"

import { AlertTriangle, AlertCircle, XCircle, RefreshCw } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

interface ErrorDisplayProps {
  error: Error | string
  onRetry?: () => void
  variant?: "card" | "alert" | "inline"
  title?: string
}

/**
 * ErrorDisplay Component
 * 
 * Displays error messages in a user-friendly format with optional retry action.
 * 
 * Variants:
 * - card: Full card display (default)
 * - alert: Alert banner style
 * - inline: Minimal inline display
 */
export function ErrorDisplay({
  error,
  onRetry,
  variant = "card",
  title = "Error",
}: ErrorDisplayProps) {
  const errorMessage = typeof error === "string" ? error : error.message

  if (variant === "inline") {
    return (
      <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
        <AlertCircle className="h-4 w-4 shrink-0" />
        <span>{errorMessage}</span>
        {onRetry && (
          <Button
            size="sm"
            variant="ghost"
            onClick={onRetry}
            className="h-6 px-2 text-xs"
          >
            <RefreshCw className="h-3 w-3 mr-1" />
            Retry
          </Button>
        )}
      </div>
    )
  }

  if (variant === "alert") {
    return (
      <Alert variant="destructive" className="border-red-500/50">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>{title}</AlertTitle>
        <AlertDescription className="flex items-center justify-between">
          <span>{errorMessage}</span>
          {onRetry && (
            <Button
              size="sm"
              variant="outline"
              onClick={onRetry}
              className="ml-4 shrink-0"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Retry
            </Button>
          )}
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <Card className="border-red-500/50 bg-red-50 dark:bg-red-950/20">
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <div className="p-2 rounded-full bg-red-100 dark:bg-red-900/30">
            <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
          </div>
          <div className="flex-1 space-y-2">
            <h3 className="font-semibold text-red-900 dark:text-red-100">
              {title}
            </h3>
            <p className="text-sm text-red-700 dark:text-red-300">
              {errorMessage}
            </p>
            {onRetry && (
              <Button
                size="sm"
                onClick={onRetry}
                className="mt-3 bg-red-600 hover:bg-red-700 text-white"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * ValidationError Component
 * 
 * Displays validation errors in a consistent format
 */
export function ValidationError({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800">
      <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 mt-0.5 shrink-0" />
      <p className="text-sm text-yellow-800 dark:text-yellow-200">{message}</p>
    </div>
  )
}

/**
 * EmptyState Component
 * 
 * Displays when there's no data to show
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
  action?: React.ReactNode
}) {
  return (
    <Card className="border-yellow-400/20 bg-white dark:bg-black">
      <CardContent className="p-12">
        <div className="flex flex-col items-center justify-center text-center space-y-4">
          <div className="p-4 rounded-full bg-yellow-400/10">
            <Icon className="h-12 w-12 text-yellow-400 opacity-50" />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-black dark:text-white">
              {title}
            </h3>
            <p className="text-sm text-muted-foreground max-w-md">
              {description}
            </p>
          </div>
          {action && <div className="pt-2">{action}</div>}
        </div>
      </CardContent>
    </Card>
  )
}
