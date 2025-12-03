/**
 * Logging Service
 * 
 * Centralized structured logging for the project-delivery-archival feature.
 * Logs all operations, status transitions, and important events.
 */

import { createClient } from '@/lib/supabase/server';

/**
 * Log levels
 */
export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

/**
 * Operation types for categorization
 */
export enum OperationType {
  // Deliverable operations
  DELIVERABLE_UPLOAD = 'DELIVERABLE_UPLOAD',
  DELIVERABLE_DELETE = 'DELIVERABLE_DELETE',
  DELIVERABLE_DOWNLOAD = 'DELIVERABLE_DOWNLOAD',
  
  // Status transitions
  STATUS_TRANSITION = 'STATUS_TRANSITION',
  READY_FOR_DELIVERY = 'READY_FOR_DELIVERY',
  COMPLETION_REVIEW = 'COMPLETION_REVIEW',
  COMPLETION_ACCEPT = 'COMPLETION_ACCEPT',
  REVISION_REQUEST = 'REVISION_REQUEST',
  
  // Archive operations
  ARCHIVE_CREATE = 'ARCHIVE_CREATE',
  ARCHIVE_ACCESS = 'ARCHIVE_ACCESS',
  ARCHIVE_SEARCH = 'ARCHIVE_SEARCH',
  ARCHIVE_DELETE = 'ARCHIVE_DELETE',
  
  // Retention policy operations
  RETENTION_CHECK = 'RETENTION_CHECK',
  RETENTION_MARK_DELETION = 'RETENTION_MARK_DELETION',
  RETENTION_EXECUTE_DELETION = 'RETENTION_EXECUTE_DELETION',
  LEGAL_HOLD_APPLY = 'LEGAL_HOLD_APPLY',
  LEGAL_HOLD_REMOVE = 'LEGAL_HOLD_REMOVE',
  
  // Export operations
  EXPORT_REQUEST = 'EXPORT_REQUEST',
  EXPORT_PROCESS = 'EXPORT_PROCESS',
  EXPORT_DOWNLOAD = 'EXPORT_DOWNLOAD',
  EXPORT_CLEANUP = 'EXPORT_CLEANUP',
  
  // Notification operations
  NOTIFICATION_SEND = 'NOTIFICATION_SEND',
  
  // General
  VALIDATION = 'VALIDATION',
  AUTHORIZATION = 'AUTHORIZATION',
}

/**
 * Log entry structure
 */
export interface LogEntry {
  level: LogLevel;
  operation: OperationType;
  message: string;
  userId?: string;
  projectId?: string;
  deliverableId?: string;
  archiveId?: string;
  exportId?: string;
  completionId?: string;
  metadata?: Record<string, any>;
  timestamp: Date;
  duration?: number;
}

/**
 * Logging Service class
 */
export class LoggingService {
  /**
   * Logs a deliverable upload operation
   */
  static async logDeliverableUpload(
    userId: string,
    projectId: string,
    deliverableId: string,
    fileName: string,
    fileSize: number,
    success: boolean,
    duration?: number
  ): Promise<void> {
    await this.log({
      level: success ? LogLevel.INFO : LogLevel.ERROR,
      operation: OperationType.DELIVERABLE_UPLOAD,
      message: success
        ? `Deliverable uploaded successfully: ${fileName}`
        : `Deliverable upload failed: ${fileName}`,
      userId,
      projectId,
      deliverableId,
      metadata: {
        fileName,
        fileSize,
        success,
      },
      timestamp: new Date(),
      duration,
    });
  }

  /**
   * Logs a deliverable deletion operation
   */
  static async logDeliverableDelete(
    userId: string,
    projectId: string,
    deliverableId: string,
    fileName: string,
    success: boolean
  ): Promise<void> {
    await this.log({
      level: success ? LogLevel.INFO : LogLevel.ERROR,
      operation: OperationType.DELIVERABLE_DELETE,
      message: success
        ? `Deliverable deleted successfully: ${fileName}`
        : `Deliverable deletion failed: ${fileName}`,
      userId,
      projectId,
      deliverableId,
      metadata: {
        fileName,
        success,
      },
      timestamp: new Date(),
    });
  }

  /**
   * Logs a deliverable download operation
   */
  static async logDeliverableDownload(
    userId: string,
    projectId: string,
    deliverableId: string,
    fileName: string
  ): Promise<void> {
    await this.log({
      level: LogLevel.INFO,
      operation: OperationType.DELIVERABLE_DOWNLOAD,
      message: `Deliverable downloaded: ${fileName}`,
      userId,
      projectId,
      deliverableId,
      metadata: {
        fileName,
      },
      timestamp: new Date(),
    });
  }

