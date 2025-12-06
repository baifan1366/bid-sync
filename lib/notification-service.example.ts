/**
 * Notification Service Usage Examples
 * 
 * This file demonstrates how to use the NotificationService
 * in various scenarios within the bidding leader management system.
 */

import { NotificationService } from './notification-service';
import { SectionManagementService } from './section-management-service';

/**
 * Example 1: Automatic Notifications via Section Assignment
 * 
 * When you assign a section using SectionManagementService,
 * notifications are automatically sent to the assignee.
 */
export async function exampleAutoAssignmentNotification() {
  // Assign a section - notification sent automatically
  const result = await SectionManagementService.assignSection(
    'section-123',
    'user-456',
    '2024-12-31T23:59:59Z'
  );

  if (result.success) {
    console.log('Section assigned successfully');
    console.log('Assignee received:');
    console.log('- In-app notification');
    console.log('- Email notification with section details');
  }
}

/**
 * Example 2: Automatic Notifications via Section Reassignment
 * 
 * When you reassign a section, both the previous and new assignees
 * are automatically notified.
 */
export async function exampleAutoReassignmentNotification() {
  // First assignment
  await SectionManagementService.assignSection(
    'section-123',
    'user-old',
    '2024-12-31T23:59:59Z'
  );

  // Reassignment - dual notifications sent automatically
  const result = await SectionManagementService.assignSection(
    'section-123',
    'user-new',
    '2024-12-31T23:59:59Z'
  );

  if (result.success) {
    console.log('Section reassigned successfully');
    console.log('Previous assignee received notification about reassignment');
    console.log('New assignee received notification about assignment');
  }
}

/**
 * Example 3: Automatic Notifications via Section Completion
 * 
 * When a section status is updated to 'completed',
 * the team lead is automatically notified.
 */
export async function exampleAutoCompletionNotification() {
  // Update section status to completed
  const result = await SectionManagementService.updateSection(
    'section-123',
    { status: 'completed' }
  );

  if (result.success) {
    console.log('Section marked as completed');
    console.log('Team lead received:');
    console.log('- In-app notification');
    console.log('- Email notification with completer name');
  }
}

/**
 * Example 4: Manual Notification for Team Member Joining
 * 
 * When a team member joins, manually notify the lead.
 * Note: This method is not yet implemented in NotificationService
 */
export async function exampleTeamMemberJoinedNotification() {
  // const result = await NotificationService.notifyTeamMemberJoined(
  //   'lead-123',      // Lead user ID
  //   'member-456',    // New member user ID
  //   'project-789'    // Project ID
  // );

  // if (result.success) {
  //   console.log('Lead notified of new team member');
  //   console.log(`Notification ID: ${result.notificationId}`);
  // }
  console.log('Team member joined notification - method not yet implemented');
}

/**
 * Example 5: Manual Notification for Message Received
 * 
 * When a client sends a message, notify the lead.
 * Note: This method is not yet implemented in NotificationService
 */
export async function exampleMessageReceivedNotification() {
  // const result = await NotificationService.notifyMessageReceived(
  //   'lead-123',                           // Recipient (lead)
  //   'client-456',                         // Sender (client)
  //   'Hello, I have a question about...', // Message preview
  //   'project-789'                         // Project ID
  // );

  // if (result.success) {
  //   console.log('Lead notified of new message');
  //   console.log('Notification includes message preview');
  // }
  console.log('Message received notification - method not yet implemented');
}

/**
 * Example 6: Manual Notification for Proposal Status Change
 * 
 * When a proposal status changes, notify the lead.
 * Note: This method is not yet implemented in NotificationService
 */
export async function exampleProposalStatusChangeNotification() {
  // const result = await NotificationService.notifyProposalStatusChanged(
  //   'lead-123',                    // Lead user ID
  //   'proposal-456',                // Proposal ID
  //   'Website Redesign Proposal',   // Proposal title
  //   'approved',                    // New status
  //   'Great work! We love your approach.' // Optional feedback
  // );

  // if (result.success) {
  //   console.log('Lead notified of proposal status change');
  //   console.log('Notification includes status and feedback');
  // }
  console.log('Proposal status change notification - method not yet implemented');
}

/**
 * Example 7: Get User Notifications
 * 
 * Fetch notifications for display in the UI.
 */
export async function exampleGetNotifications() {
  // Get all notifications (up to 50)
  const allNotifications = await NotificationService.getNotifications('user-123');
  console.log(`Total notifications: ${allNotifications.length}`);

  // Get only unread notifications
  const unreadNotifications = await NotificationService.getNotifications(
    'user-123',
    { unreadOnly: true, limit: 20 }
  );
  console.log(`Unread notifications: ${unreadNotifications.length}`);

  // Get unread count for badge
  const unreadCount = await NotificationService.getUnreadCount('user-123');
  console.log(`Unread count: ${unreadCount}`);
}

