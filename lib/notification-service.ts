/**
 * Notification Service
 * 
 * Handles notification creation and delivery for bidding leader management features.
 * Supports both in-app notifications and email delivery.
 * 
 * Implements requirements 6.3, 6.4, 18.1, 18.2, 18.4, 18.5
 * from the bidding-leader-management spec.
 */

import { createClient } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/email/service';

export type NotificationType =
  | 'team_member_joined'
  | 'section_assigned'
  | 'section_reassigned'
  | 'section_completed'
  | 'deadline_approaching'
  | 'deadline_missed'
  | 'message_received'
  | 'proposal_submitted'
  | 'proposal_status_changed'
  | 'qa_answer_posted'
  | 'document_uploaded'
  | 'invitation_created'
  | 'member_removed';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  data?: any;
  read: boolean;
  sentViaEmail: boolean;
  createdAt: string;
  readAt?: string;
}

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  data?: any;
  sendEmail?: boolean;
}

export interface NotificationResult {
  success: boolean;
  notificationId?: string;
  error?: string;
  errorCode?: 'INVALID_USER' | 'INVALID_TYPE' | 'EMAIL_FAILED' | 'UNKNOWN';
}

/**
 * NotificationService class for managing notifications
 */
export class NotificationService {
  /**
   * Creates a notification for a user
   * 
   * Requirements:
   * - 18.1: Notify when team member joins
   * - 18.2: Notify when section is completed
   * - 18.4: Notify when client sends a message
   * - 18.5: Notify when proposal status changes
   * 
   * @param input - Notification creation data
   * @returns NotificationResult with created notification ID
   */
  static async createNotification(input: CreateNotificationInput): Promise<NotificationResult> {
    try {
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

      // Create in-app notification
      const { data: notification, error: notificationError } = await supabase
        .from('notification_queue')
        .insert({
          user_id: input.userId,
          type: input.type,
          title: input.title,
          body: input.body,
          data: input.data,
        })
        .select('id')
        .single();

      if (notificationError || !notification) {
        console.error('Error creating notification:', notificationError);
        return {
          success: false,
          error: 'Failed to create notification',
          errorCode: 'UNKNOWN',
        };
      }

      // Send email if requested
      if (input.sendEmail && user.email) {
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

      return {
        success: true,
        notificationId: notification.id,
      };
    } catch (error) {
      console.error('Unexpected error in createNotification:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        errorCode: 'UNKNOWN',
      };
    }
  }

  /**
   * Creates a notification for section assignment
   * 
   * Requirements:
   * - 6.3: Notify the assigned member via email and in-app notification
   * 
   * @param sectionId - The section ID
   * @param assignedUserId - The user being assigned
   * @param assignedByUserId - The user making the assignment
   * @param sectionTitle - The section title
   * @param deadline - Optional deadline
   * @returns NotificationResult
   */
  static async notifySectionAssignment(
    sectionId: string,
    assignedUserId: string,
    assignedByUserId: string,
    sectionTitle: string,
    deadline?: string
  ): Promise<NotificationResult> {
    try {
      const supabase = await createClient();

      // Get assigner name
      const { data: assigner } = await supabase
        .from('users')
        .select('full_name')
        .eq('id', assignedByUserId)
        .single();

      const assignerName = assigner?.full_name || 'Team Lead';

      const title = `New Section Assigned: ${sectionTitle}`;
      const body = deadline
        ? `${assignerName} assigned you to "${sectionTitle}". Deadline: ${new Date(deadline).toLocaleDateString()}`
        : `${assignerName} assigned you to "${sectionTitle}".`;

      return await this.createNotification({
        userId: assignedUserId,
        type: 'section_assigned',
        title,
        body,
        data: {
          sectionId,
          sectionTitle,
          assignedBy: assignedByUserId,
          assignerName,
          deadline,
        },
        sendEmail: true,
      });
    } catch (error) {
      console.error('Error in notifySectionAssignment:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        errorCode: 'UNKNOWN',
      };
    }
  }

  /**
   * Creates notifications for section reassignment
   * 
   * Requirements:
   * - 6.4: Update the assignment and notify both the previous and new assignees
   * 
   * @param sectionId - The section ID
   * @param previousUserId - The previous assignee
   * @param newUserId - The new assignee
   * @param reassignedByUserId - The user making the reassignment
   * @param sectionTitle - The section title
   * @param deadline - Optional deadline
   * @returns Array of NotificationResults
   */
  static async notifySectionReassignment(
    sectionId: string,
    previousUserId: string,
    newUserId: string,
    reassignedByUserId: string,
    sectionTitle: string,
    deadline?: string
  ): Promise<NotificationResult[]> {
    try {
      const supabase = await createClient();

      // Get reassigner name
      const { data: reassigner } = await supabase
        .from('users')
        .select('full_name')
        .eq('id', reassignedByUserId)
        .single();

      const reassignerName = reassigner?.full_name || 'Team Lead';

      // Notify previous assignee
      const previousNotification = await this.createNotification({
        userId: previousUserId,
        type: 'section_reassigned',
        title: `Section Reassigned: ${sectionTitle}`,
        body: `${reassignerName} reassigned "${sectionTitle}" to another team member.`,
        data: {
          sectionId,
          sectionTitle,
          reassignedBy: reassignedByUserId,
          reassignerName,
          newAssignee: newUserId,
        },
        sendEmail: true,
      });

      // Notify new assignee
      const newNotification = await this.createNotification({
        userId: newUserId,
        type: 'section_assigned',
        title: `New Section Assigned: ${sectionTitle}`,
        body: deadline
          ? `${reassignerName} assigned you to "${sectionTitle}". Deadline: ${new Date(deadline).toLocaleDateString()}`
          : `${reassignerName} assigned you to "${sectionTitle}".`,
        data: {
          sectionId,
          sectionTitle,
          assignedBy: reassignedByUserId,
          assignerName: reassignerName,
          deadline,
          previousAssignee: previousUserId,
        },
        sendEmail: true,
      });

      return [previousNotification, newNotification];
    } catch (error) {
      console.error('Error in notifySectionReassignment:', error);
      return [
        {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error occurred',
          errorCode: 'UNKNOWN',
        },
      ];
    }
  }

  /**
   * Creates a notification for team member joining
   * 
   * Requirements:
   * - 18.1: Notify the Bidding Lead via email and in-app notification when a team member joins
   * 
   * @param leadUserId - The lead user ID
   * @param newMemberUserId - The new member user ID
   * @param projectId - The project ID
   * @returns NotificationResult
   */
  static async notifyTeamMemberJoined(
    leadUserId: string,
    newMemberUserId: string,
    projectId: string
  ): Promise<NotificationResult> {
    try {
      const supabase = await createClient();

      // Get new member name and project title
      const [memberResult, projectResult] = await Promise.all([
        supabase.from('users').select('full_name').eq('id', newMemberUserId).single(),
        supabase.from('projects').select('title').eq('id', projectId).single(),
      ]);

      const memberName = memberResult.data?.full_name || 'A team member';
      const projectTitle = projectResult.data?.title || 'your project';

      return await this.createNotification({
        userId: leadUserId,
        type: 'team_member_joined',
        title: 'New Team Member Joined',
        body: `${memberName} joined your team for "${projectTitle}".`,
        data: {
          newMemberId: newMemberUserId,
          memberName,
          projectId,
          projectTitle,
        },
        sendEmail: true,
      });
    } catch (error) {
      console.error('Error in notifyTeamMemberJoined:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        errorCode: 'UNKNOWN',
      };
    }
  }

  /**
   * Creates a notification for section completion
   * 
   * Requirements:
   * - 18.2: Notify the Bidding Lead when a section is completed
   * 
   * @param leadUserId - The lead user ID
   * @param completedByUserId - The user who completed the section
   * @param sectionId - The section ID
   * @param sectionTitle - The section title
   * @returns NotificationResult
   */
  static async notifySectionCompleted(
    leadUserId: string,
    completedByUserId: string,
    sectionId: string,
    sectionTitle: string
  ): Promise<NotificationResult> {
    try {
      const supabase = await createClient();

      // Get completer name
      const { data: completer } = await supabase
        .from('users')
        .select('full_name')
        .eq('id', completedByUserId)
        .single();

      const completerName = completer?.full_name || 'A team member';

      return await this.createNotification({
        userId: leadUserId,
        type: 'section_completed',
        title: `Section Completed: ${sectionTitle}`,
        body: `${completerName} completed "${sectionTitle}".`,
        data: {
          sectionId,
          sectionTitle,
          completedBy: completedByUserId,
          completerName,
        },
        sendEmail: true,
      });
    } catch (error) {
      console.error('Error in notifySectionCompleted:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        errorCode: 'UNKNOWN',
      };
    }
  }

  /**
   * Creates a notification for message received
   * 
   * Requirements:
   * - 18.4: Notify the Bidding Lead immediately when a client sends a message
   * 
   * @param recipientUserId - The recipient user ID
   * @param senderUserId - The sender user ID
   * @param messagePreview - Preview of the message
   * @param projectId - The project ID
   * @returns NotificationResult
   */
  static async notifyMessageReceived(
    recipientUserId: string,
    senderUserId: string,
    messagePreview: string,
    projectId: string
  ): Promise<NotificationResult> {
    try {
      const supabase = await createClient();

      // Get sender name and project title
      const [senderResult, projectResult] = await Promise.all([
        supabase.from('users').select('full_name').eq('id', senderUserId).single(),
        supabase.from('projects').select('title').eq('id', projectId).single(),
      ]);

      const senderName = senderResult.data?.full_name || 'Someone';
      const projectTitle = projectResult.data?.title || 'a project';

      return await this.createNotification({
        userId: recipientUserId,
        type: 'message_received',
        title: `New Message from ${senderName}`,
        body: `${senderName} sent you a message about "${projectTitle}": ${messagePreview.substring(0, 100)}${messagePreview.length > 100 ? '...' : ''}`,
        data: {
          senderId: senderUserId,
          senderName,
          projectId,
          projectTitle,
          messagePreview,
        },
        sendEmail: true,
      });
    } catch (error) {
      console.error('Error in notifyMessageReceived:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        errorCode: 'UNKNOWN',
      };
    }
  }

  /**
   * Creates a notification for proposal status change
   * 
   * Requirements:
   * - 18.5: Notify the Bidding Lead with the new status and any feedback when proposal status changes
   * 
   * @param leadUserId - The lead user ID
   * @param proposalId - The proposal ID
   * @param proposalTitle - The proposal title
   * @param newStatus - The new status
   * @param feedback - Optional feedback
   * @returns NotificationResult
   */
  static async notifyProposalStatusChanged(
    leadUserId: string,
    proposalId: string,
    proposalTitle: string,
    newStatus: string,
    feedback?: string
  ): Promise<NotificationResult> {
    try {
      const statusMessages: Record<string, string> = {
        submitted: 'Your proposal has been submitted successfully.',
        reviewing: 'Your proposal is now under review.',
        approved: 'Congratulations! Your proposal has been approved.',
        rejected: 'Your proposal was not selected this time.',
      };

      const title = `Proposal Status Update: ${proposalTitle}`;
      const body = feedback
        ? `${statusMessages[newStatus] || `Status changed to ${newStatus}.`} Feedback: ${feedback}`
        : statusMessages[newStatus] || `Status changed to ${newStatus}.`;

      return await this.createNotification({
        userId: leadUserId,
        type: 'proposal_status_changed',
        title,
        body,
        data: {
          proposalId,
          proposalTitle,
          newStatus,
          feedback,
        },
        sendEmail: true,
      });
    } catch (error) {
      console.error('Error in notifyProposalStatusChanged:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        errorCode: 'UNKNOWN',
      };
    }
  }

  /**
   * Gets notifications for a user
   * 
   * @param userId - The user ID
   * @param unreadOnly - Whether to fetch only unread notifications
   * @param limit - Maximum number of notifications to fetch
   * @returns Array of notifications
   */
  static async getNotifications(
    userId: string,
    unreadOnly: boolean = false,
    limit: number = 50
  ): Promise<Notification[]> {
    try {
      const supabase = await createClient();

      let query = supabase
        .from('notification_queue')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (unreadOnly) {
        query = query.eq('read', false);
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
   * @param notificationId - The notification ID
   * @returns Success boolean
   */
  static async markAsRead(notificationId: string): Promise<boolean> {
    try {
      const supabase = await createClient();

      const { error } = await supabase
        .from('notification_queue')
        .update({ read: true, read_at: new Date().toISOString() })
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
   * @param userId - The user ID
   * @returns Success boolean
   */
  static async markAllAsRead(userId: string): Promise<boolean> {
    try {
      const supabase = await createClient();

      const { error } = await supabase
        .from('notification_queue')
        .update({ read: true, read_at: new Date().toISOString() })
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
   * Sends notification email based on notification type
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
      const { subject, html, text } = this.generateEmailContent(
        userName,
        type,
        title,
        body,
        data
      );

      return await sendEmail({
        to: email,
        subject,
        html,
        text,
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
   * Generates email content based on notification type
   * 
   * @private
   */
  private static generateEmailContent(
    userName: string,
    type: NotificationType,
    title: string,
    body?: string,
    data?: any
  ): { subject: string; html: string; text: string } {
    const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://your-domain.com';
    
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background-color: #ffffff;
      color: #000000;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      padding: 40px 20px;
    }
    .header {
      text-align: center;
      margin-bottom: 40px;
    }
    .logo {
      display: inline-block;
      background-color: #FBBF24;
      color: #000000;
      padding: 12px 24px;
      font-size: 24px;
      font-weight: bold;
      border-radius: 8px;
      text-decoration: none;
    }
    .content {
      background-color: #ffffff;
      border: 2px solid rgba(251, 191, 36, 0.2);
      border-radius: 12px;
      padding: 32px;
      margin-bottom: 24px;
    }
    .content h1 {
      color: #000000;
      font-size: 24px;
      margin-top: 0;
      margin-bottom: 16px;
    }
    .content p {
      color: #374151;
      font-size: 16px;
      line-height: 1.6;
      margin-bottom: 16px;
    }
    .button {
      display: inline-block;
      background-color: #FBBF24;
      color: #000000;
      padding: 12px 32px;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      margin: 16px 0;
    }
    .info-box {
      background-color: rgba(251, 191, 36, 0.1);
      border-left: 4px solid #FBBF24;
      padding: 16px;
      margin: 16px 0;
      border-radius: 4px;
    }
    .footer {
      text-align: center;
      color: #6B7280;
      font-size: 14px;
      margin-top: 32px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <span class="logo">BidSync</span>
    </div>
    <div class="content">
      <h1>${title}</h1>
      <p>Hello ${userName},</p>
      ${body ? `<p>${body}</p>` : ''}
      <div style="text-align: center;">
        <a href="${baseUrl}/lead-dashboard" class="button">View Dashboard</a>
      </div>
    </div>
    <div class="footer">
      <p>
        This is an automated message from BidSync.<br>
        If you have any questions, please contact our support team.
      </p>
      <p>
        &copy; ${new Date().getFullYear()} BidSync. All rights reserved.
      </p>
    </div>
  </div>
</body>
</html>
    `.trim();

    const text = `
${title}

Hello ${userName},

${body || ''}

View your dashboard: ${baseUrl}/lead-dashboard

---
This is an automated message from BidSync.
© ${new Date().getFullYear()} BidSync. All rights reserved.
    `.trim();

    return {
      subject: title,
      html,
      text,
    };
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
      data: notification.data,
      read: notification.read,
      sentViaEmail: notification.sent_via_email,
      createdAt: notification.created_at,
      readAt: notification.read_at,
    };
  }
}
