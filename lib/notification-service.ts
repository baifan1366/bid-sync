/**
 * Notification Service
 * 
 * Comprehensive notification system for BidSync platform.
 * Supports in-app notifications, email delivery, and real-time push.
 * 
 * Implements requirements from notification-system spec:
 * - 1.1, 1.2, 1.4: In-app notification management
 * - 4.3: User preference checking
 * - 13.1, 13.2: Read state management
 * - 20.1, 20.3: Notification deletion with ownership verification
 * 
 * NOTE: This is a SERVER-ONLY module. Do not import in client components.
 * For types, import from '@/lib/notification-types' instead.
 */

import { createClient } from '@/lib/supabase/server';

// Re-export types for convenience
export type {
  NotificationType,
  Notification,
  CreateNotificationInput,
} from './notification-types';

export { NotificationPriority } from './notification-types';

import type {
  NotificationType,
  Notification,
  CreateNotificationInput,
} from './notification-types';

import { NotificationPriority } from './notification-types';

// Extended result type with error codes
export interface NotificationResult {
  success: boolean;
  notificationId?: string;
  error?: string;
  errorCode?: 
    | 'INVALID_USER'
    | 'INVALID_TYPE'
    | 'VALIDATION_ERROR'
    | 'DATABASE_ERROR'
    | 'EMAIL_ERROR'
    | 'PERMISSION_ERROR'
    | 'UNKNOWN';
}

export interface GetNotificationsOptions {
  unreadOnly?: boolean;
  limit?: number;
  offset?: number;
  type?: NotificationType;
}

// Map notification types to preference categories
const NOTIFICATION_PREFERENCE_MAP: Record<NotificationType, string> = {
  // Project updates
  'project_created': 'project_updates',
  'project_approved': 'project_updates',
  'project_rejected': 'project_updates',
  'project_status_changed': 'project_updates',
  'project_deadline_approaching': 'deadline_reminders',
  'project_awarded': 'project_updates',
  'project_completed': 'project_updates',
  // Proposal updates
  'proposal_submitted': 'proposal_updates',
  'proposal_status_changed': 'proposal_updates',
  'proposal_scored': 'scoring_notifications',
  'proposal_score_updated': 'scoring_notifications',
  'all_proposals_scored': 'scoring_notifications',
  'proposal_accepted': 'proposal_updates',
  'proposal_rejected': 'proposal_updates',
  'proposal_archived': 'proposal_updates',
  // Team notifications
  'team_member_joined': 'team_notifications',
  'team_member_removed': 'team_notifications',
  'team_invitation_created': 'team_notifications',
  'team_invitation_accepted': 'team_notifications',
  // Completion notifications
  'deliverable_uploaded': 'completion_notifications',
  'ready_for_delivery': 'completion_notifications',
  'completion_accepted': 'completion_notifications',
  'revision_requested': 'completion_notifications',
  'revision_completed': 'completion_notifications',
  // Document collaboration (mapped to team_notifications)
  'document_shared': 'team_notifications',
  'document_comment_added': 'new_messages',
  'document_version_created': 'team_notifications',
  'document_rollback': 'team_notifications',
  'section_assigned': 'team_notifications',
  'section_reassigned': 'team_notifications',
  'section_completed': 'team_notifications',
  'section_deadline_approaching': 'deadline_reminders',
  // Messages and Q&A
  'message_received': 'new_messages',
  'qa_question_posted': 'qa_notifications',
  'qa_answer_posted': 'qa_notifications',
  // Admin (critical - always sent)
  'admin_invitation': 'project_updates',
  'verification_approved': 'project_updates',
  'verification_rejected': 'project_updates',
  'account_suspended': 'project_updates',
};

// Critical notification types that bypass user preferences
const CRITICAL_NOTIFICATION_TYPES: NotificationType[] = [
  'account_suspended',
  'verification_approved',
  'verification_rejected',
];

/**
 * NotificationService class for managing notifications
 * 
 * Core service implementing notification-system requirements
 */
export class NotificationService {
  // Expose NotificationPriority enum for external use
  static NotificationPriority = NotificationPriority;

