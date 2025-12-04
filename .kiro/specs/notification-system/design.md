# Design Document

## Overview

The BidSync Notification System is a comprehensive multi-channel notification infrastructure that delivers timely, relevant updates to users across the platform. The system integrates seamlessly with existing BidSync services and follows the platform's design system (yellow-black-white color scheme).

The notification system consists of three primary delivery channels:
1. **In-App Notifications**: Real-time notifications displayed within the application interface
2. **Email Notifications**: HTML emails sent to users' registered email addresses
3. **Real-Time Push**: Instant notifications via Supabase Realtime subscriptions

The system is designed to be non-blocking, ensuring that notification failures do not impact core business logic. It provides users with granular control over their notification preferences while ensuring critical notifications (security, account status) are always delivered.

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Business Logic Layer                      │
│  (Projects, Proposals, Teams, Deliverables, etc.)           │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              NotificationService (Core)                      │
│  • Create notifications                                      │
│  • Check user preferences                                    │
│  • Validate input                                            │
│  • Route to channels                                         │
└──────┬──────────────────┬──────────────────┬────────────────┘
       │                  │                  │
       ▼                  ▼                  ▼
┌─────────────┐  ┌─────────────────┐  ┌──────────────────┐
│  Database   │  │  Email Service  │  │  Realtime Push   │
│  (Supabase) │  │  (SMTP/Queue)   │  │  (Supabase RT)   │
└─────────────┘  └─────────────────┘  └──────────────────┘
       │                  │                  │
       ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────┐
│                      User Interface                          │
│  • Notification Bell                                         │
│  • Dropdown List                                             │
│  • Toast Messages                                            │
│  • Browser Notifications                                     │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

1. **Notification Creation**: Business logic triggers notification creation
2. **Preference Check**: System checks user's notification preferences
3. **Validation**: Input is validated for required fields and data types
4. **Database Insert**: Notification record is created in notification_queue
5. **Email Dispatch**: If enabled, email is queued/sent
6. **Realtime Push**: Active users receive instant notification via Supabase Realtime
7. **UI Update**: Frontend updates notification count and displays notification


## Components and Interfaces

### 1. NotificationService

The core service responsible for creating and managing notifications.

```typescript
export class NotificationService {
  // Create a single notification
  static async createNotification(
    input: CreateNotificationInput
  ): Promise<NotificationResult>
  
  // Create multiple notifications in batch
  static async createBulkNotifications(
    inputs: CreateNotificationInput[]
  ): Promise<NotificationResult[]>
  
  // Get notifications for a user
  static async getNotifications(
    userId: string,
    options?: GetNotificationsOptions
  ): Promise<Notification[]>
  
  // Mark notification as read
  static async markAsRead(notificationId: string): Promise<boolean>
  
  // Mark all notifications as read for a user
  static async markAllAsRead(userId: string): Promise<boolean>
  
  // Get unread count for a user
  static async getUnreadCount(userId: string): Promise<number>
  
  // Delete a notification
  static async deleteNotification(notificationId: string): Promise<boolean>
  
  // Check if notification should be sent based on preferences
  static async shouldSendNotification(
    userId: string,
    type: NotificationType
  ): Promise<boolean>
  
  // Clean up old notifications
  static async cleanupOldNotifications(daysOld: number): Promise<number>
}
```

### 2. EmailService

Handles email delivery with queue management and retry logic.

```typescript
export class EmailService {
  // Send a single email
  static async sendEmail(options: EmailOptions): Promise<EmailResult>
  
  // Send multiple emails in batch
  static async sendBulkEmails(emails: EmailOptions[]): Promise<EmailResult[]>
  
  // Get email queue status
  static getEmailQueueStatus(): QueueStatus
  
  // Retry failed emails
  static async retryFailedEmails(): Promise<number>
  
  // Process email queue (called by cron)
  static async processQueue(): Promise<void>
}
```

### 3. RealtimeNotificationService