  /**
   * Logs a project status transition
   */
  static async logStatusTransition(
    userId: string,
    projectId: string,
    fromStatus: string,
    toStatus: string,
    reason?: string
  ): Promise<void> {
    await this.log({
      level: LogLevel.INFO,
      operation: OperationType.STATUS_TRANSITION,
      message: `Project status changed from ${fromStatus} to ${toStatus}`,
      userId,
      projectId,
      metadata: {
        fromStatus,
        toStatus,
        reason,
      },
      timestamp: new Date(),
    });
  }

  /**
   * Logs marking a project ready for delivery
   */
  static async logReadyForDelivery(
    userId: string,
    projectId: string,
    proposalId: string,
    deliverableCount: number,
    success: boolean
  ): Promise<void> {
    await this.log({
      level: success ? LogLevel.INFO : LogLevel.ERROR,
      operation: OperationType.READY_FOR_DELIVERY,
      message: success
        ? `Project marked ready for delivery with ${deliverableCount} deliverables`
        : `Failed to mark project ready for delivery`,
      userId,
      projectId,
      metadata: {
        proposalId,
        deliverableCount,
        success,
      },
      timestamp: new Date(),
    });
  }

  /**
   * Logs a completion review
   */
  static async logCompletionReview(
    userId: string,
    projectId: string,
    completionId: string,
    reviewStatus: string,
    hasComments: boolean
  ): Promise<void> {
    await this.log({
      level: LogLevel.INFO,
      operation: OperationType.COMPLETION_REVIEW,
      message: `Completion reviewed with status: ${reviewStatus}`,
      userId,
      projectId,
      completionId,
      metadata: {
        reviewStatus,
        hasComments,
      },
      timestamp: new Date(),
    });
  }

  /**
   * Logs completion acceptance
   */
  static async logCompletionAccept(
    userId: string,
    projectId: string,
    completionId: string,
    success: boolean
  ): Promise<void> {
    await this.log({
      level: success ? LogLevel.INFO : LogLevel.ERROR,
      operation: OperationType.COMPLETION_ACCEPT,
      message: success
        ? 'Project completion accepted'
        : 'Failed to accept project completion',
      userId,
      projectId,
      completionId,
      metadata: {
        success,
      },
      timestamp: new Date(),
    });
  }

  /**
   * Logs a revision request
   */
  static async logRevisionRequest(
    userId: string,
    projectId: string,
    completionId: string,
    revisionNumber: number,
    hasNotes: boolean,
    success: boolean
  ): Promise<void> {
    await this.log({
      level: success ? LogLevel.INFO : LogLevel.ERROR,
      operation: OperationType.REVISION_REQUEST,
      message: success
        ? `Revision #${revisionNumber} requested`
        : `Failed to request revision`,
      userId,
      projectId,
      completionId,
      metadata: {
        revisionNumber,
        hasNotes,
        success,
      },
      timestamp: new Date(),
    });
  }

  /**
   * Logs archive creation
   */
  static async logArchiveCreate(
    userId: string,
    projectId: string,
    archiveId: string,
    archiveIdentifier: string,
    compressedSize: number,
    originalSize: number,
    compressionRatio: number,
    success: boolean,
    duration?: number
  ): Promise<void> {
    await this.log({
      level: success ? LogLevel.INFO : LogLevel.ERROR,
      operation: OperationType.ARCHIVE_CREATE,
      message: success
        ? `Archive created: ${archiveIdentifier}`
        : `Archive creation failed`,
      userId,
      projectId,
      archiveId,
      metadata: {
        archiveIdentifier,
        compressedSize,
        originalSize,
        compressionRatio,
        success,
      },
      timestamp: new Date(),
      duration,
    });
  }

  /**
   * Logs archive access
   */
  static async logArchiveAccess(
    userId: string,
    projectId: string,
    archiveId: string,
    archiveIdentifier: string,
    accessCount: number
  ): Promise<void> {
    await this.log({
      level: LogLevel.INFO,
      operation: OperationType.ARCHIVE_ACCESS,
      message: `Archive accessed: ${archiveIdentifier}`,
      userId,
      projectId,
      archiveId,
      metadata: {
        archiveIdentifier,
        accessCount,
      },
      timestamp: new Date(),
    });
  }