/**
 * Example 8: Mark Notifications as Read
 * 
 * Update notification read status.
 */
export async function exampleMarkNotificationsRead() {
  // Mark single notification as read
  const success = await NotificationService.markAsRead('notification-123');
  console.log(`Marked as read: ${success}`);

  // Mark all notifications as read
  const allSuccess = await NotificationService.markAllAsRead('user-123');
  console.log(`Marked all as read: ${allSuccess}`);
}

/**
 * Example 9: Custom Notification
 * 
 * Create a custom notification for special cases.
 */
export async function exampleCustomNotification() {
  const result = await NotificationService.createNotification({
    userId: 'user-123',
    type: 'deliverable_uploaded',
    title: 'New Deliverable Uploaded',
    body: 'A team member uploaded "Budget Breakdown.xlsx"',
    data: {
      documentId: 'doc-456',
      fileName: 'Budget Breakdown.xlsx',
      uploadedBy: 'user-789',
    },
    sendEmail: true,
  });

  if (result.success) {
    console.log('Custom notification created');
    console.log(`Notification ID: ${result.notificationId}`);
  }
}

/**
 * Example 10: Error Handling
 * 
 * Handle notification errors gracefully.
 */
export async function exampleErrorHandling() {
  const result = await NotificationService.createNotification({
    userId: 'invalid-user-id',
    type: 'section_assigned',
    title: 'Test Notification',
    sendEmail: false,
  });

  if (!result.success) {
    console.error(`Notification failed: ${result.error}`);
    console.error(`Error code: ${result.errorCode}`);
    
    // Handle specific error codes
    switch (result.errorCode) {
      case 'INVALID_USER':
        console.log('User not found - skip notification');
        break;
      case 'EMAIL_ERROR':
        console.log('Email failed but in-app notification created');
        break;
      default:
        console.log('Unknown error - log for investigation');
    }
  }
}

/**
 * Example 11: Notification Data Structure
 * 
 * Understanding the notification object structure.
 */
export async function exampleNotificationStructure() {
  const notifications = await NotificationService.getNotifications('user-123', { limit: 1 });
  
  if (notifications.length > 0) {
    const notification = notifications[0];
    
    console.log('Notification Structure:');
    console.log({
      id: notification.id,                    // Unique notification ID
      userId: notification.userId,            // Recipient user ID
      type: notification.type,                // Notification type
      title: notification.title,              // Notification title
      body: notification.body,                // Notification body (optional)
      data: notification.data,                // Additional data (optional)
      read: notification.read,                // Read status
      sentViaEmail: notification.sentViaEmail, // Email delivery status
      createdAt: notification.createdAt,      // Creation timestamp
      readAt: notification.readAt,            // Read timestamp (optional)
    });
  }
}

/**
 * Example 12: Integration with UI Components
 * 
 * How to use notifications in React components.
 */
export const exampleReactIntegration = `
import { NotificationService } from '@/lib/notification-service';
import { useEffect, useState } from 'react';

export function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    // Fetch unread count
    NotificationService.getUnreadCount(userId).then(setUnreadCount);
    
    // Fetch recent notifications
    NotificationService.getNotifications(userId, { limit: 10 }).then(setNotifications);
  }, [userId]);

  const handleMarkAsRead = async (notificationId: string) => {
    await NotificationService.markAsRead(notificationId);
    // Refresh notifications
    const updated = await NotificationService.getNotifications(userId, { limit: 10 });
    setNotifications(updated);
    const count = await NotificationService.getUnreadCount(userId);
    setUnreadCount(count);
  };

  return (
    <div>
      <button>
        🔔 {unreadCount > 0 && <span>{unreadCount}</span>}
      </button>
      <div>
        {notifications.map(notification => (
          <div key={notification.id} onClick={() => handleMarkAsRead(notification.id)}>
            <h4>{notification.title}</h4>
            <p>{notification.body}</p>
            <small>{new Date(notification.createdAt).toLocaleString()}</small>
          </div>
        ))}
      </div>
    </div>
  );
}
`;

/**
 * Example 13: Real-time Notification Updates
 * 
 * How to set up real-time notification updates using Supabase subscriptions.
 */
export const exampleRealtimeIntegration = `
import { createClient } from '@/lib/supabase/client';
import { useEffect, useState } from 'react';

export function useRealtimeNotifications(userId: string) {
  const [notifications, setNotifications] = useState([]);
  const supabase = createClient();

  useEffect(() => {
    // Subscribe to new notifications
    const channel = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notification_queue',
          filter: \`user_id=eq.\${userId}\`,
        },
        (payload) => {
          // Add new notification to state
          setNotifications(prev => [payload.new, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return notifications;
}
`;