Manages real-time notification subscriptions via Supabase Realtime.

```typescript
export class RealtimeNotificationService {
  private channel: RealtimeChannel | null = null
  
  // Subscribe to user's notifications
  subscribeToNotifications(
    userId: string,
    callback: (notification: Notification) => void
  ): void
  
  // Unsubscribe from notifications
  unsubscribe(): void
  
  // Check connection status
  isConnected(): boolean
}
```

### 4. NotificationTemplateService

Manages notification templates and content generation.

```typescript
export class NotificationTemplateService {
  // Get notification template for a type
  static getTemplate(
    type: NotificationType,
    data: any
  ): NotificationTemplate
  
  // Get email template for a type
  static getEmailTemplate(
    type: NotificationType,
    data: any
  ): EmailTemplate
  
  // Render template with data
  static renderTemplate(template: string, data: any): string
}
```

### 5. NotificationPreferencesService

Manages user notification preferences.

```typescript
export class NotificationPreferencesService {
  // Get user preferences
  static async getPreferences(
    userId: string
  ): Promise<UserNotificationPreferences>
  
  // Update user preferences
  static async updatePreferences(
    userId: string,
    preferences: Partial<UserNotificationPreferences>
  ): Promise<boolean>
  
  // Reset to defaults
  static async resetToDefaults(userId: string): Promise<boolean>
}
```


## Data Models

### Database Tables

#### notification_queue

Stores all notifications for users.

```sql
CREATE TABLE public.notification_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title TEXT NOT NULL,
    body TEXT,
    data JSONB DEFAULT '{}'::jsonb,
    read BOOLEAN DEFAULT false,
    read_at TIMESTAMPTZ,
    sent_via_email BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_notifications_user ON notification_queue(user_id);
CREATE INDEX idx_notifications_read ON notification_queue(user_id, read);
CREATE INDEX idx_notifications_type ON notification_queue(type);
CREATE INDEX idx_notifications_created ON notification_queue(created_at DESC);
CREATE INDEX idx_notifications_user_read_created 
  ON notification_queue(user_id, read, created_at DESC);
CREATE INDEX idx_notifications_unread 
  ON notification_queue(user_id, created_at DESC) 
  WHERE read = false;
```

#### user_notification_preferences

Stores user notification preferences.

```sql
CREATE TABLE public.user_notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    email_notifications BOOLEAN DEFAULT true,
    project_updates BOOLEAN DEFAULT true,
    new_messages BOOLEAN DEFAULT true,
    proposal_updates BOOLEAN DEFAULT true,
    qa_notifications BOOLEAN DEFAULT true,
    deadline_reminders BOOLEAN DEFAULT true,
    team_notifications BOOLEAN DEFAULT true,
    completion_notifications BOOLEAN DEFAULT true,
    scoring_notifications BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_user_prefs_user ON user_notification_preferences(user_id);
```

### TypeScript Interfaces