  /**
   * Logs archive search
   */
  static async logArchiveSearch(
    userId: string,
    query: string,
    resultCount: number,
    duration?: number
  ): Promise<void> {
    await this.log({
      level: LogLevel.INFO,
      operation: OperationType.ARCHIVE_SEARCH,
      message: `Archive search performed: "${query}" (${resultCount} results)`,
      userId,
      metadata: {
        query,
        resultCount,
      },
      timestamp: new Date(),
      duration,
    });
  }

  /**
   * Logs archive deletion
   */
  static async logArchiveDelete(
    userId: string,
    projectId: string,
    archiveId: string,
    archiveIdentifier: string,
    reason: string,
    success: boolean
  ): Promise<void> {
    await this.log({
      level: success ? LogLevel.WARN : LogLevel.ERROR,
      operation: OperationType.ARCHIVE_DELETE,
      message: success
        ? `Archive deleted: ${archiveIdentifier}`
        : `Archive deletion failed: ${archiveIdentifier}`,
      userId,
      projectId,
      archiveId,
      metadata: {
        archiveIdentifier,
        reason,
        success,
      },
      timestamp: new Date(),
    });
  }

  /**
   * Logs retention policy check
   */
  static async logRetentionCheck(
    archivesChecked: number,
    archivesMarked: number,
    duration?: number
  ): Promise<void> {
    await this.log({
      level: LogLevel.INFO,
      operation: OperationType.RETENTION_CHECK,
      message: `Retention policy check: ${archivesChecked} checked, ${archivesMarked} marked for deletion`,
      metadata: {
        archivesChecked,
        archivesMarked,
      },
      timestamp: new Date(),
      duration,
    });
  }

  /**
   * Logs marking an archive for deletion
   */
  static async logRetentionMarkDeletion(
    archiveId: string,
    projectId: string,
    archiveIdentifier: string,
    scheduledDeletionAt: Date,
    success: boolean
  ): Promise<void> {
    await this.log({
      level: success ? LogLevel.WARN : LogLevel.ERROR,
      operation: OperationType.RETENTION_MARK_DELETION,
      message: success
        ? `Archive marked for deletion: ${archiveIdentifier}`
        : `Failed to mark archive for deletion: ${archiveIdentifier}`,
      projectId,
      archiveId,
      metadata: {
        archiveIdentifier,
        scheduledDeletionAt: scheduledDeletionAt.toISOString(),
        success,
      },
      timestamp: new Date(),
    });
  }

  /**
   * Logs executing scheduled deletions
   */
  static async logRetentionExecuteDeletion(
    archivesDeleted: number,
    errors: string[],
    duration?: number
  ): Promise<void> {
    await this.log({
      level: errors.length > 0 ? LogLevel.WARN : LogLevel.INFO,
      operation: OperationType.RETENTION_EXECUTE_DELETION,
      message: `Scheduled deletions executed: ${archivesDeleted} deleted, ${errors.length} errors`,
      metadata: {
        archivesDeleted,
        errors,
      },
      timestamp: new Date(),
      duration,
    });
  }

  /**
   * Logs applying a legal hold
   */
  static async logLegalHoldApply(
    userId: string,
    projectId: string,
    archiveId: string,
    archiveIdentifier: string,
    reason: string,
    success: boolean
  ): Promise<void> {
    await this.log({
      level: success ? LogLevel.WARN : LogLevel.ERROR,
      operation: OperationType.LEGAL_HOLD_APPLY,
      message: success
        ? `Legal hold applied to archive: ${archiveIdentifier}`
        : `Failed to apply legal hold to archive: ${archiveIdentifier}`,
      userId,
      projectId,
      archiveId,
      metadata: {
        archiveIdentifier,
        reason,
        success,
      },
      timestamp: new Date(),
    });
  }

  /**
   * Logs removing a legal hold
   */
  static async logLegalHoldRemove(
    userId: string,
    projectId: string,
    archiveId: string,
    archiveIdentifier: string,
    success: boolean
  ): Promise<void> {
    await this.log({
      level: success ? LogLevel.WARN : LogLevel.ERROR,
      operation: OperationType.LEGAL_HOLD_REMOVE,
      message: success
        ? `Legal hold removed from archive: ${archiveIdentifier}`
        : `Failed to remove legal hold from archive: ${archiveIdentifier}`,
      userId,
      projectId,
      archiveId,
      metadata: {
        archiveIdentifier,
        success,
      },
      timestamp: new Date(),
    });
  }

  /**
   * Logs an export request
   */
  static async logExportRequest(
    userId: string,
    projectId: string,
    exportId: string,
    success: boolean
  ): Promise<void> {
    await this.log({
      level: success ? LogLevel.INFO : LogLevel.ERROR,
      operation: OperationType.EXPORT_REQUEST,
      message: success
        ? 'Export requested'
        : 'Export request failed',
      userId,
      projectId,
      exportId,
      metadata: {
        success,
      },
      timestamp: new Date(),
    });
  }