  /**
   * Creates a notification for a user with input validation and preference checking
   * 
   * Requirements:
   * - 1.1: Create notification record in notification_queue
   * - 4.3: Check user preferences before sending
   * - 15.1: Non-blocking execution
   * - 15.3: Input validation
   * 
   * @param input - Notification creation data
   * @returns NotificationResult with created notification ID
   */
  static async createNotification(input: CreateNotificationInput): Promise<NotificationResult> {
    try {
      // Requirement 15.3: Input validation
      const validationError = this.validateInput(input);
      if (validationError) {
        return {
          success: false,
          error: validationError,
          errorCode: 'VALIDATION_ERROR',
        };
      }

      const supabase = await createClient();

      // Verify user exists
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('id, email, full_name')
        .eq('id', input.userId)
        .single();

      if (userError || !user) {
        return {
          success: false,
          error: 'User not found',
          errorCode: 'INVALID_USER',
        };
      }

      // Requirement 4.3: Check if notification should be sent based on preferences
      const shouldSend = await this.shouldSendNotification(input.userId, input.type);
      if (!shouldSend) {
        // User has disabled this notification type - skip silently
        return {
          success: true,
          notificationId: undefined,
        };
      }

      // Requirement 1.1: Create in-app notification
      const { data: notification, error: notificationError } = await supabase
        .from('notification_queue')
        .insert({
          user_id: input.userId,
          type: input.type,
          title: input.title,
          body: input.body,
          data: input.data || {},
        })
        .select('id')
        .single();

      if (notificationError || !notification) {
        console.error('Error creating notification:', notificationError);
        return {
          success: false,
          error: 'Failed to create notification',
          errorCode: 'DATABASE_ERROR',
        };
      }

      // Send email if requested and user has email notifications enabled
      if (input.sendEmail && user.email) {
        const shouldSendEmail = await this.shouldSendEmail(input.userId, input.type);
        
        if (shouldSendEmail) {
          const emailResult = await this.sendNotificationEmail(
            user.email,
            user.full_name || 'User',
            input.type,
            input.title,
            input.body,
            input.data
          );

          // Mark as sent via email if successful
          if (emailResult.success) {
            await supabase
              .from('notification_queue')
              .update({ sent_via_email: true })
              .eq('id', notification.id);
          }
        }
      }

      // Requirement 3.2: Broadcast notification to user's active sessions via Realtime
      // This is non-blocking - we don't wait for the broadcast to complete
      this.broadcastNotificationToUser(input.userId, notification.id).catch((error) => {
        console.error('Error broadcasting notification:', error);
      });

      return {
        success: true,
        notificationId: notification.id,
      };
    } catch (error) {
      // Requirement 15.2: Log error without throwing exception
      console.error('Unexpected error in createNotification:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        errorCode: 'UNKNOWN',
      };
    }
  }

  /**
   * Gets notifications for a user with filtering and pagination
   * 
   * Requirements:
   * - 1.2: Display notifications with filtering
   * 
   * @param userId - The user ID
   * @param options - Filtering and pagination options
   * @returns Array of notifications
   */
  static async getNotifications(
    userId: string,
    options: GetNotificationsOptions = {}
  ): Promise<Notification[]> {
    try {
      const supabase = await createClient();

      const {
        unreadOnly = false,
        limit = 50,
        offset = 0,
        type,
      } = options;

      let query = supabase
        .from('notification_queue')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (unreadOnly) {
        query = query.eq('read', false);
      }

      if (type) {
        query = query.eq('type', type);
      }

      const { data: notifications, error } = await query;

      if (error) {
        console.error('Error fetching notifications:', error);
        return [];
      }

      return notifications ? notifications.map(this.mapNotification) : [];
    } catch (error) {
      console.error('Unexpected error in getNotifications:', error);
      return [];
    }
  }

