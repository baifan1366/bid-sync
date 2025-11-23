/**
 * Error Logger
 * 
 * Centralized error logging with context and structured output
 */

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  FATAL = 'FATAL',
}

export interface LogContext {
  userId?: string
  documentId?: string
  workspaceId?: string
  operation?: string
  [key: string]: any
}

export interface ErrorLogEntry {
  timestamp: string
  level: LogLevel
  message: string
  error?: {
    name: string
    message: string
    stack?: string
  }
  context?: LogContext
}

/**
 * Error Logger Class
 */
class ErrorLogger {
  private isDevelopment = process.env.NODE_ENV === 'development'

  /**
   * Log an error with context
   */
  error(message: string, error?: Error, context?: LogContext): void {
    const entry: ErrorLogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel.ERROR,
      message,
      context,
    }

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: this.isDevelopment ? error.stack : undefined,
      }
    }

    this.log(entry)

    // Send to external monitoring service in production
    if (!this.isDevelopment) {
      this.sendToMonitoring(entry)
    }
  }

  /**
   * Log a warning
   */
  warn(message: string, context?: LogContext): void {
    const entry: ErrorLogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel.WARN,
      message,
      context,
    }

    this.log(entry)
  }

  /**
   * Log info message
   */
  info(message: string, context?: LogContext): void {
    const entry: ErrorLogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel.INFO,
      message,
      context,
    }

    this.log(entry)
  }

  /**
   * Log debug message (only in development)
   */
  debug(message: string, context?: LogContext): void {
    if (!this.isDevelopment) return

    const entry: ErrorLogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel.DEBUG,
      message,
      context,
    }

    this.log(entry)
  }

  /**
   * Log fatal error (system-critical)
   */
  fatal(message: string, error?: Error, context?: LogContext): void {
    const entry: ErrorLogEntry = {
      timestamp: new Date().toISOString(),
      level: LogLevel.FATAL,
      message,
      context,
    }

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      }
    }

    this.log(entry)

    // Always send fatal errors to monitoring
    this.sendToMonitoring(entry)
  }

  /**
   * Output log entry
   */
  private log(entry: ErrorLogEntry): void {
    const output = this.formatLogEntry(entry)

    switch (entry.level) {
      case LogLevel.DEBUG:
      case LogLevel.INFO:
        console.log(output)
        break
      case LogLevel.WARN:
        console.warn(output)
        break
      case LogLevel.ERROR:
      case LogLevel.FATAL:
        console.error(output)
        break
    }
  }

  /**
   * Format log entry for output
   */
  private formatLogEntry(entry: ErrorLogEntry): string {
    if (this.isDevelopment) {
      // Pretty print in development
      return JSON.stringify(entry, null, 2)
    }

    // Compact JSON in production
    return JSON.stringify(entry)
  }

  /**
   * Send log entry to external monitoring service
   */
  private sendToMonitoring(entry: ErrorLogEntry): void {
    // Integration with monitoring services like Sentry, DataDog, etc.
    // Example: Sentry.captureException(entry)
    
    // For now, just ensure it's logged
    if (typeof window !== 'undefined' && (window as any).Sentry) {
      (window as any).Sentry.captureException(entry.error || new Error(entry.message), {
        level: entry.level.toLowerCase(),
        contexts: {
          custom: entry.context,
        },
      })
    }
  }
}

// Export singleton instance
export const errorLogger = new ErrorLogger()

/**
 * Helper function to log errors with automatic context extraction
 */
export function logError(
  message: string,
  error?: Error,
  additionalContext?: Record<string, any>
): void {
  const context: LogContext = {
    ...additionalContext,
  }

  // Try to extract user context if available
  if (typeof window !== 'undefined') {
    // Client-side context
    context.userAgent = navigator.userAgent
    context.url = window.location.href
  }

  errorLogger.error(message, error, context)
}

/**
 * Helper to create error context from request
 */
export function createErrorContext(
  operation: string,
  userId?: string,
  additionalContext?: Record<string, any>
): LogContext {
  return {
    operation,
    userId,
    ...additionalContext,
  }
}