  /**
   * Logs export processing
   */
  static async logExportProcess(
    exportId: string,
    projectId: string,
    status: string,
    exportSize?: number,
    errorMessage?: string,
    duration?: number
  ): Promise<void> {
    await this.log({
      level: status === 'completed' ? LogLevel.INFO : LogLevel.ERROR,
      operation: OperationType.EXPORT_PROCESS,
      message: `Export processing ${status}`,
      projectId,
      exportId,
      metadata: {
        status,
        exportSize,
        errorMessage,
      },
      timestamp: new Date(),
      duration,
    });
  }

  /**
   * Logs export download
   */
  static async logExportDownload(
    userId: string,
    projectId: string,
    exportId: string
  ): Promise<void> {
    await this.log({
      level: LogLevel.INFO,
      operation: OperationType.EXPORT_DOWNLOAD,
      message: 'Export downloaded',
      userId,
      projectId,
      exportId,
      timestamp: new Date(),
    });
  }

  /**
   * Logs export cleanup
   */
  static async logExportCleanup(
    cleanedCount: number,
    duration?: number
  ): Promise<void> {
    await this.log({
      level: LogLevel.INFO,
      operation: OperationType.EXPORT_CLEANUP,
      message: `Export cleanup: ${cleanedCount} expired exports removed`,
      metadata: {
        cleanedCount,
      },
      timestamp: new Date(),
      duration,
    });
  }

  /**
   * Logs a notification send operation
   */
  static async logNotificationSend(
    userId: string,
    notificationType: string,
    projectId?: string,
    success: boolean = true
  ): Promise<void> {
    await this.log({
      level: success ? LogLevel.INFO : LogLevel.WARN,
      operation: OperationType.NOTIFICATION_SEND,
      message: success
        ? `Notification sent: ${notificationType}`
        : `Notification failed: ${notificationType}`,
      userId,
      projectId,
      metadata: {
        notificationType,
        success,
      },
      timestamp: new Date(),
    });
  }

  /**
   * Logs a validation error
   */
  static async logValidationError(
    operation: string,
    userId?: string,
    projectId?: string,
    validationErrors?: string[]
  ): Promise<void> {
    await this.log({
      level: LogLevel.WARN,
      operation: OperationType.VALIDATION,
      message: `Validation failed for ${operation}`,
      userId,
      projectId,
      metadata: {
        operation,
        validationErrors,
      },
      timestamp: new Date(),
    });
  }

  /**
   * Logs an authorization failure
   */
  static async logAuthorizationFailure(
    operation: string,
    userId: string,
    projectId?: string,
    reason?: string
  ): Promise<void> {
    await this.log({
      level: LogLevel.WARN,
      operation: OperationType.AUTHORIZATION,
      message: `Authorization failed for ${operation}`,
      userId,
      projectId,
      metadata: {
        operation,
        reason,
      },
      timestamp: new Date(),
    });
  }

  /**
   * Core logging method that writes to database
   */
  private static async log(entry: LogEntry): Promise<void> {
    try {
      // Log to console for immediate visibility
      const consoleMessage = `[${entry.level}] [${entry.operation}] ${entry.message}`;
      
      switch (entry.level) {
        case LogLevel.DEBUG:
          console.debug(consoleMessage, entry.metadata);
          break;
        case LogLevel.INFO:
          console.info(consoleMessage, entry.metadata);
          break;
        case LogLevel.WARN:
          console.warn(consoleMessage, entry.metadata);
          break;
        case LogLevel.ERROR:
          console.error(consoleMessage, entry.metadata);
          break;
      }

      // Write to database for persistence
      const supabase = await createClient();
      
      await supabase.from('operation_logs').insert({
        level: entry.level,
        operation: entry.operation,
        message: entry.message,
        user_id: entry.userId,
        project_id: entry.projectId,
        deliverable_id: entry.deliverableId,
        archive_id: entry.archiveId,
        export_id: entry.exportId,
        completion_id: entry.completionId,
        metadata: entry.metadata,
        timestamp: entry.timestamp.toISOString(),
        duration_ms: entry.duration,
      });
    } catch (error) {
      // Don't throw if logging fails - just log to console
      console.error('Failed to write log entry:', error);
    }
  }

  /**
   * Helper to measure operation duration
   */
  static startTimer(): () => number {
    const startTime = Date.now();
    return () => Date.now() - startTime;
  }
}