  /**
   * Marks a notification as read
   * 
   * Requirements:
   * - 1.4: Mark notification as read
   * - 13.1: Record read timestamp
   * 
   * @param notificationId - The notification ID
   * @returns Success boolean
   */
  static async markAsRead(notificationId: string): Promise<boolean> {
    try {
      const supabase = await createClient();

      // Requirement 13.1: Update read flag and record timestamp
      const { error } = await supabase
        .from('notification_queue')
        .update({ 
          read: true, 
          read_at: new Date().toISOString() 
        })
        .eq('id', notificationId);

      if (error) {
        console.error('Error marking notification as read:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Unexpected error in markAsRead:', error);
      return false;
    }
  }

  /**
   * Marks all notifications as read for a user
   * 
   * Requirements:
   * - 13.2: Mark all unread notifications as read
   * 
   * @param userId - The user ID
   * @returns Success boolean
   */
  static async markAllAsRead(userId: string): Promise<boolean> {
    try {
      const supabase = await createClient();

      // Requirement 13.2: Update all unread notifications
      const { error } = await supabase
        .from('notification_queue')
        .update({ 
          read: true, 
          read_at: new Date().toISOString() 
        })
        .eq('user_id', userId)
        .eq('read', false);

      if (error) {
        console.error('Error marking all notifications as read:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Unexpected error in markAllAsRead:', error);
      return false;
    }
  }

  /**
   * Gets unread notification count for a user
   * 
   * Requirements:
   * - 1.2: Display unread notification count
   * 
   * @param userId - The user ID
   * @returns Unread count
   */
  static async getUnreadCount(userId: string): Promise<number> {
    try {
      const supabase = await createClient();

      const { count, error } = await supabase
        .from('notification_queue')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('read', false);

      if (error) {
        console.error('Error getting unread count:', error);
        return 0;
      }

      return count || 0;
    } catch (error) {
      console.error('Unexpected error in getUnreadCount:', error);
      return 0;
    }
  }

  /**
   * Deletes a notification with ownership verification
   * 
   * Requirements:
   * - 20.1: Delete notification from database
   * - 20.3: Verify user owns the notification
   * 
   * @param notificationId - The notification ID
   * @param userId - The user ID (for ownership verification)
   * @returns Success boolean
   */
  static async deleteNotification(notificationId: string, userId: string): Promise<boolean> {
    try {
      const supabase = await createClient();

      // Requirement 20.3: Verify ownership before deletion
      const { data: notification, error: fetchError } = await supabase
        .from('notification_queue')
        .select('user_id')
        .eq('id', notificationId)
        .single();

      if (fetchError || !notification) {
        console.error('Error fetching notification for deletion:', fetchError);
        return false;
      }

      if (notification.user_id !== userId) {
        console.error('User does not own this notification');
        return false;
      }

      // Requirement 20.1: Delete the notification
      const { error: deleteError } = await supabase
        .from('notification_queue')
        .delete()
        .eq('id', notificationId)
        .eq('user_id', userId); // Double-check ownership in delete query

      if (deleteError) {
        console.error('Error deleting notification:', deleteError);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Unexpected error in deleteNotification:', error);
      return false;
    }
  }

  /**
   * Checks if a notification should be sent based on user preferences
   * 
   * Requirements:
   * - 4.3: Respect user preferences for notification types
   * - 4.5: Critical notifications bypass preferences
   * 
   * @param userId - The user ID
   * @param type - The notification type
   * @returns Whether notification should be sent
   */
  static async shouldSendNotification(
    userId: string,
    type: NotificationType
  ): Promise<boolean> {
    try {
      // Requirement 4.5: Critical notifications always sent
      if (CRITICAL_NOTIFICATION_TYPES.includes(type)) {
        return true;
      }

      const supabase = await createClient();

      // Get user preferences
      const { data: preferences, error } = await supabase
        .from('user_notification_preferences')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error || !preferences) {
        // If no preferences found, default to sending
        return true;
      }

      // Map notification type to preference field
      const preferenceField = NOTIFICATION_PREFERENCE_MAP[type];
      if (!preferenceField) {
        // Unknown type, default to sending
        return true;
      }

      // Requirement 4.3: Check specific preference
      return preferences[preferenceField] !== false;
    } catch (error) {
      console.error('Error checking notification preferences:', error);
      // Default to sending on error
      return true;
    }
  }

  /**
   * Checks if an email should be sent based on user preferences
   * 
   * Requirements:
   * - 2.4: Respect email notification preferences
   * - 4.4: Global email preference override
   * 
   * @param userId - The user ID
   * @param type - The notification type
   * @returns Whether email should be sent
   */
  private static async shouldSendEmail(
    userId: string,
    type: NotificationType
  ): Promise<boolean> {
    try {
      // Critical notifications always sent via email
      if (CRITICAL_NOTIFICATION_TYPES.includes(type)) {
        return true;
      }

      const supabase = await createClient();

      // Get user preferences
      const { data: preferences, error } = await supabase
        .from('user_notification_preferences')
        .select('email_notifications')
        .eq('user_id', userId)
        .single();

      if (error || !preferences) {
        // Default to sending if preferences not found
        return true;
      }

      // Requirement 4.4: Global email preference override
      return preferences.email_notifications !== false;
    } catch (error) {
      console.error('Error checking email preferences:', error);
      // Default to sending on error
      return true;
    }
  }

  /**
   * Validates notification input
   * 
   * Requirements:
   * - 15.3: Validate required fields and data types
   * 
   * @param input - The notification input
   * @returns Error message if invalid, null if valid
   */
  private static validateInput(input: CreateNotificationInput): string | null {
    // Check required fields
    if (!input.userId || typeof input.userId !== 'string') {
      return 'userId is required and must be a string';
    }

    if (!input.type || typeof input.type !== 'string') {
      return 'type is required and must be a string';
    }

    if (!input.title || typeof input.title !== 'string') {
      return 'title is required and must be a string';
    }

    // Validate title length
    if (input.title.length === 0 || input.title.length > 500) {
      return 'title must be between 1 and 500 characters';
    }

    // Validate body length if provided
    if (input.body && input.body.length > 2000) {
      return 'body must not exceed 2000 characters';
    }

    // Validate data is an object if provided
    if (input.data && typeof input.data !== 'object') {
      return 'data must be an object';
    }

    return null;
  }

  /**
   * Maps database notification to Notification interface
   * 
   * @private
   */
  private static mapNotification(notification: any): Notification {
    return {
      id: notification.id,
      userId: notification.user_id,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      data: notification.data || {},
      read: notification.read,
      readAt: notification.read_at ? new Date(notification.read_at) : undefined,
      sentViaEmail: notification.sent_via_email,
      legalHold: notification.legal_hold || false,
      createdAt: new Date(notification.created_at),
      updatedAt: new Date(notification.updated_at),
    };
  }

  /**
   * Sends notification email based on notification type
   * 
   * Requirements:
   * - 2.2: Use templates following BidSync design system
   * - 18.1-18.5: BidSync design system compliance
   * 
   * @private
   */
  private static async sendNotificationEmail(
    email: string,
    userName: string,
    type: NotificationType,
    title: string,
    body?: string,
    data?: any
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { getNotificationEmail } = await import('@/lib/email/notification-templates');
      
      // Generate action URL based on notification type and data
      const actionUrl = this.generateActionUrl(type, data);
      const actionText = this.generateActionText(type);

      const { subject, html, text } = getNotificationEmail(type, {
        userName,
        title,
        body,
        data,
        actionUrl,
        actionText,
      });

      // Dynamic import to avoid bundling nodemailer in client
      const { sendEmail } = await import('@/lib/email/service');
      
      return await sendEmail({
        to: email,
        subject,
        html,
        text,
        priority: this.getEmailPriority(type),
      });
    } catch (error) {
      console.error('Error sending notification email:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Generates action URL based on notification type and data
   * 
   * @private
   */
  private static generateActionUrl(type: NotificationType, data?: any): string {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://bidsync.com';

    if (!data) {
      return baseUrl;
    }

    switch (type) {
      case 'proposal_submitted':
      case 'proposal_scored':
      case 'proposal_score_updated':
      case 'proposal_accepted':
      case 'proposal_rejected':
        return data.proposalId ? `${baseUrl}/proposals/${data.proposalId}` : baseUrl;

      case 'project_created':
      case 'project_approved':
      case 'project_rejected':
      case 'project_awarded':
      case 'project_completed':
      case 'project_deadline_approaching':
        return data.projectId ? `${baseUrl}/projects/${data.projectId}` : baseUrl;

      case 'section_assigned':
      case 'section_reassigned':
      case 'section_completed':
      case 'section_deadline_approaching':
        return data.documentId ? `${baseUrl}/editor/${data.documentId}` : baseUrl;

      case 'ready_for_delivery':
      case 'completion_accepted':
      case 'revision_requested':
        return data.projectId ? `${baseUrl}/projects/${data.projectId}/completion` : baseUrl;

      default:
        return baseUrl;
    }
  }

  /**
   * Generates action button text based on notification type
   * 
   * @private
   */
  private static generateActionText(type: NotificationType): string {
    switch (type) {
      case 'proposal_submitted':
      case 'proposal_scored':
      case 'proposal_score_updated':
      case 'proposal_accepted':
      case 'proposal_rejected':
        return 'View Proposal';

      case 'project_created':
      case 'project_approved':
      case 'project_rejected':
      case 'project_awarded':
      case 'project_completed':
      case 'project_deadline_approaching':
        return 'View Project';

      case 'section_assigned':
      case 'section_reassigned':
      case 'section_completed':
      case 'section_deadline_approaching':
        return 'View Document';

      case 'ready_for_delivery':
      case 'completion_accepted':
      case 'revision_requested':
        return 'View Deliverables';

      case 'team_member_joined':
      case 'team_member_removed':
        return 'View Team';

      default:
        return 'View Details';
    }
  }

  /**
   * Determines email priority based on notification type
   * 
   * Requirements:
   * - 2.1: High-priority email delivery
   * 
   * @private
   */
  private static getEmailPriority(type: NotificationType): 'immediate' | 'batched' | 'digest' {
    // Critical notifications sent immediately
    if (CRITICAL_NOTIFICATION_TYPES.includes(type)) {
      return 'immediate';
    }

    // High-priority notifications sent immediately
    const highPriorityTypes: NotificationType[] = [
      'proposal_accepted',
      'proposal_rejected',
      'project_awarded',
      'ready_for_delivery',
      'completion_accepted',
      'revision_requested',
      'project_deadline_approaching',
      'section_deadline_approaching',
    ];

    if (highPriorityTypes.includes(type)) {
      return 'immediate';
    }

    // Everything else can be batched
    return 'batched';
  }

  /**
   * Broadcasts notification to user's active sessions via Realtime
   * 
   * Requirements:
   * - 3.2: Push new notifications to active sessions immediately
   * 
   * @private
   */
  private static async broadcastNotificationToUser(
    userId: string,
    notificationId: string
  ): Promise<void> {
    try {
      // Dynamically import to avoid circular dependencies and ensure client-side only
      if (typeof window === 'undefined') {
        // Server-side - skip realtime broadcast
        // Realtime will be handled by database triggers or client-side subscriptions
        return;
      }

      const { realtimeNotificationService } = await import('@/lib/realtime-notification-service');
      
      // Check if user is subscribed
      if (!realtimeNotificationService.isSubscribed(userId)) {
        // User not subscribed - they'll get the notification when they next load the app
        return;
      }

      // Fetch the full notification to broadcast
      const supabase = await createClient();
      const { data: notification, error } = await supabase
        .from('notification_queue')
        .select('*')
        .eq('id', notificationId)
        .single();

      if (error || !notification) {
        console.error('Error fetching notification for broadcast:', error);
        return;
      }

      // Broadcast to user's active sessions
      await realtimeNotificationService.broadcastNewNotification(
        userId,
        this.mapNotification(notification)
      );
    } catch (error) {
      // Log error but don't throw - broadcasting is non-critical
      console.error('Error in broadcastNotificationToUser:', error);
    }
  }

  // ============================================================================
  // Document Collaboration Notification Helpers
  // ============================================================================

  /**
   * Notifies a user when a section is assigned to them
   * 
   * Requirements:
   * - 12.1: Notify assigned member when section is assigned
   * - 12.4: Include section title and deadline in notification
   * - 12.5: Send both in-app and email notifications
   * 
   * @param sectionId - The section ID
   * @param assigneeId - The user being assigned
   * @param assignerId - The user making the assignment
   * @param sectionTitle - The section title
   * @param deadline - Optional deadline
   */
  static async notifySectionAssignment(
    sectionId: string,
    assigneeId: string,
    assignerId: string,
    sectionTitle: string,
    deadline?: string
  ): Promise<void> {
    try {
      const supabase = await createClient();

      // Get assigner name
      const { data: assigner } = await supabase
        .from('users')
        .select('full_name')
        .eq('id', assignerId)
        .single();

      const assignerName = assigner?.full_name || 'A team member';

      // Build notification body
      let body = `${assignerName} has assigned you to work on the section "${sectionTitle}".`;
      if (deadline) {
        const deadlineDate = new Date(deadline);
        body += ` Deadline: ${deadlineDate.toLocaleDateString()}`;
      }

      // Requirement 12.1, 12.4, 12.5: Create notification with section details
      await this.createNotification({
        userId: assigneeId,
        type: 'section_assigned',
        title: 'New Section Assignment',
        body,
        data: {
          sectionId,
          sectionTitle,
          assignerId,
          assignerName,
          deadline,
        },
        sendEmail: true, // Requirement 12.5: Send email
        priority: NotificationPriority.MEDIUM,
      });
    } catch (error) {
      // Non-blocking - log error but don't throw
      console.error('Error in notifySectionAssignment:', error);
    }
  }

  /**
   * Notifies users when a section is reassigned
   * 
   * Requirements:
   * - 12.2: Notify both previous and new assignees
   * - 12.4: Include section title and deadline in notification
   * - 12.5: Send both in-app and email notifications
   * 
   * @param sectionId - The section ID
   * @param previousAssigneeId - The previous assignee
   * @param newAssigneeId - The new assignee
   * @param assignerId - The user making the reassignment
   * @param sectionTitle - The section title
   * @param deadline - Optional deadline
   */
  static async notifySectionReassignment(
    sectionId: string,
    previousAssigneeId: string,
    newAssigneeId: string,
    assignerId: string,
    sectionTitle: string,
    deadline?: string
  ): Promise<void> {
    try {
      const supabase = await createClient();

      // Get assigner name
      const { data: assigner } = await supabase
        .from('users')
        .select('full_name')
        .eq('id', assignerId)
        .single();

      const assignerName = assigner?.full_name || 'A team member';

      // Requirement 12.2: Notify previous assignee
      await this.createNotification({
        userId: previousAssigneeId,
        type: 'section_reassigned',
        title: 'Section Reassigned',
        body: `The section "${sectionTitle}" has been reassigned to another team member by ${assignerName}.`,
        data: {
          sectionId,
          sectionTitle,
          assignerId,
          assignerName,
          reassignedFrom: previousAssigneeId,
          reassignedTo: newAssigneeId,
        },
        sendEmail: true, // Requirement 12.5: Send email
        priority: NotificationPriority.MEDIUM,
      });

      // Requirement 12.2: Notify new assignee
      let newAssigneeBody = `${assignerName} has assigned you to work on the section "${sectionTitle}".`;
      if (deadline) {
        const deadlineDate = new Date(deadline);
        newAssigneeBody += ` Deadline: ${deadlineDate.toLocaleDateString()}`;
      }

      await this.createNotification({
        userId: newAssigneeId,
        type: 'section_reassigned',
        title: 'New Section Assignment',
        body: newAssigneeBody,
        data: {
          sectionId,
          sectionTitle,
          assignerId,
          assignerName,
          reassignedFrom: previousAssigneeId,
          reassignedTo: newAssigneeId,
          deadline,
        },
        sendEmail: true, // Requirement 12.5: Send email
        priority: NotificationPriority.MEDIUM,
      });
    } catch (error) {
      // Non-blocking - log error but don't throw
      console.error('Error in notifySectionReassignment:', error);
    }
  }

  /**
   * Notifies the bidding leader when a section is completed
   * 
   * Requirements:
   * - 12.3: Notify bidding leader when section is marked complete
   * - 12.4: Include section title in notification
   * - 12.5: Send both in-app and email notifications
   * 
   * @param leadId - The bidding leader ID
   * @param completerId - The user who completed the section
   * @param sectionId - The section ID
   * @param sectionTitle - The section title
   */
  static async notifySectionCompleted(
    leadId: string,
    completerId: string,
    sectionId: string,
    sectionTitle: string
  ): Promise<void> {
    try {
      const supabase = await createClient();

      // Get completer name
      const { data: completer } = await supabase
        .from('users')
        .select('full_name')
        .eq('id', completerId)
        .single();

      const completerName = completer?.full_name || 'A team member';

      // Requirement 12.3, 12.4, 12.5: Notify lead with section details
      await this.createNotification({
        userId: leadId,
        type: 'section_completed',
        title: 'Section Completed',
        body: `${completerName} has marked the section "${sectionTitle}" as complete.`,
        data: {
          sectionId,
          sectionTitle,
          completerId,
          completerName,
        },
        sendEmail: true, // Requirement 12.5: Send email
        priority: NotificationPriority.MEDIUM,
      });
    } catch (error) {
      // Non-blocking - log error but don't throw
      console.error('Error in notifySectionCompleted:', error);
    }
  }
}