```typescript
// Notification Types
export type NotificationType =
  // Project related
  | 'project_created'
  | 'project_approved'
  | 'project_rejected'
  | 'project_status_changed'
  | 'project_deadline_approaching'
  | 'project_awarded'
  | 'project_completed'
  // Proposal related
  | 'proposal_submitted'
  | 'proposal_status_changed'
  | 'proposal_scored'
  | 'proposal_score_updated'
  | 'all_proposals_scored'
  | 'proposal_accepted'
  | 'proposal_rejected'
  | 'proposal_archived'
  // Team related
  | 'team_member_joined'
  | 'team_member_removed'
  | 'team_invitation_created'
  | 'team_invitation_accepted'
  // Delivery related
  | 'deliverable_uploaded'
  | 'ready_for_delivery'
  | 'completion_accepted'
  | 'revision_requested'
  | 'revision_completed'
  // Document collaboration
  | 'document_shared'
  | 'document_comment_added'
  | 'document_version_created'
  | 'document_rollback'
  | 'section_assigned'
  | 'section_reassigned'
  | 'section_completed'
  | 'section_deadline_approaching'
  // Messages and Q&A
  | 'message_received'
  | 'qa_question_posted'
  | 'qa_answer_posted'
  // Admin
  | 'admin_invitation'
  | 'verification_approved'
  | 'verification_rejected'
  | 'account_suspended';

// Notification Priority
export enum NotificationPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

// Notification Interface
export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  data: Record<string, any>;
  read: boolean;
  readAt?: Date;
  sentViaEmail: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Create Notification Input
export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  data?: Record<string, any>;
  sendEmail?: boolean;
  priority?: NotificationPriority;
}

// Notification Result
export interface NotificationResult {
  success: boolean;
  notificationId?: string;
  error?: string;
  errorCode?: 
    | 'INVALID_USER'
    | 'INVALID_TYPE'
    | 'VALIDATION_ERROR'
    | 'DATABASE_ERROR'
    | 'UNKNOWN';
}

// User Notification Preferences
export interface UserNotificationPreferences {
  id: string;
  userId: string;
  emailNotifications: boolean;
  projectUpdates: boolean;
  newMessages: boolean;
  proposalUpdates: boolean;
  qaNotifications: boolean;
  deadlineReminders: boolean;
  teamNotifications: boolean;
  completionNotifications: boolean;
  scoringNotifications: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Email Options
export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text: string;
  priority?: 'immediate' | 'batched' | 'digest';
}

// Email Result
export interface EmailResult {
  success: boolean;
  error?: string;
  messageId?: string;
}
```


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property Reflection

After analyzing all acceptance criteria, several properties were identified as redundant or combinable:
- Properties about "dual-channel delivery" (in-app + email) can be combined into a single property that checks both channels are used for specific event types
- Properties about notification content (including specific fields) can be combined into content validation properties
- Properties about database updates can be combined with their corresponding business logic properties

### Core Notification Properties

**Property 1: Notification creation for business events**
*For any* business event that affects a user, creating the event should result in a notification record being created in the notification_queue table
**Validates: Requirements 1.1**

**Property 2: Unread count accuracy**
*For any* user, the displayed unread notification count should equal the number of notifications in the database where read = false for that user
**Validates: Requirements 1.2**

**Property 3: Notification read state persistence**
*For any* notification, when marked as read, both the read flag should be set to true and the read_at timestamp should be recorded in the database
**Validates: Requirements 1.4, 13.1, 13.5**

**Property 4: Unread badge visibility**
*For any* user, the notification bell badge should be visible if and only if the user has unread notifications (count > 0)
**Validates: Requirements 1.5**

### Email Notification Properties

**Property 5: High-priority email delivery**
*For any* high-priority notification where the user has email notifications enabled, an email should be sent to the user's registered email address
**Validates: Requirements 2.1**

