"use client"

import React from "react"
import { AlertTriangle, RefreshCw, Home } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

interface EditorErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ReactNode
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
}

interface EditorErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: React.ErrorInfo | null
}

/**
 * Error Boundary for Collaborative Editor
 * 
 * Catches and handles errors in the editor component tree
 * Provides user-friendly error messages and recovery options
 */
export class EditorErrorBoundary extends React.Component<
  EditorErrorBoundaryProps,
  EditorErrorBoundaryState
> {
  constructor(props: EditorErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error: Error): Partial<EditorErrorBoundaryState> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Editor Error:", error, errorInfo)
    
    // Log error to monitoring service (e.g., Sentry)
    if (typeof window !== 'undefined' && (window as any).Sentry) {
      (window as any).Sentry.captureException(error, {
        contexts: {
          react: {
            componentStack: errorInfo.componentStack,
          },
        },
      })
    }

    this.setState({ errorInfo })
    
    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
  }

  handleGoHome = () => {
    window.location.href = "/documents"
  }

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="flex h-screen items-center justify-center bg-background p-4">
          <div className="max-w-2xl w-full space-y-6">
            <Alert variant="destructive">
              <AlertTriangle className="h-5 w-5" />
              <AlertTitle className="text-lg font-semibold">
                Editor Error
              </AlertTitle>
              <AlertDescription className="mt-2">
                The collaborative editor encountered an unexpected error. Your work may have been saved automatically.
              </AlertDescription>
            </Alert>

            <div className="bg-card border border-border rounded-lg p-6 space-y-4">
              <h2 className="text-xl font-semibold">What happened?</h2>
              <p className="text-muted-foreground">
                {this.state.error?.message || "An unknown error occurred"}
              </p>

              {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
                <details className="text-left text-sm bg-muted p-4 rounded-md">
                  <summary className="cursor-pointer font-medium mb-2">
                    Technical details (development only)
                  </summary>
                  <pre className="whitespace-pre-wrap wrap-break-words text-xs overflow-auto max-h-64">
                    {this.state.error?.stack}
                    {'\n\n'}
                    {this.state.errorInfo.componentStack}
                  </pre>
                </details>
              )}

              <div className="flex gap-3 pt-4">
                <Button onClick={this.handleReset} className="bg-yellow-400 hover:bg-yellow-500 text-black">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Try Again
                </Button>
                <Button variant="outline" onClick={this.handleGoHome}>
                  <Home className="mr-2 h-4 w-4" />
                  Go to Documents
                </Button>
                <Button variant="outline" onClick={() => window.location.reload()}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Reload Page
                </Button>
              </div>
            </div>

            <div className="text-sm text-muted-foreground text-center">
              If this problem persists, please contact support with the error details above.
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