**Property 6: Email template design compliance**
*For any* email template, the generated HTML should contain the yellow accent color (#FBBF24), black text, white background, and the BidSync logo
**Validates: Requirements 2.2, 18.1, 18.2, 18.3, 18.4**

**Property 7: Email retry with exponential backoff**
*For any* failed email send attempt, the system should retry up to 3 times with exponentially increasing delays between attempts
**Validates: Requirements 2.3**

**Property 8: Email preference respect**
*For any* notification where the user has email_notifications set to false in preferences, no email should be sent
**Validates: Requirements 2.4**

**Property 9: Email sent flag update**
*For any* notification where an email is successfully sent, the sent_via_email flag should be set to true in the database
**Validates: Requirements 2.5**

### Real-Time Notification Properties

**Property 10: Real-time notification delivery**
*For any* new notification created for a logged-in user, the notification should be pushed to all active sessions of that user immediately via Supabase Realtime
**Validates: Requirements 3.2**

**Property 11: Connection recovery and sync**
*For any* user whose connection is lost and then restored, the system should automatically reconnect and sync any notifications created during the disconnection
**Validates: Requirements 3.4**

### Preference Management Properties

**Property 12: Preference persistence**
*For any* notification preference toggle, the new preference value should be persisted to the user_notification_preferences table
**Validates: Requirements 4.2**

**Property 13: Preference-based notification filtering**
*For any* notification type with a corresponding preference setting, if the user has disabled that preference, the notification should not be sent (except for critical notifications)
**Validates: Requirements 4.3**

**Property 14: Global email preference override**
*For any* user with email_notifications set to false, no emails should be sent regardless of individual category preference settings
**Validates: Requirements 4.4**

**Property 15: Critical notification bypass**
*For any* critical notification (account_suspended, verification_rejected, verification_approved), the notification should be sent regardless of user preference settings
**Validates: Requirements 4.5, 11.5**


### Business Event Properties

**Property 16: Proposal submission notifications**
*For any* proposal submission, notifications should be created for the project client, the bidding leader (confirmation), and all administrators
**Validates: Requirements 5.1, 5.5**

**Property 17: Proposal scoring notifications**
*For any* proposal that is scored, a notification should be created for the bidding leader containing the total score and rank
**Validates: Requirements 6.1**

**Property 18: Proposal acceptance team notifications**
*For any* accepted proposal, notifications should be created for the bidding leader and all team members associated with that proposal
**Validates: Requirements 6.2**

**Property 19: Team member join notifications**
*For any* team member joining a team, notifications should be created for both the bidding leader and the new team member (welcome message)
**Validates: Requirements 7.1, 7.2**

**Property 20: Team member removal notifications**
*For any* team member removed from a team, a notification should be created for the removed member including the project title
**Validates: Requirements 7.3, 7.4**

**Property 21: Ready for delivery notifications**
*For any* project marked as ready for delivery, a notification should be created for the project client including the deliverable count
**Validates: Requirements 8.1, 8.4**

**Property 22: Completion acceptance team notifications**
*For any* project completion acceptance, notifications should be created for all team members
**Validates: Requirements 8.2**

**Property 23: Revision request notifications**
*For any* revision request, a notification should be created for the bidding leader
**Validates: Requirements 8.3**

**Property 24: Dual-channel delivery for critical events**
*For any* notification of type proposal_submitted, proposal_scored, proposal_accepted, team_member_joined, team_member_removed, ready_for_delivery, completion_accepted, revision_requested, section_assigned, section_reassigned, section_completed, or verification_approved, both an in-app notification and an email should be sent (subject to user preferences)
**Validates: Requirements 5.4, 6.5, 7.5, 8.5, 11.4, 12.5**

### Deadline Reminder Properties

**Property 25: Project deadline reminders**
*For any* project with a deadline within 7 days, a daily notification should be created for the project client including the days remaining
**Validates: Requirements 9.1, 9.4**

**Property 26: Awarded project deadline reminders**
*For any* awarded project with a deadline within 7 days, daily notifications should be created for all team members including the days remaining
**Validates: Requirements 9.2, 9.4**

**Property 27: Section deadline reminders**
*For any* section with a deadline within 3 days, a daily notification should be created for the assigned team member including the days remaining
**Validates: Requirements 9.3, 9.4**

### Admin Notification Properties

**Property 28: Admin project creation notifications**
*For any* project created by a client, notifications should be created for all administrators
**Validates: Requirements 10.1**

**Property 29: Admin notification data completeness**
*For any* admin notification, the notification data should include all relevant entity IDs (projectId, proposalId, clientId, etc.)
**Validates: Requirements 10.3**

**Property 30: Admin notification channel restriction**
*For any* admin notification about projects or proposals, only in-app notifications should be created (no emails)
**Validates: Requirements 10.4, 10.5**

### Account Status Properties

**Property 31: Verification approval notifications**
*For any* account verification approval, a notification should be created for the user
**Validates: Requirements 11.1**

**Property 32: Verification rejection with reason**
*For any* account verification rejection, a notification should be created for the user including the rejection reason in the notification data
**Validates: Requirements 11.2**

**Property 33: Account suspension with reason**
*For any* account suspension, a notification should be created for the user including the suspension reason in the notification data
**Validates: Requirements 11.3**

### Document Collaboration Properties

**Property 34: Section assignment notifications**
*For any* section assigned to a team member, a notification should be created for the assigned member including the section title and deadline
**Validates: Requirements 12.1, 12.4**

**Property 35: Section reassignment dual notifications**
*For any* section reassignment, notifications should be created for both the previous assignee and the new assignee
**Validates: Requirements 12.2**

**Property 36: Section completion notifications**
*For any* section marked as complete, a notification should be created for the bidding leader
**Validates: Requirements 12.3**

### Notification Management Properties

**Property 37: Mark all as read bulk update**
*For any* user clicking "mark all as read", all notifications where read = false for that user should be updated to read = true
**Validates: Requirements 13.2**

**Property 38: Read state count synchronization**
*For any* notification marked as read, the user's unread count should decrease by 1
**Validates: Requirements 13.3**

### Cleanup and Maintenance Properties

**Property 39: Age-based notification cleanup**
*For any* notification older than 90 days without a legal hold, the cleanup job should delete it from the database
**Validates: Requirements 14.1**

**Property 40: Legal hold preservation**
*For any* notification with a legal hold flag, the cleanup job should not delete it regardless of age
**Validates: Requirements 14.2**

**Property 41: Cleanup logging**
*For any* cleanup job execution, the number of deleted notifications should be logged
**Validates: Requirements 14.3**

**Property 42: Batch deletion performance**
*For any* cleanup operation deleting more than 100 notifications, the deletions should be processed in batches of 100 or fewer
**Validates: Requirements 14.5**

### Error Handling and Reliability Properties

**Property 43: Non-blocking notification creation**
*For any* business logic operation that triggers notification creation, the business logic should complete successfully even if notification creation fails
**Validates: Requirements 15.1**

**Property 44: Error logging without exceptions**
*For any* notification creation failure, an error should be logged but no exception should be thrown to the calling code
**Validates: Requirements 15.2**

**Property 45: Input validation**
*For any* notification creation attempt with missing required fields (userId, type, title) or invalid data types, a validation error should be returned
**Validates: Requirements 15.3**

**Property 46: Retry on failure**
*For any* notification creation failure, the system should retry up to 3 times before giving up
**Validates: Requirements 15.4**

**Property 47: Final failure logging**
*For any* notification creation that fails after all retry attempts, a final failure log entry should be created for monitoring
**Validates: Requirements 15.5**

### Browser Notification Properties

**Property 48: High-priority browser notifications**
*For any* high-priority notification received by a logged-in user with browser notification permission granted, a browser notification should be displayed
**Validates: Requirements 16.2**

**Property 49: Browser notification content**
*For any* browser notification displayed, it should include both the notification title and body
**Validates: Requirements 16.3**

### Monitoring Properties

**Property 50: Success and failure tracking**
*For any* notification sent, the system should increment either the success count or failure count metric
**Validates: Requirements 17.1**

**Property 51: Failure rate alerting**
*For any* 24-hour period where the notification failure rate exceeds 5%, an alert should be generated
**Validates: Requirements 17.2**

**Property 52: Type-segmented metrics**
*For any* notification sent, metrics should be tracked separately for each notification type
**Validates: Requirements 17.3**

**Property 53: Read time calculation**
*For any* notification that is read, the time between created_at and read_at should be included in the average read time calculation
**Validates: Requirements 17.4**

### Type Safety Properties

**Property 54: Type validation**
*For any* notification creation attempt with an invalid notification type, a validation error should be returned
**Validates: Requirements 19.2**

### Security Properties

**Property 55: Notification ownership verification**
*For any* notification deletion attempt, the system should verify the requesting user's ID matches the notification's user_id before allowing deletion
**Validates: Requirements 20.3**

**Property 56: Unread count update on deletion**
*For any* unread notification that is deleted, the user's unread count should decrease by 1
**Validates: Requirements 20.4**

**Property 57: RLS policy enforcement**
*For any* notification query or mutation, Supabase RLS policies should enforce that users can only access their own notifications
**Validates: Requirements 20.5**


## Error Handling

### Error Categories

1. **Validation Errors**: Invalid input data (missing required fields, invalid types)
2. **Database Errors**: Failed database operations (connection issues, constraint violations)
3. **Email Errors**: Failed email delivery (SMTP errors, invalid addresses)
4. **Network Errors**: Failed real-time connections (WebSocket disconnections)
5. **Permission Errors**: Unauthorized access attempts (RLS policy violations)

### Error Handling Strategy

```typescript
// All notification operations return a result object
interface NotificationResult {
  success: boolean;
  notificationId?: string;
  error?: string;
  errorCode?: ErrorCode;
}

// Error codes for programmatic handling
type ErrorCode =
  | 'INVALID_USER'
  | 'INVALID_TYPE'
  | 'VALIDATION_ERROR'
  | 'DATABASE_ERROR'
  | 'EMAIL_ERROR'
  | 'NETWORK_ERROR'
  | 'PERMISSION_ERROR'
  | 'UNKNOWN';
```

### Non-Blocking Error Handling

Notification creation should never block or fail business logic:

```typescript
// Business logic example
async function acceptProposal(proposalId: string) {
  // Core business logic
  await updateProposalStatus(proposalId, 'accepted');
  
  // Non-blocking notification (fire and forget)
  NotificationService.createNotification({
    userId: proposal.lead_id,
    type: 'proposal_accepted',
    title: 'Proposal Accepted',
    body: 'Your proposal has been accepted',
    data: { proposalId },
    sendEmail: true
  }).catch(error => {
    // Log error but don't throw
    console.error('Failed to send notification:', error);
    LoggingService.logNotificationError(error);
  });
  
  return { success: true };
}
```

### Retry Logic

```typescript
class RetryStrategy {
  private maxAttempts = 3;
  private baseDelay = 1000; // 1 second
  
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    context: string
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt < this.maxAttempts) {
          // Exponential backoff: 1s, 2s, 4s
          const delay = this.baseDelay * Math.pow(2, attempt - 1);
          await this.sleep(delay);
        }
      }
    }
    
    // Log final failure
    await LoggingService.logNotificationError(
      context,
      lastError,
      { attempts: this.maxAttempts }
    );
    
    throw new Error(
      `${context} failed after ${this.maxAttempts} attempts: ${lastError.message}`
    );
  }
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

### Error Logging

All errors should be logged with context for debugging and monitoring:

```typescript
interface NotificationErrorLog {
  timestamp: Date;
  errorType: ErrorCode;
  userId?: string;
  notificationType?: NotificationType;
  errorMessage: string;
  errorStack?: string;
  context: Record<string, any>;
  attemptNumber?: number;
}

// Log to database for monitoring
await supabase
  .from('notification_error_logs')
  .insert({
    error_type: errorCode,
    user_id: userId,
    notification_type: type,
    error_message: error.message,
    error_stack: error.stack,
    context: JSON.stringify(context),
    created_at: new Date().toISOString()
  });
```

## Testing Strategy

### Unit Testing

Unit tests verify individual functions and components work correctly in isolation.

**Test Coverage:**
- NotificationService methods (create, read, update, delete)
- EmailService methods (send, queue, retry)
- NotificationTemplateService (template rendering)
- PreferencesService (get, update preferences)
- Input validation functions
- Error handling logic
- Retry mechanisms

**Example Unit Test:**
```typescript
describe('NotificationService.createNotification', () => {
  it('should create notification with valid input', async () => {
    const result = await NotificationService.createNotification({
      userId: 'test-user-id',
      type: 'project_created',
      title: 'Test Notification',
      body: 'Test body',
      data: { projectId: 'test-project-id' }
    });
    
    expect(result.success).toBe(true);
    expect(result.notificationId).toBeDefined();
  });
  
  it('should fail with invalid user ID', async () => {
    const result = await NotificationService.createNotification({
      userId: 'invalid-id',
      type: 'project_created',
      title: 'Test'
    });
    
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe('INVALID_USER');
  });
});
```

### Property-Based Testing

Property-based tests verify that universal properties hold across all inputs using fast-check library.

**Property Test Configuration:**
- Minimum 100 iterations per property
- Each test tagged with property number from design doc
- Use smart generators that constrain to valid input space

**Example Property Test:**
```typescript
import fc from 'fast-check';

describe('Notification System Properties', () => {
  /**
   * Feature: notification-system, Property 1: Notification creation for business events
   * For any business event that affects a user, creating the event should result 
   * in a notification record being created in the notification_queue table
   * Validates: Requirements 1.1
   */
  it('Property 1: creates notification for any business event', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(), // userId
        fc.constantFrom(...notificationTypes), // type
        fc.string({ minLength: 1, maxLength: 200 }), // title
        async (userId, type, title) => {
          // Create notification
          const result = await NotificationService.createNotification({
            userId,
            type,
            title
          });
          
          // Verify notification exists in database
          if (result.success) {
            const notification = await getNotificationById(result.notificationId!);
            expect(notification).toBeDefined();
            expect(notification.userId).toBe(userId);
            expect(notification.type).toBe(type);
            expect(notification.title).toBe(title);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
  
  /**
   * Feature: notification-system, Property 8: Email preference respect
   * For any notification where the user has email_notifications set to false 
   * in preferences, no email should be sent
   * Validates: Requirements 2.4
   */
  it('Property 8: respects email preference disabled', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uuid(), // userId
        fc.constantFrom(...notificationTypes), // type
        async (userId, type) => {
          // Set email preferences to false
          await setUserPreference(userId, 'email_notifications', false);
          
          // Create notification with sendEmail = true
          const result = await NotificationService.createNotification({
            userId,
            type,
            title: 'Test',
            sendEmail: true
          });
          
          // Verify no email was sent
          const emailsSent = await getEmailsSentToUser(userId);
          expect(emailsSent.length).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

### Integration Testing

Integration tests verify that components work together correctly.

**Test Scenarios:**
- End-to-end notification flow (create → database → email → realtime)
- Business logic integration (proposal submission triggers notifications)
- Preference checking integration
- Email queue processing
- Real-time subscription and delivery
- Cleanup job execution

**Example Integration Test:**
```typescript
describe('Notification Integration', () => {
  it('should send notification when proposal is submitted', async () => {
    // Submit proposal
    const proposal = await submitProposal(testProposalId);
    
    // Wait for notifications to be created
    await waitFor(async () => {
      const clientNotifications = await getNotifications(testClientId);
      const leadNotifications = await getNotifications(testLeadId);
      const adminNotifications = await getNotifications(testAdminId);
      
      expect(clientNotifications).toContainEqual(
        expect.objectContaining({
          type: 'proposal_submitted',
          data: expect.objectContaining({ proposalId: testProposalId })
        })
      );
      
      expect(leadNotifications).toContainEqual(
        expect.objectContaining({
          type: 'proposal_submitted',
          title: expect.stringContaining('Successfully Submitted')
        })
      );
      
      expect(adminNotifications.length).toBeGreaterThan(0);
    });
  });
});
```

### Testing Tools

- **Unit Tests**: Vitest
- **Property-Based Tests**: fast-check
- **Integration Tests**: Vitest with Supabase test client
- **E2E Tests**: Playwright (for UI components)
- **Mocking**: Vitest mocks for external services

